# ==============================================================================
#  OptiCore Live Container Logs Viewer
#  Usage:
#    .\logs.ps1             # Stream logs in current terminal
#    .\logs.ps1 -NewWindow  # Pop open in a separate dedicated PowerShell window
# ==============================================================================

param(
    [string]$ContainerName = "opticore-backend",
    [switch]$NewWindow
)

if ($NewWindow) {
    Write-Host "[*] Opening live logs in a separate PowerShell window..." -ForegroundColor Cyan
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'OptiCore Backend Logs'; Write-Host '===========================================================' -ForegroundColor Cyan; Write-Host '   OptiCore Backend Live Logs Stream (Ctrl+C to stop)      ' -ForegroundColor Cyan; Write-Host '===========================================================' -ForegroundColor Cyan; docker logs -f $ContainerName"
} else {
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host "   OptiCore Backend Live Logs Stream (Ctrl+C to stop)      " -ForegroundColor Cyan
    Write-Host "===========================================================" -ForegroundColor Cyan
    docker logs -f $ContainerName
}
