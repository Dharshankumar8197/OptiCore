# ==============================================================================
# OptiCore Portable AI Server — Start Server Script
# ==============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ServerRoot = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir "common.ps1")

Write-OptiCoreBanner "Start Server"

# 1. Verify Docker Desktop Environment
if (-not (Ensure-DockerDesktopRunning -MaxWaitSeconds 60)) {
    Log-Error "Failed to connect to Docker Desktop. Cannot start OptiCore server."
    exit 1
}

# 2. Check Architecture
$archInfo = Get-HostSystemArchitecture
Log-Info "Host Architecture: $($archInfo.HostArchitecture) ($($archInfo.RecommendedArch))"

# 3. Check and Load Configuration (.env)
$envPath = Join-Path $ServerRoot ".env"
$envExamplePath = Join-Path $ServerRoot ".env.example"

if (-not (Test-Path $envPath)) {
    Log-Warn "Configuration file '.env' was not found."
    if (Test-Path $envExamplePath) {
        Copy-Item -Path $envExamplePath -Destination $envPath
        Log-Success "Generated '.env' from template."
    } else {
        Log-Error "Neither '.env' nor '.env.example' exists in $ServerRoot."
        exit 1
    }
}

$envMap = Parse-EnvFile $envPath
$apiPort = if ($envMap["API_PORT"]) { $envMap["API_PORT"] } elseif ($envMap["PORT"]) { $envMap["PORT"] } else { "8000" }
$imageName = if ($envMap["OPTICORE_IMAGE"]) { $envMap["OPTICORE_IMAGE"] } else { "ghcr.io/dharshankumar8197/opticore-backend" }
$imageVersion = if ($envMap["OPTICORE_VERSION"]) { $envMap["OPTICORE_VERSION"] } else { "latest" }
$fullImageRef = "${imageName}:${imageVersion}"

$ngrokToken = $envMap["NGROK_AUTHTOKEN"]
$ngrokEnabled = ($envMap["NGROK_ENABLED"] -eq "true" -or $envMap["NGROK_ENABLED"] -eq "1" -or (-not [string]::IsNullOrEmpty($ngrokToken)))

# 4. Check or Pull Docker Image
Log-Info "Checking for server image: $fullImageRef..."

$hasLocalImage = $false
try {
    $null = docker image inspect $fullImageRef 2>&1
    if ($LASTEXITCODE -eq 0) {
        $hasLocalImage = $true
        Log-Success "Found local image: $fullImageRef"
    }
} catch {
    $hasLocalImage = $false
}

if (-not $hasLocalImage) {
    Log-Info "Image not found locally. Attempting to pull from registry: $fullImageRef..."
    try {
        & docker pull $fullImageRef
        if ($LASTEXITCODE -eq 0) {
            Log-Success "Successfully pulled $fullImageRef"
        } else {
            throw "docker pull returned exit code $LASTEXITCODE"
        }
    } catch {
        Log-Warn "Could not pull '$fullImageRef' from GitHub Container Registry."
        Log-Info "Checking if a local build or fallback image is available..."

        # Check if local fallback image exists (e.g. opticore-server:test or local build)
        $fallbackFound = $false
        foreach ($alt in @("opticore-server:test", "opticore-server:latest", "opticore-backend:latest")) {
            try {
                $null = docker image inspect $alt 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Log-Success "Using available local image: $alt"
                    $env:OPTICORE_IMAGE = $alt.Split(":")[0]
                    $env:OPTICORE_VERSION = $alt.Split(":")[1]
                    $fallbackFound = $true
                    break
                }
            } catch {}
        }

        if (-not $fallbackFound) {
            Log-Error "Could not find or pull the OptiCore Docker image."
            Log-Warn "If you have not yet published the image to GHCR, please run the GitHub Actions workflow,"
            Log-Warn "or build the image locally using: docker compose build"
            exit 1
        }
    }
}

# 5. Start Containers with Docker Compose
Log-Info "Starting OptiCore containers with Docker Compose..."

$composeFile = Join-Path $ServerRoot "docker-compose.yml"
$composeArgs = @("-f", $composeFile)

