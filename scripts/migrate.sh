#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
script -qec "pnpm --filter api prisma:migrate" /dev/null
