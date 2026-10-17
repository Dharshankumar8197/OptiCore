# ==============================================================================
#  OptiCore Environment Editor (PowerShell)
#  Usage:
#    .\open_env.ps1          # Opens both backend and web environment files
#    .\open_env.ps1 backend  # Opens backend\.env
#    .\open_env.ps1 web      # Opens web\.env.local
# ==============================================================================

param(
    [ValidateSet("all", "backend", "web", "root")]
    [string]$Target = "all"
)

$rootDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($rootDir) -and $MyInvocation.MyCommand -and $MyInvocation.MyCommand.Path) {
    $rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if ([string]::IsNullOrEmpty($rootDir)) { $rootDir = (Get-Location).Path }

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "         OptiCore Environment Configuration               " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan

# Determine editor (prefer VS Code, fallback to Notepad)
$editor = "notepad.exe"
if (Get-Command code -ErrorAction SilentlyContinue) {
    $editor = "code"
}

# 1. Root / Backend .env
$backendEnv = Join-Path $rootDir "backend\.env"
$backendExample = Join-Path $rootDir "backend\.env.example"
$rootEnv = Join-Path $rootDir ".env"
$rootExample = Join-Path $rootDir ".env.example"

if (-not (Test-Path $backendEnv)) {
    if (Test-Path $backendExample) {
        Copy-Item -Path $backendExample -Destination $backendEnv
        Write-Host "[+] Created backend\.env from template" -ForegroundColor Green
    }
}

if (-not (Test-Path $rootEnv)) {
    if (Test-Path $rootExample) {
        Copy-Item -Path $rootExample -Destination $rootEnv
        Write-Host "[+] Created root .env from template" -ForegroundColor Green
    }
}

# 2. Web .env.local
$webEnv = Join-Path $rootDir "web\.env.local"
if (-not (Test-Path $webEnv)) {
    $defaultWebEnv = @"
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
"@
    Set-Content -Path $webEnv -Value $defaultWebEnv
    Write-Host "[+] Created web\.env.local" -ForegroundColor Green
}

# Launch editor for requested targets
$opened = @()

if ($Target -eq "all" -or $Target -eq "backend") {
    Write-Host "[*] Opening backend\.env with $editor..." -ForegroundColor Cyan
    Start-Process -FilePath $editor -ArgumentList "`"$backendEnv`""
    $opened += "backend\.env"
}

if ($Target -eq "all" -or $Target -eq "web") {
    Write-Host "[*] Opening web\.env.local with $editor..." -ForegroundColor Cyan
    Start-Process -FilePath $editor -ArgumentList "`"$webEnv`""
    $opened += "web\.env.local"
}

if ($Target -eq "root") {
    Write-Host "[*] Opening root .env with $editor..." -ForegroundColor Cyan
    Start-Process -FilePath $editor -ArgumentList "`"$rootEnv`""
    $opened += ".env"
}

Write-Host "`n[+] Environment files ready: $($opened -join ', ')" -ForegroundColor Green
Write-Host "Note: SQLite requires NO credentials; it auto-initializes in ./data/opticore.db." -ForegroundColor Yellow
Write-Host "Set NGROK_AUTHTOKEN in your environment or backend\.env for remote access.`n" -ForegroundColor White
