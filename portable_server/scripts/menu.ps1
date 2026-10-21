# ==============================================================================
# OptiCore Portable AI Server — Interactive PowerShell Control Center
# ==============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ServerRoot = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir "common.ps1")

$envPath = Join-Path $ServerRoot ".env"
$composeFile = Join-Path $ServerRoot "docker-compose.yml"

# Auto-create .env from .env.example if missing
if (-not (Test-Path $envPath)) {
    $envEx = Join-Path $ServerRoot ".env.example"
    if (Test-Path $envEx) {
        Copy-Item -Path $envEx -Destination $envPath
    }
}

function Clear-And-ShowDashboard {
    Clear-Host
    Write-OptiCoreBanner "Interactive Control Center"

    $envMap = Parse-EnvFile $envPath
    $port = if ($envMap["API_PORT"]) { [int]$envMap["API_PORT"] } elseif ($envMap["PORT"]) { [int]$envMap["PORT"] } else { 8000 }
    $live = Get-ServerLiveStatus -Port $port
    $arch = Get-HostSystemArchitecture

    $ngrokToken = $envMap["NGROK_AUTHTOKEN"]
    $ngrokEnabled = ($envMap["NGROK_ENABLED"] -eq "true" -or $envMap["NGROK_ENABLED"] -eq "1")
    $groqKey = $envMap["GROQ_API_KEY"]
    $conf = if ($envMap["CONFIDENCE_THRESHOLD"]) { $envMap["CONFIDENCE_THRESHOLD"] } else { "0.50" }

    # Render Live System Status Card
    Write-Host "+----------------------------------------------------------------------+" -ForegroundColor DarkCyan
    Write-Host "| SYSTEM STATUS DASHBOARD                                              |" -ForegroundColor Cyan
    Write-Host "+----------------------------------------------------------------------+" -ForegroundColor DarkCyan
    
    # Docker Desktop
    $dockerText = if ($live.DockerRunning) { "[ACTIVE]" } else { "[STOPPED]" }
    $dockerColor = if ($live.DockerRunning) { "Green" } else { "Red" }
    Write-Host "  * Docker Desktop Engine: " -NoNewline -ForegroundColor White
    Write-Host "$dockerText" -ForegroundColor $dockerColor

    # AI Server
    $serverText = if ($live.BackendOnline) { "[ONLINE - Port $port]" } else { "[OFFLINE]" }
    $serverColor = if ($live.BackendOnline) { "Green" } else { "DarkGray" }
    Write-Host "  * OptiCore AI Backend:   " -NoNewline -ForegroundColor White
    Write-Host "$serverText" -ForegroundColor $serverColor

    # YOLO26s Model
    if ($live.ModelLoaded) {
        Write-Host "  * YOLO26s AI Engine:     " -NoNewline -ForegroundColor White
        Write-Host "[READY - 20 Classes Verified]" -ForegroundColor Green
    } else {
        Write-Host "  * YOLO26s AI Engine:     " -NoNewline -ForegroundColor White
        Write-Host "[STANDBY / NOT RUNNING]" -ForegroundColor DarkGray
    }

    # Ngrok Tunnel
    if ($live.PublicUrl) {
        Write-Host "  * Ngrok HTTPS Tunnel:    " -NoNewline -ForegroundColor White
        Write-Host "$($live.PublicUrl)" -ForegroundColor Yellow
    } else {
        $tunnelState = if ($ngrokEnabled -and $ngrokToken -and $ngrokToken.Trim() -ne "") { "[ENABLED - Starting or Connecting...]" } elseif ($ngrokEnabled) { "[ENABLED - Awaiting NGROK_AUTHTOKEN]" } else { "[DISABLED / LOCAL ONLY]" }
        Write-Host "  * Ngrok HTTPS Tunnel:    " -NoNewline -ForegroundColor White
        Write-Host "$tunnelState" -ForegroundColor DarkGray
    }

    # Groq LLaMA 3.3 Scene Assistant
    if ($groqKey -and $groqKey.Trim() -ne "") {
        Write-Host "  * Groq Scene Narration:  " -NoNewline -ForegroundColor White
        Write-Host "[ENABLED - $(Redact-Secret $groqKey)]" -ForegroundColor Green
    } else {
        Write-Host "  * Groq Scene Narration:  " -NoNewline -ForegroundColor White
        Write-Host "[DISABLED / OPTIONAL - Local Rule-Based Safety Active]" -ForegroundColor DarkGray
    }

    # Detection Sensitivity
    Write-Host "  * Detection Sensitivity: " -NoNewline -ForegroundColor White
    $confLabel = if ([double]$conf -lt 0.40) { "$conf (Sensitive)" } elseif ([double]$conf -gt 0.60) { "$conf (Strict)" } else { "$conf (Balanced)" }
    Write-Host "$confLabel" -ForegroundColor Cyan

    # Host Architecture
    Write-Host "  * Hardware Architecture: " -NoNewline -ForegroundColor White
    Write-Host "$($arch.HostArchitecture) ($($arch.RecommendedArch))" -ForegroundColor DarkCyan
    Write-Host "+----------------------------------------------------------------------+" -ForegroundColor DarkCyan
    Write-Host ""

    # Interactive Menu Selection
    $ngrokToggleStatus = if ($ngrokEnabled) { "[ON] -> Turn OFF" } else { "[OFF] -> Turn ON" }

    Write-Host " [1 / S] " -NoNewline -ForegroundColor Cyan; Write-Host "Start AI Server & Tunnel" -ForegroundColor White
    Write-Host " [2 / X] " -NoNewline -ForegroundColor Cyan; Write-Host "Stop AI Server & Tunnel" -ForegroundColor White
    Write-Host " [3 / R] " -NoNewline -ForegroundColor Cyan; Write-Host "Restart AI Server (Reload Model & Settings)" -ForegroundColor White
    Write-Host " [4 / T] " -NoNewline -ForegroundColor Yellow; Write-Host "Toggle Ngrok HTTPS Tunnel (Current: $ngrokToggleStatus)" -ForegroundColor Yellow
    Write-Host " [5 / C] " -NoNewline -ForegroundColor Yellow; Write-Host "Cycle Detection Sensitivity (Current: $conf -> 0.35 / 0.50 / 0.70)" -ForegroundColor White
    Write-Host " [6 / E] " -NoNewline -ForegroundColor Yellow; Write-Host "Open & Edit .env Configuration (in Notepad)" -ForegroundColor Yellow
    Write-Host " [7 / K] " -NoNewline -ForegroundColor Yellow; Write-Host "Set / Paste Ngrok Authtoken directly" -ForegroundColor White
    Write-Host " [8 / B] " -NoNewline -ForegroundColor Green; Write-Host "Open Web Vision Studio in Default Browser" -ForegroundColor Green
    Write-Host " [9 / L] " -NoNewline -ForegroundColor Cyan; Write-Host "Stream Live Container Logs (Ctrl+C to return)" -ForegroundColor White
    Write-Host " [D]     " -NoNewline -ForegroundColor Cyan; Write-Host "Server Diagnostics & Live Health Check" -ForegroundColor White
    Write-Host " [V]     " -NoNewline -ForegroundColor Cyan; Write-Host "Run 17-Point Automated Verification Suite" -ForegroundColor White
    Write-Host " [U]     " -NoNewline -ForegroundColor Cyan; Write-Host "Pull Latest Docker Image from GHCR" -ForegroundColor White
    Write-Host " [0 / Q] " -NoNewline -ForegroundColor Red; Write-Host "Exit Control Center" -ForegroundColor Red
    Write-Host ""

    # Prominent PowerShell & Terminal Commands Reference Box
    Write-Host "======================================================================" -ForegroundColor DarkCyan
    Write-Host " COMMANDS TO EDIT CONFIGURATION & CONTROL FROM POWERSHELL:" -ForegroundColor Cyan
    Write-Host "   * Edit .env in Notepad:      notepad `"$envPath`"" -ForegroundColor White
    Write-Host "   * Edit .env in VS Code:      code `"$envPath`"" -ForegroundColor White
    Write-Host "   * Start Server from CLI:     .\start.bat" -ForegroundColor White
    Write-Host "   * Stop Server from CLI:      .\stop.bat" -ForegroundColor White
    Write-Host "   * Launch Control Menu:       .\menu.bat  (or .\run.bat)" -ForegroundColor White
    Write-Host "   * Check Health via cURL:     curl.exe http://localhost:$port/health" -ForegroundColor White
    Write-Host "   * Ngrok Local Dashboard:     http://localhost:4040" -ForegroundColor White
    Write-Host "======================================================================" -ForegroundColor DarkCyan
    Write-Host ""
}

