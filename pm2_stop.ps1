$ErrorActionPreference = 'Stop'
pm2 stop apart
if ($LASTEXITCODE -ne 0) { throw 'PM2 stop failed' }
pm2 save
if ($LASTEXITCODE -ne 0) { throw 'PM2 save failed' }
