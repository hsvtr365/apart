#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
test -f front/.env || { echo "front/.env is required" >&2; exit 1; }
command -v pm2 >/dev/null
npm --prefix front run setup
npm --prefix front run build
pm2 startOrReload ecosystem.config.cjs --only apart
pm2 save
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 2 http://127.0.0.1:28004/api/bootstrap >/dev/null
echo "apart is running on 127.0.0.1:28004"
