param(
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pgData = Join-Path $repoRoot '.local-data\postgres-native'
$pgBin = if ($env:SLINK_PG_BIN) { $env:SLINK_PG_BIN } else { 'C:\Program Files\PostgreSQL\18\bin' }
$pgCtl = Join-Path $pgBin 'pg_ctl.exe'

if (-not (Test-Path $pgCtl)) {
  throw "pg_ctl.exe was not found in '$pgBin'. Set SLINK_PG_BIN to the PostgreSQL bin directory."
}
if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
  throw "The local PostgreSQL data directory is not initialized: $pgData"
}

& $pgCtl status -D $pgData *> $null
$isRunning = $LASTEXITCODE -eq 0

switch ($Action) {
  'start' {
    if (-not $isRunning) {
      & $pgCtl start -D $pgData -o '-h 127.0.0.1 -p 5433' -w
      if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not start on 127.0.0.1:5433.' }
    }
    Write-Output 'PostgreSQL is running on 127.0.0.1:5433.'
  }
  'stop' {
    if ($isRunning) {
      & $pgCtl stop -D $pgData -m fast -w
      if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not stop cleanly.' }
    }
    Write-Output 'PostgreSQL is stopped.'
  }
  'status' {
    if ($isRunning) {
      Write-Output 'PostgreSQL is running on 127.0.0.1:5433.'
    } else {
      Write-Output 'PostgreSQL is stopped.'
    }
  }
}
