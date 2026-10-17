# ==============================================================================
#  OptiCore Backend 1-Line Deployment Script (Windows PowerShell)
#  Usage:
#    irm https://raw.githubusercontent.com/Dharshankumar8197/OptiiCore/main/deploy_backend.ps1 | iex
# ==============================================================================

param(
    [string]$Authtoken = $env:NGROK_AUTHTOKEN,
    [int]$Port = 8000
)

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "   🚀 OptiCore AI Vision Backend — Remote Docker Deploy     " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan

# Check for Docker
try {
    $null = docker --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] Docker Desktop is not running or not installed." -ForegroundColor Red
        Write-Host "    Please ensure Docker Desktop is started and try again." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "[!] Docker CLI not found." -ForegroundColor Red
    exit 1
}

# Prompt for token if not given
if ([string]::IsNullOrWhiteSpace($Authtoken)) {
    Write-Host "[?] Enter your Ngrok Authtoken (get one free at https://dashboard.ngrok.com):" -ForegroundColor Yellow
    $Authtoken = Read-Host "Authtoken (press Enter to skip public tunnel)"
}

$ContainerName = "opticore-backend"
$ImageName = "ghcr.io/dharshankumar8197/optiicore-backend:latest"

Write-Host "[*] Stopping existing OptiCore container if running..." -ForegroundColor Cyan
docker stop $ContainerName 2>$null | Out-Null
docker rm $ContainerName 2>$null | Out-Null

Write-Host "[*] Pulling or building backend container ($ImageName)..." -ForegroundColor Cyan
$pullSuccess = $false
try {
    docker pull $ImageName 2>$null
    if ($LASTEXITCODE -eq 0) { $pullSuccess = $true }
} catch {}

if (-not $pullSuccess) {
    Write-Host "[*] Building locally from backend/Dockerfile.standalone..." -ForegroundColor Yellow
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    if ([string]::IsNullOrEmpty($scriptDir)) { $scriptDir = (Get-Location).Path }
    docker build -f "$scriptDir/backend/Dockerfile.standalone" -t $ImageName "$scriptDir/backend"
}

Write-Host "[*] Starting OptiCore Backend container on port $Port..." -ForegroundColor Cyan
docker run -d `
    --name $ContainerName `
    --restart unless-stopped `
    -p "${Port}:8000" `
    -p "4040:4040" `
    -e NGROK_AUTHTOKEN="$Authtoken" `
    -v opticore_data:/app/data `
    $ImageName

Write-Host "[+] Container started successfully!" -ForegroundColor Green
Write-Host "[*] Resolving Ngrok public HTTPS tunnel..." -ForegroundColor Cyan

$publicUrl = ""
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $publicUrl = docker exec $ContainerName cat /app/data/ngrok_url.txt 2>$null
        if (-not [string]::IsNullOrWhiteSpace($publicUrl)) { break }
    } catch {}
}

Write-Host "`n===========================================================" -ForegroundColor Green
Write-Host "   🎉 OPTICORE BACKEND SERVER IS LIVE AND ACCESSIBLE!     " -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "   📡 Local API:     http://localhost:$Port" -ForegroundColor Cyan
if (-not [string]::IsNullOrWhiteSpace($publicUrl)) {
    Write-Host "   🌍 Public HTTPS:  $publicUrl" -ForegroundColor Green
    Write-Host "   📖 Swagger Docs:  $publicUrl/docs" -ForegroundColor Cyan
    Write-Host "===========================================================" -ForegroundColor Green
    Write-Host "👉 Set this in your Web App (.env.local) or Mobile App:" -ForegroundColor Yellow
    Write-Host "   NEXT_PUBLIC_API_URL=$publicUrl" -ForegroundColor Green
    $wsUrl = $publicUrl -replace "https://", "wss://"
    Write-Host "   NEXT_PUBLIC_WS_URL=$wsUrl" -ForegroundColor Green
} else {
    Write-Host "   📖 Swagger Docs:  http://localhost:$Port/docs" -ForegroundColor Cyan
    Write-Host "ℹ️  Running in local-only mode (no Ngrok token provided)." -ForegroundColor Yellow
}
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "View container logs anytime with: docker logs -f $ContainerName`n" -ForegroundColor Cyan
