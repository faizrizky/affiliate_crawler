#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v pg_isready >/dev/null 2>&1 || ! pg_isready -q; then
  echo "postgres is not running (expected threads_dev on localhost:5432)" >&2
  exit 1
fi
if ! redis-cli ping >/dev/null 2>&1; then
  echo "redis is not running (expected localhost:6379)" >&2
  exit 1
fi

pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
