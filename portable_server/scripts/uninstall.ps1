# ==============================================================================
# OptiCore Portable AI Server — Uninstaller Script
# ==============================================================================

param(
    [switch]$Force = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ServerRoot = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir "common.ps1")

Write-OptiCoreBanner "Uninstaller"

if (-not $Force) {
    Write-Host "This will stop all running OptiCore containers and remove container resources." -ForegroundColor Yellow
    $confirm = Read-Host "Are you sure you want to uninstall? (Y/N)"
    if ($confirm -notmatch "^[Yy]") {
        Log-Info "Uninstall cancelled by user."
        exit 0
    }
}

if (Test-DockerDaemon) {
    Log-Info "Stopping and removing containers..."
    $composeFile = Join-Path $ServerRoot "docker-compose.yml"
    Push-Location $ServerRoot
    try {
        & docker compose -f $composeFile --profile ngrok down -v
    } finally {
        Pop-Location
    }
}

Log-Success "Containers and virtual networks have been removed."

if (-not $Force) {
    $removeData = Read-Host "Do you also want to remove local logs and SQLite database in './data'? (Y/N)"
    if ($removeData -match "^[Yy]") {
        $dataPath = Join-Path $ServerRoot "data"
        if (Test-Path $dataPath) {
            Remove-Item -Path $dataPath -Recurse -Force
            Log-Success "Data directory removed."
        }
    }
}

Log-Success "OptiCore uninstallation completed."
