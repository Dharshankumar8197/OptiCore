# ==============================================================================
# OptiCore Portable AI Server — Interactive PowerShell Control Center
# Live Holographic OptiCore AI Server Animated Background Dashboard
# ==============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
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

$esc = [char]27

function Get-DashboardOverlayLines {
    $envMap = Parse-EnvFile $envPath
    $port = if ($envMap["API_PORT"]) { [int]$envMap["API_PORT"] } elseif ($envMap["PORT"]) { [int]$envMap["PORT"] } else { 8000 }
    $live = Get-ServerLiveStatus -Port $port
    $arch = Get-HostSystemArchitecture

    $ngrokToken = $envMap["NGROK_AUTHTOKEN"]
    $ngrokEnabled = ($envMap["NGROK_ENABLED"] -eq "true" -or $envMap["NGROK_ENABLED"] -eq "1")
    $groqKey = $envMap["GROQ_API_KEY"]
    $conf = if ($envMap["CONFIDENCE_THRESHOLD"]) { $envMap["CONFIDENCE_THRESHOLD"] } else { "0.50" }

    $dockerText = if ($live.DockerRunning) { "[ACTIVE]" } else { "[STOPPED]" }
    $serverText = if ($live.BackendOnline) { "[ONLINE - Port $port]" } else { "[OFFLINE]" }
    $modelText  = if ($live.ModelLoaded) { "[READY - 20 Classes Verified]" } else { "[STANDBY]" }

    $ngrokText = if ($live.PublicUrl) {
        $live.PublicUrl
    } elseif ($ngrokEnabled -and $ngrokToken -and $ngrokToken.Trim() -ne "") {
        "[ENABLED - Starting...]"
    } elseif ($ngrokEnabled) {
        "[ENABLED - Awaiting Token]"
    } else {
        "[DISABLED / LOCAL ONLY]"
    }

    $groqText = if ($groqKey -and $groqKey.Trim() -ne "") {
        "[ENABLED - openai/gpt-oss-120b - $(Redact-Secret $groqKey)]"
    } else {
        "[DISABLED - Local Safety Engine Active]"
    }

    $confLabel = if ([double]$conf -lt 0.40) { "$conf (Sensitive)" } elseif ([double]$conf -gt 0.60) { "$conf (Strict)" } else { "$conf (Balanced)" }
    $ngrokToggleStatus = if ($ngrokEnabled) { "[ON] -> Turn OFF" } else { "[OFF] -> Turn ON" }

    return @(
        "======================================================================",
        "   OptiCore - Windows-First Portable AI Server (Live HUD)",
        "   YOLO26s best.pt | Docker Desktop | ngrok HTTPS | Web Vision Studio",
        "======================================================================",
        "+--------------------------------------------------------------------+",
        "| SYSTEM STATUS DASHBOARD                                            |",
        "+--------------------------------------------------------------------+",
        "  * Docker Desktop Engine: $dockerText",
        "  * OptiCore AI Backend:   $serverText",
        "  * YOLO26s AI Engine:     $modelText",
        "  * Ngrok HTTPS Tunnel:    $ngrokText",
        "  * Groq Scene Narration:  $groqText",
        "  * Detection Sensitivity: $confLabel",
        "  * Hardware Architecture: $($arch.HostArchitecture) ($($arch.RecommendedArch))",
        "+--------------------------------------------------------------------+",
        " [1 / S] Start AI Server & Tunnel      [7 / K] Set / Paste Ngrok Token",
        " [2 / X] Stop AI Server & Tunnel       [8 / B] Open Web Vision Studio",
        " [3 / R] Restart AI Server (Reload)    [9 / L] Stream Live Logs",
        " [4 / T] Toggle Ngrok ($ngrokToggleStatus) [D]     Diagnostics & Health",
        " [5 / C] Cycle Sensitivity ($conf)     [V]     Run 17-Point Suite",
        " [6 / E] Edit .env in Notepad          [U]     Pull Latest Docker Image",
        " [0 / Q] Exit Control Center           [A]     Refresh Status Dashboard",
        "======================================================================",
        " [Hotkeys: 1-9, S, X, R, T, C, E, K, B, L, D, V, U, A, Q] Tap any key..."
    )
}

