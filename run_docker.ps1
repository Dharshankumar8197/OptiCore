# OptiCore Docker Desktop Launcher
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "       OptiCore Docker Desktop Launcher      " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Test if Docker daemon is running
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] Docker Desktop is not running." -ForegroundColor Yellow
        Write-Host "    Please launch Docker Desktop from the Start menu and wait for the whale icon to turn green." -ForegroundColor Yellow
        Write-Host "    Then run this script again: .\run_docker.ps1`n" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "[!] Docker CLI not found or failed to execute." -ForegroundColor Red
    exit 1
}

Write-Host "[+] Docker Desktop is active." -ForegroundColor Green
Write-Host "[*] Building and starting OptiCore containers (Web, Backend, Ngrok)..." -ForegroundColor Cyan

docker compose up --build
