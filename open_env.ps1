# ==============================================================================
#  OptiCore Environment Configuration Editor (PowerShell)
#  Usage:
#    .\open_env.ps1          # Opens active environment file
#    .\open_env.ps1 backend  # Opens backend\.env
#    .\open_env.ps1 web      # Opens web\.env.local
#    irm https://raw.githubusercontent.com/Dharshankumar8197/OptiCore/main/open_env.ps1 | iex
# ==============================================================================

param(
    [ValidateSet("all", "backend", "web", "root")]
    [string]$Target = "all"
)

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "         OptiCore Environment Configuration               " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan

# Determine editor (prefer VS Code, fallback to Notepad)
$editor = "notepad.exe"
if (Get-Command code -ErrorAction SilentlyContinue) {
    $editor = "code"
}

$rootDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($rootDir) -and $MyInvocation.MyCommand -and $MyInvocation.MyCommand.Path) {
    $rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if ([string]::IsNullOrEmpty($rootDir)) { $rootDir = (Get-Location).Path }

$opticoreHome = Join-Path $HOME ".opticore"
$opticoreEnv = Join-Path $opticoreHome ".env"
$backendEnv = Join-Path $rootDir "backend\.env"
$webEnv = Join-Path $rootDir "web\.env.local"
$rootEnv = Join-Path $rootDir ".env"

$opened = @()

# If running in local repository folder
if ((Test-Path $backendEnv) -or (Test-Path (Join-Path $rootDir "backend"))) {
    if ($Target -eq "all" -or $Target -eq "backend") {
        Write-Host "[*] Opening backend\.env with $editor..." -ForegroundColor Cyan
        Start-Process $editor "`"$backendEnv`""
        $opened += "backend\.env"
    }

    if ($Target -eq "all" -or $Target -eq "web") {
        if (Test-Path (Join-Path $rootDir "web")) {
            if (-not (Test-Path $webEnv)) {
                $defaultWeb = "NEXT_PUBLIC_API_URL=http://localhost:8000`nNEXT_PUBLIC_WS_URL=ws://localhost:8000"
                Set-Content -Path $webEnv -Value $defaultWeb -Force
            }
            Write-Host "[*] Opening web\.env.local with $editor..." -ForegroundColor Cyan
            Start-Process $editor "`"$webEnv`""
            $opened += "web\.env.local"
        }
    }
} else {
    # Standalone machine mode: open $HOME\.opticore\.env
    if (-not (Test-Path $opticoreHome)) {
        New-Item -ItemType Directory -Path $opticoreHome -Force | Out-Null
    }
    if (-not (Test-Path $opticoreEnv)) {
        $defaultConfig = @"
# OptiCore Standalone Backend Configuration
APP_NAME=OptiCore
ENVIRONMENT=production
HOST=0.0.0.0
PORT=8000
NGROK_AUTHTOKEN=
CONFIDENCE_THRESHOLD=0.50
IOU_THRESHOLD=0.45
IMAGE_SIZE=640
DATABASE_URL=sqlite:///./data/opticore.db
JWT_SECRET_KEY=opticore-secret-$(Get-Random)-production
"@
        Set-Content -Path $opticoreEnv -Value $defaultConfig -Force
        Write-Host "[+] Created configuration file at $opticoreEnv" -ForegroundColor Green
    }

    Write-Host "[*] Opening $opticoreEnv with $editor..." -ForegroundColor Cyan
    Start-Process $editor "`"$opticoreEnv`""
    $opened += $opticoreEnv
}

Write-Host "`n[+] Environment editor launched for: $($opened -join ', ')" -ForegroundColor Green
Write-Host "Tip: Edit your NGROK_AUTHTOKEN, save the file, and restart the backend anytime." -ForegroundColor Yellow
Write-Host ""
