$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'Git pull failed' }
& "$PSScriptRoot/pm2_start.ps1"
