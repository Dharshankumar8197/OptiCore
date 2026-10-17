# ==============================================================================
#  OptiCore Quick Backend Launcher (1-Second Startup)
#  Usage: .\start_backend.ps1
# ==============================================================================

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "       OptiCore AI Vision Backend - Instant Start          " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan

$ContainerName = "opticore-backend"

# Check if Docker is running
try {
    $null = docker --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] Docker Desktop is not running. Please start Docker Desktop first." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[!] Docker CLI not found." -ForegroundColor Red
    exit 1
}

# Check if container exists
$containerStatus = docker inspect -f '{{.State.Status}}' $ContainerName 2>$null

if ($containerStatus -eq "running") {
    Write-Host "[+] OptiCore Backend container is ALREADY running!" -ForegroundColor Green
} elseif (-not [string]::IsNullOrWhiteSpace($containerStatus)) {
    Write-Host "[*] Starting existing OptiCore Backend container..." -ForegroundColor Cyan
    docker start $ContainerName | Out-Null
    Write-Host "[+] Container started in 1 second!" -ForegroundColor Green
} else {
    Write-Host "[*] Container does not exist yet. Launching deployment script..." -ForegroundColor Yellow
    $deployScript = Join-Path $PSScriptRoot "deploy_backend.ps1"
    & $deployScript
    exit 0
}

# Resolve Ngrok tunnel URL
Write-Host "[*] Resolving active Ngrok public HTTPS tunnel..." -ForegroundColor Cyan
$publicUrl = ""
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $publicUrl = docker exec $ContainerName cat /app/data/ngrok_url.txt 2>$null
        if (-not [string]::IsNullOrWhiteSpace($publicUrl)) { break }
    } catch {}

    try {
        $tunnelData = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction SilentlyContinue
        if ($tunnelData -and $tunnelData.tunnels) {
            $httpsTunnel = $tunnelData.tunnels | Where-Object { $_.public_url -like "https:*" } | Select-Object -First 1
            if ($httpsTunnel -and $httpsTunnel.public_url) {
                $publicUrl = $httpsTunnel.public_url
                break
            }
        }
    } catch {}
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "   OPTICORE BACKEND SERVER IS LIVE AND READY!             " -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "   Local API:     http://localhost:8000" -ForegroundColor Cyan
if (-not [string]::IsNullOrWhiteSpace($publicUrl)) {
    Write-Host "   Public HTTPS:  $publicUrl" -ForegroundColor Green
    Write-Host "   Swagger Docs:  $publicUrl/docs" -ForegroundColor Cyan
    Write-Host "===========================================================" -ForegroundColor Green
    Write-Host "Set this in Vercel or your Web App (.env.local):" -ForegroundColor Yellow
    Write-Host "   NEXT_PUBLIC_API_URL=$publicUrl" -ForegroundColor Green
} else {
    Write-Host "   Swagger Docs:  http://localhost:8000/docs" -ForegroundColor Cyan
}
Write-Host "===========================================================" -ForegroundColor Green

# Open live logs window
$logsScript = Join-Path $PSScriptRoot "logs.ps1"
if (Test-Path $logsScript) {
    & $logsScript -NewWindow
}
