$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (!(Test-Path -LiteralPath 'front/.env')) { throw 'front/.env is required' }
# Windows locks Next's native module while the app is running.
pm2 stop apart 2>$null
npm --prefix front run setup
if ($LASTEXITCODE -ne 0) { throw 'Setup failed' }
npm --prefix front run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
pm2 startOrReload ecosystem.config.cjs --only apart
if ($LASTEXITCODE -ne 0) { throw 'PM2 start failed' }
pm2 save
if ($LASTEXITCODE -ne 0) { throw 'PM2 save failed' }
Write-Host 'apart: http://localhost:28004'
