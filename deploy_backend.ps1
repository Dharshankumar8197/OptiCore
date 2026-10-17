# ==============================================================================
#  OptiCore Backend 1-Line Deployment Script (Windows PowerShell)
#  Usage:
#    irm https://raw.githubusercontent.com/Dharshankumar8197/OptiCore/main/deploy_backend.ps1 | iex
# ==============================================================================

param(
    [string]$Authtoken = $env:NGROK_AUTHTOKEN,
    [int]$Port = 8000,
    [switch]$EditEnv
)

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "   OptiCore AI Vision Backend - Remote Docker Deploy       " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan

# 1. Determine persistent configuration directory
$opticoreHome = Join-Path $HOME ".opticore"
if (-not (Test-Path $opticoreHome)) {
    New-Item -ItemType Directory -Path $opticoreHome -Force | Out-Null
}

$scriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($scriptDir) -and $MyInvocation.MyCommand -and $MyInvocation.MyCommand.Path) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if ([string]::IsNullOrEmpty($scriptDir)) {
    $scriptDir = (Get-Location).Path
}

# Active .env resolution: prefer local backend\.env if in repo, else $HOME\.opticore\.env
$activeEnvFile = Join-Path $opticoreHome ".env"
$repoBackendEnv = Join-Path $scriptDir "backend\.env"
if (Test-Path $repoBackendEnv) {
    $activeEnvFile = $repoBackendEnv
}

