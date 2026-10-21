# ==============================================================================
# OptiCore Portable AI Server — Status Script
# ==============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ServerRoot = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir "common.ps1")

Write-OptiCoreBanner "Server Status"

# 1. Docker Status
if (-not (Test-DockerDaemon)) {
    Log-Warn "Docker Desktop daemon is not running."
    exit 0
}

# 2. Container Status
$composeFile = Join-Path $ServerRoot "docker-compose.yml"
Log-Info "Inspecting OptiCore containers..."
Push-Location $ServerRoot
try {
    & docker compose -f $composeFile ps
} finally {
    Pop-Location
}

# 3. Backend Health Check
$envPath = Join-Path $ServerRoot ".env"
$envMap = Parse-EnvFile $envPath
$apiPort = if ($envMap["API_PORT"]) { $envMap["API_PORT"] } elseif ($envMap["PORT"]) { $envMap["PORT"] } else { "8000" }

$healthUrl = "http://127.0.0.1:${apiPort}/health"
Log-Info "Checking API Health on $healthUrl..."

try {
    $healthResp = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3 -ErrorAction Stop
    Write-Host ""
    Write-Host "-- AI Server Diagnostics ----------------------------------------------" -ForegroundColor Cyan
    Write-Host " Status:          $($healthResp.status.ToUpper())" -ForegroundColor Green
    Write-Host " Model Loaded:    $($healthResp.model_loaded)" -ForegroundColor Green
    Write-Host " Architecture:    $($healthResp.architecture)" -ForegroundColor White
    Write-Host " Classes Count:   $($healthResp.class_count)" -ForegroundColor White
    Write-Host " Version:         $($healthResp.version)" -ForegroundColor White
    if ($healthResp.error) {
        Write-Host " Model Error:     $($healthResp.error)" -ForegroundColor Red
    }
} catch {
    Log-Warn "API health check failed: $_"
}

# 4. Ngrok Tunnel Check
$publicUrl = Get-NgrokPublicUrl -MaxAttempts 2 -DelaySec 1
if ($publicUrl) {
    Write-Host ""
    Write-Host "-- Public Ngrok Tunnel ------------------------------------------------" -ForegroundColor Cyan
    Write-Host " Status:          ACTIVE" -ForegroundColor Green
    Write-Host " Public URL:      $publicUrl" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "-- Public Ngrok Tunnel ------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " Status:          INACTIVE or NOT CONFIGURED" -ForegroundColor DarkGray
}

Write-Host "-----------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