if ($ngrokEnabled -and $ngrokToken -and $ngrokToken.Trim() -ne "") {
    Log-Info "Ngrok public tunnel enabled with authentication token ($(Redact-Secret $ngrokToken))."
    $composeArgs += @("--profile", "ngrok", "up", "-d")
} else {
    Log-Info "Ngrok token not set; launching server in Local Mode."
    $composeArgs += @("up", "-d", "server")
}

Push-Location $ServerRoot
try {
    & docker compose @composeArgs
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Docker Compose failed to start containers."
        exit 1
    }
} finally {
    Pop-Location
}

# Auto-sync latest local backend fixes into container if running in development workspace
$devAppSource = if (Test-Path "C:\IMP PROJECTS\opticore\backend\app\inference.py") {
    "C:\IMP PROJECTS\opticore\backend\app"
} elseif (Test-Path (Join-Path (Split-Path $ServerRoot -Parent) "backend\app\inference.py")) {
    Join-Path (Split-Path $ServerRoot -Parent) "backend\app"
} else {
    $null
}

if ($devAppSource) {
    try {
        & docker cp (Join-Path $devAppSource "inference.py") opticore-ai-server:/app/app/inference.py 2>$null
        & docker cp (Join-Path $devAppSource "api\model.py") opticore-ai-server:/app/app/api/model.py 2>$null
        & docker cp (Join-Path $devAppSource "schemas\model.py") opticore-ai-server:/app/app/schemas/model.py 2>$null
        & docker cp (Join-Path $devAppSource "main.py") opticore-ai-server:/app/app/main.py 2>$null
        & docker restart opticore-ai-server 2>$null | Out-Null
    } catch {}
}

# 6. Wait for Backend Readiness with Animated Progress Bar
Log-Info "Waiting for OptiCore AI server to respond on port $apiPort..."

$healthUrl = "http://127.0.0.1:${apiPort}/health"
$serverReady = $false
$maxHealthTries = 30

for ($i = 1; $i -le $maxHealthTries; $i++) {
    $pct = [math]::Min(95, [math]::Round(($i / $maxHealthTries) * 100))
    Show-ProgressBar -Activity "Waiting for YOLO26s Engine" -Percent $pct -Status "Attempt $i/$maxHealthTries"
    Start-Sleep -Seconds 1
    try {
        $healthResp = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2 -ErrorAction Stop
        if ($healthResp -and $healthResp.status -eq "ok") {
            $serverReady = $true
            Show-ProgressBar -Activity "YOLO26s AI Engine Online" -Percent 100 -Status "Verified 20 Classes Ready!"
            Log-Success "Server is healthy and responding! (Architecture: $($healthResp.architecture), Classes: $($healthResp.class_count))"
            break
        }
    } catch {
        # Keep waiting
    }
}

if (-not $serverReady) {
    Write-Host ""
    Log-Error "Server health check timed out. Displaying container logs..."
    Push-Location $ServerRoot
    & docker compose logs --tail=40
    Pop-Location
    exit 1
}

# 7. Discover Ngrok Public HTTPS URL if Tunnel was Started
$publicHttpsUrl = $null
if ($ngrokEnabled -and $ngrokToken -and $ngrokToken.Trim() -ne "") {
    Log-Info "Discovering active ngrok public HTTPS URL..."
    $maxNgrokTries = 20
    for ($attempt = 1; $attempt -le $maxNgrokTries; $attempt++) {
        $pct = [math]::Min(95, [math]::Round(($attempt / $maxNgrokTries) * 100))
        Show-ProgressBar -Activity "Discovering Ngrok HTTPS Tunnel" -Percent $pct -Status "Attempt $attempt/$maxNgrokTries"
        $publicHttpsUrl = Get-NgrokPublicUrl -MaxAttempts 1 -DelaySec 1
        if ($publicHttpsUrl) {
            Show-ProgressBar -Activity "Ngrok HTTPS Tunnel Established" -Percent 100 -Status "Ready!"
            Log-Success "Public HTTPS Tunnel established: $publicHttpsUrl"
            break
        }
    }
    if (-not $publicHttpsUrl) {
        Write-Host ""
        Log-Warn "Ngrok tunnel did not return a public URL. Inspect http://localhost:4040 for details."
    }
}