# ── Interactive Menu Loop ──────────────────────────────────────────────────────
$keepRunning = $true

while ($keepRunning) {
    Clear-And-ShowDashboard

    $choice = Read-Host "Select an option [0-9, S, X, R, T, C, E, K, B, L, D, V, U, Q]"
    if (-not $choice) { continue }
    $choice = $choice.Trim()

    switch -Regex ($choice) {
        "^(1|[Ss])$" {
            Write-Host ""
            Log-Info "Starting OptiCore AI Server..."
            $startScript = Join-Path $ScriptDir "start.ps1"
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startScript
            Write-Host ""
            Read-Host "Press Enter to return to menu"
        }

        "^(2|[Xx])$" {
            Write-Host ""
            Log-Info "Stopping OptiCore AI Server..."
            Show-ProgressBar -Activity "Stopping Containers" -Percent 30 -Status "Sending stop signal..."
            $stopScript = Join-Path $ScriptDir "stop.ps1"
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stopScript
            Show-ProgressBar -Activity "Containers Stopped" -Percent 100 -Status "Cleaned up!"
            Write-Host ""
            Read-Host "Press Enter to return to menu"
        }

        "^(3|[Rr])$" {
            Write-Host ""
            Log-Info "Restarting OptiCore AI Server..."
            Show-ProgressBar -Activity "Stopping Containers" -Percent 25 -Status "Shutting down..."
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "stop.ps1")
            Show-ProgressBar -Activity "Restarting Containers" -Percent 60 -Status "Starting server..."
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "start.ps1")
            Show-ProgressBar -Activity "Server Restart Complete" -Percent 100 -Status "Ready!"
            Write-Host ""
            Read-Host "Press Enter to return to menu"
        }

        "^(4|[Tt])$" {
            $newVal = Toggle-EnvSetting -EnvPath $envPath -SettingKey "NGROK_ENABLED" -DefaultValue "true"
            Write-Host ""
            if ($newVal -eq "true") {
                Log-Success "Ngrok Public Tunnel set to: [ENABLED]"
                $envMap = Parse-EnvFile $envPath
                if (-not $envMap["NGROK_AUTHTOKEN"] -or $envMap["NGROK_AUTHTOKEN"].Trim() -eq "") {
                    Log-Warn "Notice: NGROK_AUTHTOKEN is currently blank in your .env file."
                    $setTokenNow = Read-Host "Would you like to enter your Ngrok token now? (Y/N)"
                    if ($setTokenNow -match "^[Yy]") {
                        $tokenInput = Read-Host "Paste your Ngrok Authtoken"
                        if ($tokenInput -and $tokenInput.Trim() -ne "") {
                            Set-EnvValue -EnvPath $envPath -Key "NGROK_AUTHTOKEN" -Value ($tokenInput.Trim())
                            Log-Success "Ngrok token saved!"
                        }
                    }
                }
            } else {
                Log-Warn "Ngrok Public Tunnel set to: [DISABLED] (Local Mode)"
            }

            $live = Get-ServerLiveStatus
            if ($live.BackendOnline) {
                $restart = Read-Host "Server is running. Restart now to apply tunnel change? (Y/N)"
                if ($restart -match "^[Yy]") {
                    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "stop.ps1")
                    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "start.ps1")
                }
            }
            Read-Host "Press Enter to return to menu"
        }

        "^(5|[Cc])$" {
            $newConf = Cycle-ConfidenceSetting -EnvPath $envPath
            Write-Host ""
            $confLabel = if ([double]$newConf -lt 0.40) { "0.35 (Sensitive - captures more small/distant objects)" } elseif ([double]$newConf -gt 0.60) { "0.70 (Strict - high precision, fewer detections)" } else { "0.50 (Balanced - recommended default)" }
            Log-Success "Updated CONFIDENCE_THRESHOLD in .env to: $confLabel"
            
            $live = Get-ServerLiveStatus
            if ($live.BackendOnline) {
                $restart = Read-Host "Server is running. Restart now to apply new sensitivity? (Y/N)"
                if ($restart -match "^[Yy]") {
                    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "stop.ps1")
                    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "start.ps1")
                }
            }
            Read-Host "Press Enter to return to menu"
        }

        "^(6|[Ee])$" {
            Open-EnvEditor -EnvPath $envPath
            $envMap = Parse-EnvFile $envPath
            $token = $envMap["NGROK_AUTHTOKEN"]
            Write-Host "Current Configuration Summary:" -ForegroundColor White
            Write-Host "  - Port:           $($envMap['API_PORT'])" -ForegroundColor DarkCyan
            Write-Host "  - Ngrok Enabled:  $($envMap['NGROK_ENABLED'])" -ForegroundColor DarkCyan
            Write-Host "  - Ngrok Token:    $(Redact-Secret $token)" -ForegroundColor DarkCyan
            Write-Host "  - Confidence:     $($envMap['CONFIDENCE_THRESHOLD'])" -ForegroundColor DarkCyan
            Write-Host ""

            $live = Get-ServerLiveStatus
            if ($live.BackendOnline) {
                $restart = Read-Host "Server is currently running. Restart now to apply new settings? (Y/N)"
                if ($restart -match "^[Yy]") {
                    Log-Info "Restarting server..."
                    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "stop.ps1")
                    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "start.ps1")
                }
            }
            Read-Host "Press Enter to return to menu"
        }

        "^(7|[Kk])$" {
            Write-Host ""
            Write-Host "Ngrok Authtoken Setup:" -ForegroundColor White
            Write-Host "  Sign up and get your free token from: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor DarkGray
            Write-Host ""
            $tokenInput = Read-Host "Paste your Ngrok Authtoken (or press Enter to cancel)"
            if ($tokenInput -and $tokenInput.Trim() -ne "") {
                Set-EnvValue -EnvPath $envPath -Key "NGROK_AUTHTOKEN" -Value ($tokenInput.Trim())
                Set-EnvValue -EnvPath $envPath -Key "NGROK_ENABLED" -Value "true"
                Log-Success "Ngrok Authtoken saved and tunnel enabled in '$envPath'!"

                $live = Get-ServerLiveStatus
                if ($live.BackendOnline) {
                    $restart = Read-Host "Server is running. Restart now to launch the public HTTPS tunnel? (Y/N)"
                    if ($restart -match "^[Yy]") {
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "stop.ps1")
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "start.ps1")
                    }
                }
            } else {
                Log-Info "Token update cancelled."
            }
            Read-Host "Press Enter to return to menu"
        }

        "^(8|[Bb])$" {
            Write-Host ""
            $envMap = Parse-EnvFile $envPath
            $port = if ($envMap["API_PORT"]) { [int]$envMap["API_PORT"] } else { 8000 }
            $live = Get-ServerLiveStatus -Port $port

            $targetUrl = "http://localhost:$port"
            if ($live.PublicUrl) {
                Write-Host "Choose URL to open in browser:" -ForegroundColor White
                Write-Host "  [1] Public Ngrok HTTPS: $($live.PublicUrl) (Recommended for mobile/camera testing)" -ForegroundColor Yellow
                Write-Host "  [2] Localhost:          $targetUrl" -ForegroundColor White
                $urlChoice = Read-Host "Choice [1/2, default 1]"
                if ($urlChoice -ne "2") {
                    $targetUrl = $live.PublicUrl
                }
            }

            Log-Info "Opening Vision Studio in default browser: $targetUrl"
            Start-Process $targetUrl
            Start-Sleep -Seconds 1
        }

        "^(9|[Ll])$" {
            Write-Host ""
            Log-Info "Streaming live OptiCore container logs (Press Ctrl+C to return to menu)..."
            Push-Location $ServerRoot
            try {
                & docker compose -f $composeFile logs -f --tail=50
            } finally {
                Pop-Location
            }
            Read-Host "Press Enter to return to menu"
        }

        "^[Dd]$" {
            Write-Host ""
            $statusScript = Join-Path $ScriptDir "status.ps1"
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $statusScript
            Write-Host ""
            Read-Host "Press Enter to return to menu"
        }

        "^[Vv]$" {
            Write-Host ""
            $verifyScript = Join-Path $ScriptDir "verify.ps1"
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $verifyScript
            Write-Host ""
            Read-Host "Press Enter to return to menu"
        }

        "^[Uu]$" {
            Write-Host ""
            $updateScript = Join-Path $ScriptDir "update.ps1"
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $updateScript
            Write-Host ""
            Read-Host "Press Enter to return to menu"
        }

        "^(0|[Qq])$" {
            Write-Host ""
            Log-Info "Exiting OptiCore Control Center. Have a great day!"
            $keepRunning = $false
        }

        default {
            Log-Warn "Invalid selection '$choice'. Please choose an option from the menu."
            Start-Sleep -Seconds 1
        }
    }
}
