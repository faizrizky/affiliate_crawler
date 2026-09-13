#!/usr/bin/env bash
# Build + jalankan mode production di server (tanpa Docker).
#
# Memakai Postgres, Redis, dan profil Threads (runtime/threads-profile) yang
# sudah ada di mesin ini. docker-compose.yml membawa Postgres/Redis kosong dan
# crawler tanpa sesi login Threads, jadi JANGAN dipakai di server yang sudah
# berisi data kecuali volume & profilnya dipetakan dulu.
#
#   scripts/start-prod.sh          # build ulang lalu (re)start web + api + crawler
#   SKIP_BUILD=1 scripts/start-prod.sh   # restart saja, pakai hasil build terakhir
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
LOG_DIR="${LOG_DIR:-$ROOT/runtime/logs}"
WEB_PORT="${WEB_PORT:-3000}"
API_PORT="${API_PORT:-3001}"
CRAWLER_PORT="${CRAWLER_PORT:-8001}"
mkdir -p "$LOG_DIR"

stop_matching() {
  # Pola dengan [x] supaya pgrep tidak ikut mencocokkan baris perintah skrip ini.
  local pattern="$1"
  local pids
  pids="$(pgrep -f "$pattern" || true)"
  [ -z "$pids" ] && return 0
  kill $pids 2>/dev/null || true
  for _ in $(seq 1 20); do
    pgrep -f "$pattern" >/dev/null || return 0
    sleep 0.5
  done
  kill -9 $(pgrep -f "$pattern") 2>/dev/null || true
}

stop_port() {
  # Next.js standalone mengganti judul prosesnya jadi "next-server (vX)", jadi
  # pgrep berdasarkan path server.js tidak pernah cocok. Hentikan lewat port.
  local port="$1"
  local pids
  pids="$(ss -ltnp 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)"
  [ -z "$pids" ] && return 0
  kill $pids 2>/dev/null || true
  for _ in $(seq 1 20); do
    ss -ltn 2>/dev/null | grep -q ":$port " || return 0
    sleep 0.5
  done
  kill -9 $pids 2>/dev/null || true
}

wait_http() {
  local name="$1" url="$2"
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null --max-time 3 "$url"; then
      echo "  ✓ $name siap ($url)"
      return 0
    fi
    sleep 1
  done
  echo "  ✗ $name tidak merespons: $url (lihat $LOG_DIR)" >&2
  return 1
}

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> install dependency"
  pnpm install --frozen-lockfile
  echo "==> prisma generate + migrate deploy"
  pnpm db:generate
  pnpm --filter api prisma:deploy
  echo "==> build api"
  pnpm --filter api build
  echo "==> build web (dev server web harus mati: berbagi folder .next)"
  stop_matching "next/dist/bin/nex[t] dev"
  stop_port "$WEB_PORT"
  pnpm --filter web build
  STANDALONE="apps/web/.next/standalone/apps/web"
  rm -rf "$STANDALONE/.next/static" "$STANDALONE/public"
  mkdir -p "$STANDALONE/.next"
  cp -r apps/web/.next/static "$STANDALONE/.next/static"
  [ -d apps/web/public ] && cp -r apps/web/public "$STANDALONE/public"
fi

echo "==> restart api"
stop_matching "dist/mai[n].js"
(cd apps/api && setsid nohup env NODE_ENV=production node dist/main.js >"$LOG_DIR/api.log" 2>&1 &)
wait_http "api" "http://localhost:$API_PORT/health"

echo "==> restart web"
stop_port "$WEB_PORT"
(cd apps/web/.next/standalone && setsid nohup env NODE_ENV=production PORT="$WEB_PORT" HOSTNAME=0.0.0.0 \
  API_PROXY_TARGET="http://localhost:$API_PORT" node apps/web/server.js >"$LOG_DIR/web.log" 2>&1 &)
wait_http "web" "http://localhost:$WEB_PORT/login"

echo "==> crawler"
if curl -s -o /dev/null --max-time 3 "http://localhost:$CRAWLER_PORT/health"; then
  # Restart crawler membuka ulang profil Threads; hindari kalau tidak perlu.
  echo "  ✓ crawler sudah jalan (tidak di-restart; set RESTART_CRAWLER=1 untuk memaksa)"
  if [ "${RESTART_CRAWLER:-0}" = "1" ]; then
    stop_matching "uvicorn app.mai[n]:app"
    (cd apps/crawler && setsid nohup .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$CRAWLER_PORT" >"$LOG_DIR/crawler.log" 2>&1 &)
    wait_http "crawler" "http://localhost:$CRAWLER_PORT/health"
  fi
else
  (cd apps/crawler && setsid nohup .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$CRAWLER_PORT" >"$LOG_DIR/crawler.log" 2>&1 &)
  wait_http "crawler" "http://localhost:$CRAWLER_PORT/health"
fi

echo "==> selesai. Log: $LOG_DIR"