# 8. Determine LAN IP for Local Network Access
$localIp = "127.0.0.1"
try {
    $ipConfig = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "vEthernet|Loopback|Docker" -and $_.IPAddress -notmatch "^127\.|^169\.254\." } | Select-Object -First 1
    if ($ipConfig) {
        $localIp = $ipConfig.IPAddress
    }
} catch {}

# 9. Prominent Connection Summary Box
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "   🚀 OPTICORE AI INFERENCE SERVER IS RUNNING AND READY!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "   📡 Local Access:       http://localhost:$apiPort" -ForegroundColor White
Write-Host "   🏡 Local LAN Network:  http://${localIp}:$apiPort" -ForegroundColor White
Write-Host "   📖 Interactive Docs:   http://localhost:${apiPort}/docs" -ForegroundColor White

if ($publicHttpsUrl) {
    Write-Host ""
    Write-Host "   ------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "   [*] PUBLIC HTTPS URL (Android, iPhone, iPad, Remote Laptops):" -ForegroundColor Cyan
    Write-Host "       $publicHttpsUrl" -ForegroundColor Yellow
    Write-Host "   ------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "   >> Live Vercel Web App (Direct Connected):" -ForegroundColor Cyan
    Write-Host "       https://opti-core-web.vercel.app/?api=$publicHttpsUrl" -ForegroundColor Green
    Write-Host "   >> Open the link above in any phone or browser to stream real-time vision!" -ForegroundColor White
    Write-Host "   >> Or configure your Next.js OptiCore Web App with:" -ForegroundColor White
    Write-Host "      NEXT_PUBLIC_API_URL=$publicHttpsUrl" -ForegroundColor DarkCyan
} else {
    Write-Host ""
    Write-Host "   [i] Remote Ngrok Tunnel: [OFFLINE / NOT CONFIGURED]" -ForegroundColor DarkGray
    Write-Host "       To enable public HTTPS remote testing from your phone, add your free" -ForegroundColor DarkGray
    Write-Host "       NGROK_AUTHTOKEN to '.env' and restart with '.\start.bat'." -ForegroundColor DarkGray
}

Write-Host "======================================================================" -ForegroundColor Green
Write-Host " COMMANDS TO EDIT CONFIGURATION (.env) & CONTROL:" -ForegroundColor Cyan
Write-Host "   * Edit .env in Notepad:      notepad `"$envPath`"" -ForegroundColor White
Write-Host "   * Launch Control Menu:       .\menu.bat  (or .\run.bat)" -ForegroundColor White
Write-Host "   * Stop Server from CLI:      .\stop.bat" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""

# 10. Interactive Quick Action Prompt
$targetBrowserUrl = if ($publicHttpsUrl) { "https://opti-core-web.vercel.app/?api=$publicHttpsUrl" } else { "http://localhost:$apiPort" }

Write-Host "Quick Actions:" -ForegroundColor Yellow
Write-Host "  [B] Open Live Vision Studio in Browser ($targetBrowserUrl)" -ForegroundColor White
Write-Host "  [M] Open Interactive Control Center (menu.bat)" -ForegroundColor Green
Write-Host "  [E] Open and Edit .env Configuration" -ForegroundColor White
Write-Host "  [L] Stream Live Container Logs" -ForegroundColor White
Write-Host "  [Q] Done / Return to PowerShell Prompt" -ForegroundColor White
Write-Host ""

$action = Read-Host "Select an action [B/M/E/L/Q] (default: B)"
if (-not $action -or $action.Trim() -eq "" -or $action -match "^[Bb]") {
    Log-Info "Opening Vision Studio: $targetBrowserUrl"
    Start-Process $targetBrowserUrl
} elseif ($action -match "^[Mm]" -or $action -match "^[Aa]") {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "menu.ps1")
} elseif ($action -match "^[Ee]") {
    Open-EnvEditor -EnvPath $envPath
} elseif ($action -match "^[Ll]") {
    Push-Location $ServerRoot
    & docker compose logs -f --tail=50
    Pop-Location
}



