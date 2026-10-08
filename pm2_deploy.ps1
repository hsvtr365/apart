param([string]$SshHost = 'ubuntu')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
# Server .env stays private and is provisioned once, separately from Git.
ssh $SshHost 'set -eu; if [ ! -d /home/ubuntu/app/apart/.git ]; then git clone https://github.com/hsvtr365/apart.git /home/ubuntu/app/apart; fi; cd /home/ubuntu/app/apart; bash pm2_reload.sh'
if ($LASTEXITCODE -ne 0) { throw 'Remote deployment failed' }
Write-Host 'https://apart.jujeop.com'
