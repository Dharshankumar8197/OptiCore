# ==============================================================================
# OptiCore Portable AI Server — Windows Installer Script
# ==============================================================================

param(
    [string]$DestinationPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$PackageRoot = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir "common.ps1")

Write-OptiCoreBanner "Windows Installer"

# 1. Determine Target Directory
if (-not $DestinationPath -or $DestinationPath.Trim() -eq "") {
    $defaultDest = Join-Path $env:USERPROFILE "OptiCoreServer"
    Write-Host "Select installation folder for OptiCore Portable Server." -ForegroundColor White
    Write-Host "Default location: $defaultDest" -ForegroundColor DarkGray
    $userInput = Read-Host "Enter destination directory [Press Enter for default]"
    if ($userInput -and $userInput.Trim() -ne "") {
        $DestinationPath = $userInput.Trim()
    } else {
        $DestinationPath = $defaultDest
    }
}

# Resolve full path safely (handles spaces and relative notation)
$DestinationPath = [System.IO.Path]::GetFullPath($DestinationPath)
Log-Info "Installation target: '$DestinationPath'"

# 2. Create Destination Folder
if (-not (Test-Path $DestinationPath)) {
    Log-Info "Creating installation directory: '$DestinationPath'..."
    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
    Log-Success "Directory created."
} else {
    Log-Info "Using existing directory: '$DestinationPath'"
}

# Ensure persistent subdirectories exist
$modelsDir = Join-Path $DestinationPath "models"
$dataDir = Join-Path $DestinationPath "data"
$scriptsDir = Join-Path $DestinationPath "scripts"

New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null

# 3. Handle Configuration (.env) Preservation & Creation
$destEnv = Join-Path $DestinationPath ".env"
$srcEnvExample = Join-Path $PackageRoot ".env.example"

if (Test-Path $destEnv) {
    # Backup existing configuration
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupEnv = Join-Path $DestinationPath ".env.backup.$timestamp"
    Copy-Item -Path $destEnv -Destination $backupEnv -Force
    Log-Success "Preserved existing '.env'. Backup created at '.env.backup.$timestamp'"
} else {
    if (Test-Path $srcEnvExample) {
        Copy-Item -Path $srcEnvExample -Destination $destEnv
        Log-Success "Created initial '.env' from template."
    } else {
        Log-Warn "Template '.env.example' not found; will create minimal configuration."
        @"
OPTICORE_IMAGE=ghcr.io/dharshankumar8197/opticore-backend
OPTICORE_VERSION=latest
PORT=8000
API_PORT=8000
MODEL_PATH=./models/best.pt
CONFIDENCE_THRESHOLD=0.50
IOU_THRESHOLD=0.45
IMAGE_SIZE=640
NGROK_AUTHTOKEN=
NGROK_ENABLED=true
AUTH_REQUIRED=false
"@ | Set-Content -Path $destEnv -Encoding UTF8
    }
}

# 4. Copy Package Files if Installing to an External Folder
if ($PackageRoot -ne $DestinationPath) {
    Log-Info "Deploying portable server package files..."
    Show-ProgressBar -Activity "Deploying Package Files" -Percent 20 -Status "Copying launchers..."

    # Copy Launchers
    $launchers = @("menu.bat", "run.bat", "brain.bat", "install.bat", "start.bat", "stop.bat", "status.bat", "update.bat", "uninstall.bat", "docker-compose.yml", "README.md", ".env.example", "checksums.txt")
    foreach ($item in $launchers) {
        $srcPath = Join-Path $PackageRoot $item
        if (Test-Path $srcPath) {
            Copy-Item -Path $srcPath -Destination (Join-Path $DestinationPath $item) -Force
        }
    }

    Show-ProgressBar -Activity "Deploying Package Files" -Percent 65 -Status "Deploying scripts..."
    # Copy Scripts
    Copy-Item -Path (Join-Path $PackageRoot "scripts\*") -Destination $scriptsDir -Recurse -Force
    Show-ProgressBar -Activity "Deploying Package Files" -Percent 100 -Status "Complete!"
    Log-Success "Package files successfully deployed."
}

# 5. Check Host Architecture & Docker Desktop Status
$archInfo = Get-HostSystemArchitecture
Log-Info "Host Architecture: $($archInfo.HostArchitecture) ($($archInfo.RecommendedArch))"

if (Test-DockerCli) {
    if (Test-DockerDaemon) {
        Log-Success "Docker Desktop is active and ready."
    } else {
        Log-Warn "Docker Desktop is installed but daemon is not running."
        Log-Info "start.bat will automatically attempt to launch Docker Desktop when needed."
    }
} else {
    Log-Warn "Docker Desktop was not found on this system."
    Log-Warn "Please install Docker Desktop before running start.bat: https://www.docker.com/products/docker-desktop/"
}

# 6. Validate Configuration
$envValues = Parse-EnvFile $destEnv
$ngrokToken = $envValues["NGROK_AUTHTOKEN"]

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "   [SUCCESS] OptiCore Portable Server successfully installed!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host " Installation Path: '$DestinationPath'" -ForegroundColor White
Write-Host " Configuration:     '$destEnv'" -ForegroundColor White
if (-not $ngrokToken -or $ngrokToken.Trim() -eq "") {
    Write-Host " Ngrok AuthToken:   [NOT CONFIGURED] - Server will run in Local Mode." -ForegroundColor Yellow
    Write-Host "                    To enable public HTTPS for Android/iPhone camera access," -ForegroundColor Yellow
    Write-Host "                    add your free token into '$destEnv'." -ForegroundColor Yellow
} else {
    Write-Host " Ngrok AuthToken:   Configured ($(Redact-Secret $ngrokToken))" -ForegroundColor Cyan
}
Write-Host ""
Write-Host " COMMANDS TO EDIT CONFIGURATION (.env) & MANAGE:" -ForegroundColor Cyan
Write-Host "   * Edit .env in Notepad:      notepad `"$destEnv`"" -ForegroundColor White
Write-Host "   * Launch Control Menu:       cd `"$DestinationPath`" ; .\menu.bat" -ForegroundColor White
Write-Host "   * Start Server from CLI:     cd `"$DestinationPath`" ; .\start.bat" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""

# 7. Post-Installation Interactive Actions
Write-Host "Quick Actions:" -ForegroundColor Yellow
Write-Host "  [1] Open Interactive Control Center (menu.bat) [Recommended]" -ForegroundColor White
Write-Host "  [2] Start OptiCore AI Server immediately (start.bat)" -ForegroundColor White
Write-Host "  [3] Open and edit .env in Notepad to configure Ngrok token" -ForegroundColor White
Write-Host "  [0] Exit to PowerShell prompt" -ForegroundColor White
Write-Host ""

$postChoice = Read-Host "Select an action [1/2/3/0] (default: 1)"
if (-not $postChoice -or $postChoice.Trim() -eq "" -or $postChoice.Trim() -eq "1") {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $DestinationPath "scripts\menu.ps1")
} elseif ($postChoice.Trim() -eq "2") {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $DestinationPath "scripts\start.ps1")
} elseif ($postChoice.Trim() -eq "3") {
    Open-EnvEditor -EnvPath $destEnv
}