function Format-DashboardHUD {
    param([string[]]$Lines, [int]$Width)
    $output = [System.Collections.Generic.List[string]]::new()
    $output.Add("${esc}[?25l")
    $row = 1
    foreach ($line in $Lines) {
        $styled = if ($line -match "^={10,}") {
            "${esc}[38;5;51m$line${esc}[0m"
        } elseif ($line -match "^\+-{10,}") {
            "${esc}[38;5;45m$line${esc}[0m"
        } elseif ($line -match "^\|\s*SYSTEM STATUS DASHBOARD") {
            "${esc}[38;5;45m|${esc}[1;38;5;51m SYSTEM STATUS DASHBOARD" + (" " * 44) + "${esc}[38;5;45m|${esc}[0m"
        } elseif ($line -match "^\s*OptiCore\s*-") {
            "${esc}[1;38;5;51m$line${esc}[0m"
        } elseif ($line -match "^\s*YOLO26s best\.pt") {
            "${esc}[38;5;37m$line${esc}[0m"
        } elseif ($line -match "^\s*\[Hotkeys:") {
            "${esc}[1;38;5;51m$line${esc}[0m"
        } elseif ($line -match "^\s*\*") {
            $s = $line -replace "^\s*\*", "  ${esc}[38;5;226m*${esc}[0m"
            $s = $s -replace "(\[(ACTIVE|READY[^\]]*|ONLINE[^\]]*)\])", "${esc}[1;38;5;46m`$1${esc}[0m"
            $s = $s -replace "(\[(STOPPED|OFFLINE)\])", "${esc}[1;38;5;203m`$1${esc}[0m"
            $s = $s -replace "(\[STANDBY\])", "${esc}[1;38;5;226m`$1${esc}[0m"
            $s = $s -replace "(\[ENABLED[^\]]*\])", "${esc}[1;38;5;51m`$1${esc}[0m"
            $s = $s -replace "(\[DISABLED[^\]]*\])", "${esc}[38;5;244m`$1${esc}[0m"
            $s
        } else {
            [regex]::Replace($line, "\[([^\]]+)\]", "${esc}[1;38;5;45m[`$1]${esc}[0m")
        }

        $output.Add("${esc}[${row};1H${styled}${esc}[K")
        $row++
    }
    for ($r = $row; $r -le [Math]::Max($row + 2, 28); $r++) {
        $output.Add("${esc}[${r};1H${esc}[K")
    }
    return [string]::Join("", $output)
}

function Run-SubAction {
    param([scriptblock]$Action)
    try { [Console]::CursorVisible = $true } catch {}
    try { [Console]::Write("${esc}[0m${esc}[2J${esc}[1;1H") } catch {}
    try {
        & $Action
    } finally {
        try { [Console]::CursorVisible = $false } catch {}
        try { [Console]::Write("${esc}[0m${esc}[2J${esc}[1;1H") } catch {}
    }
}

$keepRunning = $true
$lastOverlayFetch = [System.DateTime]::MinValue
$cachedOverlay = $null
$lastW = 0
$lastH = 0

try { [Console]::CursorVisible = $false } catch {}
try { [Console]::Write("${esc}[0m${esc}[2J${esc}[1;1H") } catch {}

