#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v crontab >/dev/null
NODE="$(command -v node)"
mkdir -p "$ROOT/front/data"
# UTC 18:10 is 03:10 in Korea. Keep existing unrelated cron jobs.
JOB="10 18 * * * cd $ROOT/front && /usr/bin/flock -n /tmp/apart-retention-cleanup.lock $NODE node_modules/tsx/dist/cli.mjs scripts/cleanup-account-data.ts >> $ROOT/front/data/retention-cleanup.log 2>&1 # apart-account-retention"
{ (crontab -l 2>/dev/null || true) | sed '/# apart-account-retention$/d'; printf '%s\n' "$JOB"; } | crontab -
