# ==============================================================================
# OptiCore Portable AI Server — Stop Server Script
# ==============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ServerRoot = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir "common.ps1")

Write-OptiCoreBanner "Stop Server"

if (-not (Test-DockerCli)) {
    Log-Error "Docker CLI not found."
    exit 1
}

if (-not (Test-DockerDaemon)) {
    Log-Warn "Docker daemon is not running. No active OptiCore containers to stop."
    exit 0
}

Log-Info "Stopping OptiCore containers and tunnels..."
Show-ProgressBar -Activity "Shutting Down Containers" -Percent 25 -Status "Sending down signal..."

$composeFile = Join-Path $ServerRoot "docker-compose.yml"
Push-Location $ServerRoot
try {
    Show-ProgressBar -Activity "Shutting Down Containers" -Percent 65 -Status "Stopping server & ngrok..."
    & docker compose -f $composeFile --profile ngrok down
    if ($LASTEXITCODE -eq 0) {
        Show-ProgressBar -Activity "Containers Stopped" -Percent 100 -Status "Cleaned up!"
        Log-Success "OptiCore AI Server and Ngrok tunnel have stopped cleanly."
    } else {
        Write-Host ""
        Log-Warn "Docker Compose down returned exit code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}
