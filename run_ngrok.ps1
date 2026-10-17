# OptiCore Ngrok Tunnel Launcher
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "         OptiCore Ngrok Tunnel Launcher      " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Check if ngrok is available
try {
    $version = ngrok --version
    Write-Host "[+] Found $version" -ForegroundColor Green
} catch {
    Write-Host "[!] ngrok command not found in PATH." -ForegroundColor Red
    exit 1
}

Write-Host "`n[*] Starting HTTPS tunnels for Web (:3000) and Backend (:8000)..." -ForegroundColor Cyan
Write-Host "[*] Open http://127.0.0.1:4040 to view live tunnel URLs and request logs.`n" -ForegroundColor Yellow

ngrok start --config .\ngrok.yml --all
