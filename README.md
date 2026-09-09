# Threads Affiliate Content Researcher

Find Threads conversations around a product keyword, score them for affiliate
potential, and paste the strongest threads into reusable content templates.

## Stack

| App          | Tech                                                        | Port |
| ------------ | ----------------------------------------------------------- | ---- |
| `apps/web`   | Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui | 3000 |
| `apps/api`   | NestJS 12 + Prisma 7 + Postgres + Redis + BullMQ            | 3001 |
| `apps/crawler` | Python 3.12 + FastAPI + Scrapling + Playwright            | 8001 |

Shared packages: `packages/types` (shared TS types), `packages/config`
(shared constants), `packages/ui` (design tokens CSS).

## Getting started

Prereqs: Node 20+, pnpm, Python 3.12+, Postgres 16 + Redis 7 (or Docker).

```bash
cp .env.example .env          # adjust if your Postgres/Redis differ
./scripts/dev.sh              # install, generate client, migrate, run all 3 apps
./scripts/seed.sh             # optional: seed sample templates
```

Without Docker, start Postgres and Redis locally first:

- Postgres: role `threads`, db `threads_dev`
- Redis: default `localhost:6379`

The crawler service needs a Python venv:

```bash
cd apps/crawler
python3.12 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --port 8001
```

## Docker

```bash
docker compose up --build
```

Starts postgres, redis, crawler, api, web. `docker/nginx/nginx.conf` is an
optional reverse-proxy config (not wired into the compose file).

## Scripts (root)

- `pnpm dev` — run all apps via Turbo
- `pnpm dev:web` / `pnpm dev:api` / `pnpm dev:crawler`
- `pnpm build` / `pnpm lint` / `pnpm test`
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:deploy` / `pnpm db:seed`

## Crawler

FastAPI service. `POST /crawl` with `{ "keyword": "...", "limit": 20 }` runs
the Threads pipeline (fetch → parse → normalize → dedupe → score) and returns
`{ "posts": [...], "stats": {...} }`. The API enqueues crawl jobs in Redis
(BullMQ); its worker calls this service and persists results to Postgres.

Threads is login-gated; when the adapter cannot reach the search page the job
fails with a clear error message instead of returning fake data.

## Tests

- API/web: `pnpm test` (per-app)
- Crawler: `cd apps/crawler && .venv/bin/pytest` (offline, fixture-based)