# If user passed -EditEnv, open the .env and exit
if ($EditEnv) {
    $editor = "notepad.exe"
    if (Get-Command code -ErrorAction SilentlyContinue) { $editor = "code" }
    Write-Host "[*] Opening configuration: $activeEnvFile with $editor..." -ForegroundColor Cyan
    Start-Process $editor "`"$activeEnvFile`""
    exit 0
}

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

# Auto-discover saved Ngrok token from .env or cache files
$tokenCacheFile = Join-Path $HOME ".opticore_ngrok_token"
$localTokenFile = Join-Path $scriptDir ".ngrok_token"

if ([string]::IsNullOrWhiteSpace($Authtoken)) {
    if (Test-Path $activeEnvFile) {
        $envMatch = Select-String -Path $activeEnvFile -Pattern "^NGROK_AUTHTOKEN=(.+)$" | Select-Object -First 1
        if ($envMatch) { $Authtoken = $envMatch.Matches[0].Groups[1].Value.Trim() }
    }
    if ([string]::IsNullOrWhiteSpace($Authtoken) -and (Test-Path $localTokenFile)) {
        $Authtoken = (Get-Content $localTokenFile -Raw).Trim()
    }
    if ([string]::IsNullOrWhiteSpace($Authtoken) -and (Test-Path $tokenCacheFile)) {
        $Authtoken = (Get-Content $tokenCacheFile -Raw).Trim()
    }

    if (-not [string]::IsNullOrWhiteSpace($Authtoken)) {
        Write-Host "[+] Loaded saved Ngrok Authtoken: $($Authtoken.Substring(0, [math]::Min(8, $Authtoken.Length)))..." -ForegroundColor Green
    }
}

# Prompt only if token is still unknown
if ([string]::IsNullOrWhiteSpace($Authtoken)) {
    Write-Host "[?] Enter your Ngrok Authtoken (get one free at https://dashboard.ngrok.com):" -ForegroundColor Yellow
    $Authtoken = Read-Host "Authtoken (press Enter to skip public tunnel)"
}

# Ensure persistent .env file exists and has latest values
if (-not (Test-Path $activeEnvFile)) {
    $defaultEnv = @"
# OptiCore Environment Configuration
APP_NAME=OptiCore
ENVIRONMENT=production
HOST=0.0.0.0
PORT=$Port

# Ngrok Public HTTPS Tunnel
NGROK_AUTHTOKEN=$Authtoken

# AI Model Inference Settings
MODEL_PATH=./models/best.pt
CONFIDENCE_THRESHOLD=0.50
IOU_THRESHOLD=0.45
IMAGE_SIZE=640

# Database
DATABASE_URL=sqlite:///./data/opticore.db

# Authentication
JWT_SECRET_KEY=opticore-secret-key-$(Get-Random)-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
"@
    Set-Content -Path $activeEnvFile -Value $defaultEnv -Force
    Write-Host "[+] Saved configuration to $activeEnvFile" -ForegroundColor Green
} elseif (-not [string]::IsNullOrWhiteSpace($Authtoken)) {
    $content = Get-Content $activeEnvFile -Raw
    if ($content -match "NGROK_AUTHTOKEN=") {
        $content = $content -replace "NGROK_AUTHTOKEN=.*", "NGROK_AUTHTOKEN=$Authtoken"
    } else {
        $content += "`nNGROK_AUTHTOKEN=$Authtoken`n"
    }
    Set-Content -Path $activeEnvFile -Value $content.Trim() -Force
}

# Also cache token file
if (-not [string]::IsNullOrWhiteSpace($Authtoken)) {
    try {
        Set-Content -Path $tokenCacheFile -Value $Authtoken -Force
        if (Test-Path $scriptDir) { Set-Content -Path $localTokenFile -Value $Authtoken -Force }
    } catch {}
}

$ContainerName = "opticore-backend"
$ImageName = "ghcr.io/dharshankumar8197/opticore-backend:latest"

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
    $dockerfile = Join-Path $scriptDir "backend\Dockerfile.standalone"
    $backendDir = Join-Path $scriptDir "backend"

    if (Test-Path $dockerfile) {
        Write-Host "[*] Building container locally from $dockerfile..." -ForegroundColor Yellow
        Write-Host "    (Streaming live pip and PyTorch download progress below)" -ForegroundColor Gray
        docker build --progress=plain -f $dockerfile -t $ImageName $backendDir
    } else {
        Write-Host "[*] Cloning OptiCore repository to build Docker container..." -ForegroundColor Yellow
        $tempBuildDir = Join-Path $env:TEMP "opticore_build_$(Get-Random)"
        git clone --depth 1 https://github.com/Dharshankumar8197/OptiCore.git $tempBuildDir
        Write-Host "[*] Building container from clone..." -ForegroundColor Yellow
        Write-Host "    (Streaming live pip and PyTorch download progress below)" -ForegroundColor Gray
        docker build --progress=plain -f "$tempBuildDir/backend/Dockerfile.standalone" -t $ImageName "$tempBuildDir/backend"
        Remove-Item -Recurse -Force $tempBuildDir -ErrorAction SilentlyContinue
    }
}

Write-Host "[*] Starting OptiCore Backend container on port $Port..." -ForegroundColor Cyan
Write-Host "    Loading environment variables from: $activeEnvFile" -ForegroundColor Gray

docker run -d `
    --name $ContainerName `
    --restart unless-stopped `
    -p "${Port}:8000" `
    -p "4040:4040" `
    --env-file "$activeEnvFile" `
    -v opticore_data:/app/data `
    $ImageName

Write-Host "[+] Container started successfully!" -ForegroundColor Green
Write-Host "[*] Resolving Ngrok public HTTPS tunnel..." -ForegroundColor Cyan

$publicUrl = ""
for ($i = 0; $i -lt 30; $i++) {
    $percent = [math]::Round((($i + 1) / 30) * 100)
    $filled = [math]::Round((($i + 1) / 30) * 20)
    $empty = 20 - $filled
    $bar = ("#" * $filled) + ("." * $empty)
    Write-Host -NoNewline "`r   [$bar] $percent% Checking tunnel endpoint..." -ForegroundColor Yellow

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

if (-not [string]::IsNullOrWhiteSpace($publicUrl)) {
    Write-Host "`r   [####################] 100% Tunnel resolved successfully!        " -ForegroundColor Green
} else {
    Write-Host "`r   [####################] 100% Local mode ready.                    " -ForegroundColor Gray
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "   OPTICORE BACKEND SERVER IS LIVE AND ACCESSIBLE!         " -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "   Local API:     http://localhost:$Port" -ForegroundColor Cyan
if (-not [string]::IsNullOrWhiteSpace($publicUrl)) {
    Write-Host "   Public HTTPS:  $publicUrl" -ForegroundColor Green
    Write-Host "   Swagger Docs:  $publicUrl/docs" -ForegroundColor Cyan
    Write-Host "===========================================================" -ForegroundColor Green
    Write-Host "Set this in Vercel or your Web App (.env.local):" -ForegroundColor Yellow
    Write-Host "   NEXT_PUBLIC_API_URL=$publicUrl" -ForegroundColor Green
    $wsUrl = $publicUrl -replace "https://", "wss://"
    Write-Host "   NEXT_PUBLIC_WS_URL=$wsUrl" -ForegroundColor Green
} else {
    Write-Host "   Swagger Docs:  http://localhost:$Port/docs" -ForegroundColor Cyan
    Write-Host "Running in local-only mode (no Ngrok token provided)." -ForegroundColor Yellow
}
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "Configuration file: $activeEnvFile" -ForegroundColor Cyan
Write-Host "To edit .env anytime from PowerShell:" -ForegroundColor Yellow
Write-Host "   notepad `"$activeEnvFile`"" -ForegroundColor White
Write-Host "   Or: irm https://raw.githubusercontent.com/Dharshankumar8197/OptiCore/main/open_env.ps1 | iex" -ForegroundColor White
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "View container logs anytime with: docker logs -f $ContainerName" -ForegroundColor Cyan
Write-Host "[*] Launching live logs monitor in a dedicated PowerShell window..." -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'OptiCore Backend Logs'; Write-Host '===========================================================' -ForegroundColor Cyan; Write-Host '   OptiCore Backend Live Logs Stream (Ctrl+C to stop)      ' -ForegroundColor Cyan; Write-Host '===========================================================' -ForegroundColor Cyan; docker logs -f $ContainerName"
Write-Host ""
