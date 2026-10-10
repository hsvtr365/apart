#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
test -f front/.env || { echo "front/.env is required" >&2; exit 1; }
command -v pm2 >/dev/null
LOCK_HASH=$(sha256sum front/package-lock.json | cut -d ' ' -f1)
INSTALLED_HASH_FILE=front/node_modules/.package-lock.sha256
if [ ! -d front/node_modules ] || [ ! -f "$INSTALLED_HASH_FILE" ] || [ "$(cat "$INSTALLED_HASH_FILE")" != "$LOCK_HASH" ]; then
  npm --prefix front ci
  npm --prefix front run db:generate
  printf '%s\n' "$LOCK_HASH" > "$INSTALLED_HASH_FILE"
else
  echo "package-lock.json unchanged; skipping npm ci"
  npm --prefix front run db:generate
fi
npm --prefix front run db:migrate
npm --prefix front run build
pm2 startOrReload ecosystem.config.cjs --only apart
pm2 save
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 2 http://127.0.0.1:28004/api/bootstrap >/dev/null
echo "apart is running on 127.0.0.1:28004"