try {
    while ($keepRunning) {
        $w = try { [Math]::Max(72, [Console]::WindowWidth) } catch { 80 }
        $h = try { [Math]::Max(26, [Console]::WindowHeight) } catch { 28 }

        if ($w -ne $lastW -or $h -ne $lastH) {
            $lastW = $w
            $lastH = $h
            try { [Console]::Write("${esc}[0m${esc}[2J${esc}[1;1H") } catch {}
            $cachedOverlay = $null
        }

        $now = [System.DateTime]::UtcNow
        if (($now - $lastOverlayFetch).TotalSeconds -ge 2.0 -or $null -eq $cachedOverlay) {
            $cachedOverlay = Get-DashboardOverlayLines
            $lastOverlayFetch = $now
            $frame = Format-DashboardHUD -Lines $cachedOverlay -Width $w
            try { [Console]::SetCursorPosition(0, 0) } catch {}
            [Console]::Write($frame)
        }

        $hasKey = try { [Console]::KeyAvailable } catch { $false }
        if ($hasKey) {
            $key = [Console]::ReadKey($true)
            $char = $key.KeyChar.ToString()

            switch -Regex ($char) {
                "^(1|[Ss])$" {
                    Run-SubAction {
                        Write-Host ""
                        Log-Info "Starting OptiCore AI Server..."
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "start.ps1")
                        Write-Host ""
                        Read-Host "Press Enter to return to HUD"
                    }
                    $cachedOverlay = $null
                }

                "^(2|[Xx])$" {
                    Run-SubAction {
                        Write-Host ""
                        Log-Info "Stopping OptiCore AI Server..."
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "stop.ps1")
                        Write-Host ""
                        Read-Host "Press Enter to return to HUD"
                    }
                    $cachedOverlay = $null
                }

                "^(3|[Rr])$" {
                    Run-SubAction {
                        Write-Host ""
                        Log-Info "Restarting OptiCore Server..."
                        Push-Location $ServerRoot
                        try {
                            & docker compose -f $composeFile restart
                            Log-Success "Containers restarted successfully."
                        } finally {
                            Pop-Location
                        }
                        Start-Sleep -Seconds 1
                    }
                    $cachedOverlay = $null
                }

                "^(4|[Tt])$" {
                    $newVal = Toggle-EnvSetting -EnvPath $envPath -SettingKey "NGROK_ENABLED"
                    $cachedOverlay = $null
                }

                "^(5|[Cc])$" {
                    $newVal = Cycle-ConfidenceSetting -EnvPath $envPath
                    $cachedOverlay = $null
                }

                "^(6|[Ee])$" {
                    Run-SubAction {
                        Open-EnvEditor -EnvPath $envPath
                    }
                    $cachedOverlay = $null
                }

                "^(7|[Kk])$" {
                    Run-SubAction {
                        Write-Host ""
                        Write-Host "Set Ngrok Authtoken" -ForegroundColor Cyan
                        $tokenInput = Read-Host "Paste your Ngrok Authtoken"
                        if ($tokenInput -and $tokenInput.Trim() -ne "") {
                            $lines = Get-Content $envPath
                            $newLines = @()
                            $found = $false
                            foreach ($l in $lines) {
                                if ($l -match "^NGROK_AUTHTOKEN=") {
                                    $newLines += "NGROK_AUTHTOKEN=$($tokenInput.Trim())"
                                    $found = $true
                                } else {
                                    $newLines += $l
                                }
                            }
                            if (-not $found) { $newLines += "NGROK_AUTHTOKEN=$($tokenInput.Trim())" }
                            $newLines | Set-Content $envPath -Encoding utf8
                            Log-Success "Ngrok Authtoken updated."
                        }
                        Start-Sleep -Seconds 1
                    }
                    $cachedOverlay = $null
                }

                "^(8|[Bb])$" {
                    $envMap = Parse-EnvFile $envPath
                    $port = if ($envMap["API_PORT"]) { [int]$envMap["API_PORT"] } else { 8000 }
                    $live = Get-ServerLiveStatus -Port $port
                    $targetUrl = if ($live.PublicUrl) { $live.PublicUrl } else { "http://localhost:$port" }
                    Start-Process $targetUrl
                }

                "^(9|[Ll])$" {
                    Run-SubAction {
                        Write-Host ""
                        Log-Info "Streaming container logs (Press Ctrl+C to return to HUD)..."
                        Push-Location $ServerRoot
                        try {
                            & docker compose -f $composeFile logs -f --tail=50
                        } finally {
                            Pop-Location
                        }
                    }
                    $cachedOverlay = $null
                }

                "^[Dd]$" {
                    Run-SubAction {
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "status.ps1")
                        Write-Host ""
                        Read-Host "Press Enter to return to HUD"
                    }
                    $cachedOverlay = $null
                }

                "^[Vv]$" {
                    Run-SubAction {
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "verify.ps1")
                        Write-Host ""
                        Read-Host "Press Enter to return to HUD"
                    }
                    $cachedOverlay = $null
                }

                "^[Uu]$" {
                    Run-SubAction {
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "update.ps1")
                        Write-Host ""
                        Read-Host "Press Enter to return to HUD"
                    }
                    $cachedOverlay = $null
                }

                "^[Aa]$" {
                    try { [Console]::Write("${esc}[0m${esc}[2J${esc}[1;1H") } catch {}
                    $cachedOverlay = $null
                }

                "^(0|[Qq])$" {
                    $keepRunning = $false
                }

                default {
                    $cachedOverlay = $null
                }
            }
        }

        [System.Threading.Thread]::Sleep(50)
    }
} finally {
    try { [Console]::CursorVisible = $true } catch {}
    try { [Console]::Write("${esc}[0m${esc}[2J${esc}[1;1H") } catch {}
    Write-Host "OptiCore AI Control Center closed. Have a productive day!" -ForegroundColor Cyan
}
