# ==============================================================================
# OptiCore Portable AI Server — Common Utilities & Helper Functions
# ==============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
$Script:OptiCoreScriptsDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }


# Ensure UTF-8 output encoding for console
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Write-OptiCoreBanner {
    param([string]$Title = "Portable AI Server")
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "   OptiCore - Windows-First Portable AI Server ($Title)" -ForegroundColor Cyan
    Write-Host "   YOLO26s best.pt | Docker Desktop | ngrok HTTPS | Web Vision Studio" -ForegroundColor DarkCyan
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Log-Info {
    param([string]$Message)
    Write-Host "[*] $Message" -ForegroundColor Cyan
}

function Log-Success {
    param([string]$Message)
    Write-Host "[+] $Message" -ForegroundColor Green
}

function Log-Warn {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

function Log-Error {
    param([string]$Message)
    Write-Host "[-] $Message" -ForegroundColor Red
}

function Test-DockerCli {
    try {
        $null = Get-Command docker -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Test-DockerDaemon {
    try {
        $info = docker info 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Show-ProgressBar {
    param(
        [string]$Activity,
        [int]$Percent,
        [string]$Status = "",
        [int]$BarWidth = 24
    )

    $clamped = [math]::Max(0, [math]::Min(100, $Percent))
    $completedWidth = [math]::Round(($clamped / 100) * $BarWidth)
    $remainingWidth = $BarWidth - $completedWidth

    $charBlock = [char]0x2588 # █
    $charShade = [char]0x2591 # ░
    $barCompleted = [string]::new($charBlock, $completedWidth)
    $barRemaining = [string]::new($charShade, $remainingWidth)

    $pctText = "{0,3}%" -f $clamped
    $statusText = if ($Status) { " - $Status" } else { "" }
    $line = "`r  [$barCompleted$barRemaining] $pctText | $Activity$statusText"
    
    # Pad to overwrite previous line contents cleanly
    $line = $line.PadRight(76)
    Write-Host -NoNewline $line -ForegroundColor Cyan
    if ($clamped -ge 100) {
        Write-Host ""
    }
}

function Ensure-DockerDesktopRunning {
    param([int]$MaxWaitSeconds = 60)

    if (-not (Test-DockerCli)) {
        Log-Error "Docker CLI was not found in PATH."
        Log-Warn "Please install Docker Desktop for Windows from: https://www.docker.com/products/docker-desktop/"
        return $false
    }

    if (Test-DockerDaemon) {
        Log-Success "Docker Desktop daemon is active and responding."
        return $true
    }

    Log-Warn "Docker Desktop daemon is not running. Attempting to start Docker Desktop..."

    $possiblePaths = @(
        "C:\Program Files\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    )

    $exePath = $null
    foreach ($p in $possiblePaths) {
        if (Test-Path $p) {
            $exePath = $p
            break
        }
    }

    if ($exePath) {
        Log-Info "Launching: $exePath"
        Start-Process -FilePath $exePath
    } else {
        Log-Warn "Could not auto-locate 'Docker Desktop.exe'. Please launch Docker Desktop from your Start Menu."
    }

    Log-Info "Waiting for Docker daemon to initialize..."
    $waited = 0
    while ($waited -lt $MaxWaitSeconds) {
        Start-Sleep -Seconds 2
        $waited += 2
        $pct = [math]::Min(95, [math]::Round(($waited / $MaxWaitSeconds) * 100))
        Show-ProgressBar -Activity "Connecting to Docker Engine" -Percent $pct -Status "${waited}s / ${MaxWaitSeconds}s"

        if (Test-DockerDaemon) {
            Show-ProgressBar -Activity "Docker Engine Ready" -Percent 100 -Status "Connected!"
            Log-Success "Docker daemon is ready! (initialized in $waited seconds)"
            return $true
        }
    }

    Write-Host ""
    Log-Error "Docker daemon did not become ready within $MaxWaitSeconds seconds."
    Log-Warn "Please check Docker Desktop tray icon in Windows taskbar and ensure the engine has started."
    return $false
}

function Get-HostSystemArchitecture {
    $arch = $env:PROCESSOR_ARCHITECTURE
    $isArm = ($arch -match "ARM64")
    return [PSCustomObject]@{
        HostArchitecture = $arch
        IsArm64          = $isArm
        RecommendedArch  = if ($isArm) { "ARM64 (Qualcomm Snapdragon X / ARM64 WSL2 Native)" } else { "x64 (Intel / AMD)" }
    }
}

function Parse-EnvFile {
    param([string]$Path)

    $envMap = @{}
    if (-not (Test-Path $Path)) {
        return $envMap
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line.Split("=", 2)
            if ($parts.Count -eq 2) {
                $key = $parts[0].Trim()
                $val = $parts[1].Trim()
                # Strip wrapping quotes
                if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
                    $val = $val.Substring(1, $val.Length - 2)
                }
                $envMap[$key] = $val
            }
        }
    }
    return $envMap
}

function Redact-Secret {
    param([string]$Value)
    if (-not $Value -or $Value.Length -le 8) {
        return "***"
    }
    return ($Value.Substring(0, 4) + "..." + $Value.Substring($Value.Length - 4, 4))
}

function Get-NgrokPublicUrl {
    param([int]$MaxAttempts = 20, [int]$DelaySec = 1)

    $tunnelUrl = $null
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $resp = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2 -ErrorAction Stop
            if ($resp -and $resp.tunnels) {
                foreach ($t in $resp.tunnels) {
                    if ($t.public_url -and $t.public_url.StartsWith("https://")) {
                        $tunnelUrl = $t.public_url
                        break
                    }
                }
            }
            if ($tunnelUrl) {
                return $tunnelUrl
            }
        } catch {
            # Ngrok dashboard not responding yet
        }
        Start-Sleep -Seconds $DelaySec
    }
    return $null
}

function Get-ServerLiveStatus {
    param([int]$Port = 8000)

    $status = [PSCustomObject]@{
        DockerRunning  = (Test-DockerDaemon)
        BackendOnline  = $false
        ModelLoaded    = $false
        Architecture   = "Unknown"
        ClassCount     = 0
        PublicUrl      = $null
        Port           = $Port
    }

    if ($status.DockerRunning) {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:${Port}/health" -TimeoutSec 2 -ErrorAction Stop
            if ($health) {
                $status.BackendOnline = ($health.status -eq "ok")
                $status.ModelLoaded   = [bool]($health.model_loaded)
                $status.Architecture  = if ($health.architecture) { $health.architecture } else { "YOLO26s" }
                $status.ClassCount    = if ($health.class_count) { [int]$health.class_count } else { 0 }
            }
        } catch {
            $status.BackendOnline = $false
        }

        $status.PublicUrl = Get-NgrokPublicUrl -MaxAttempts 1 -DelaySec 0
    }

    return $status
}

function Open-EnvEditor {
    param([string]$EnvPath)

    if (-not (Test-Path $EnvPath)) {
        Log-Warn "Configuration file '$EnvPath' not found."
        return
    }

    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "   OptiCore Configuration Guide (.env)" -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host " Quick Terminal Commands to Open .env:" -ForegroundColor Yellow
    Write-Host "   PowerShell / CMD: notepad `"$EnvPath`"" -ForegroundColor Cyan
    Write-Host "   Visual Studio Code: code `"$EnvPath`"" -ForegroundColor Cyan
    Write-Host ""
    Write-Host " Key Configuration Settings in your .env:" -ForegroundColor White
    Write-Host "   - NGROK_AUTHTOKEN : Required for public HTTPS mobile camera access." -ForegroundColor Yellow
    Write-Host "                       Get it free: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor DarkGray
    Write-Host "   - NGROK_ENABLED   : Set to 'true' to start tunnel, or 'false' for local only." -ForegroundColor White
    Write-Host "   - GROQ_API_KEY    : Optional key for Groq contextual scene narration (openai/gpt-oss-120b)." -ForegroundColor White
    Write-Host "   - API_PORT        : Server host port (default: 8000)." -ForegroundColor White
    Write-Host "   - CONFIDENCE_THRESHOLD : Detection sensitivity (0.35 = sensitive, 0.50 = balanced, 0.70 = strict)." -ForegroundColor White
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host " Opening '$EnvPath' in Notepad... Please save and close Notepad when done." -ForegroundColor Green
    Write-Host ""

    Start-Process -FilePath "notepad.exe" -ArgumentList "`"$EnvPath`"" -Wait
    Log-Success "Configuration file closed. Reloaded settings from '$EnvPath'."
}

function Set-EnvValue {
    param(
        [string]$EnvPath,
        [string]$Key,
        [string]$Value
    )

    if (-not (Test-Path $EnvPath)) {
        Log-Warn "Configuration file '$EnvPath' not found."
        return
    }

    $lines = Get-Content $EnvPath
    $found = $false
    $newLines = @()

    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed -and -not $trimmed.StartsWith("#") -and $trimmed.StartsWith("$Key=")) {
            $newLines += "$Key=$Value"
            $found = $true
        } else {
            $newLines += $line
        }
    }

    if (-not $found) {
        $newLines += "$Key=$Value"
    }

    $newLines | Set-Content -Path $EnvPath -Encoding UTF8
}

function Toggle-EnvSetting {
    param(
        [string]$EnvPath,
        [string]$SettingKey,
        [string]$DefaultValue = "true"
    )

    if (-not (Test-Path $EnvPath)) {
        Log-Warn "Configuration file '$EnvPath' not found."
        return $DefaultValue
    }

    $lines = Get-Content $EnvPath
    $found = $false
    $newLines = @()
    $newVal = "false"

    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed -and -not $trimmed.StartsWith("#") -and $trimmed.StartsWith("$SettingKey=")) {
            $currentVal = $trimmed.Split("=", 2)[1].Trim().ToLower()
            $newVal = if ($currentVal -eq "true" -or $currentVal -eq "1") { "false" } else { "true" }
            $newLines += "$SettingKey=$newVal"
            $found = $true
        } else {
            $newLines += $line
        }
    }

    if (-not $found) {
        $newLines += "$SettingKey=$DefaultValue"
        $newVal = $DefaultValue
    }

    $newLines | Set-Content -Path $EnvPath -Encoding UTF8
    return $newVal
}

function Cycle-ConfidenceSetting {
    param([string]$EnvPath)

    $envMap = Parse-EnvFile $EnvPath
    $current = if ($envMap["CONFIDENCE_THRESHOLD"]) { [double]$envMap["CONFIDENCE_THRESHOLD"] } else { 0.50 }

    $next = if ($current -lt 0.40) { "0.50" } elseif ($current -lt 0.60) { "0.70" } else { "0.35" }
    Set-EnvValue -EnvPath $EnvPath -Key "CONFIDENCE_THRESHOLD" -Value $next
    return $next
}

function Show-BrainAnimation {
    param(
        [double]$DurationSeconds = 0,
        [string]$HeaderText = "OptiCore AI Server",
        [string]$SubHeaderText = "YOLO26s | 20 Classes | Docker Desktop",
        [string]$BottomText = "[S] Start | [X] Stop | [T] Toggle Ngrok | [B] Browser | [Any Key] Menu"
    )

    $scriptDir = if ($Script:OptiCoreScriptsDir) { $Script:OptiCoreScriptsDir } elseif ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $csPath = Join-Path $scriptDir "BrainRenderer.cs"

    if (-not ('BrainRenderer' -as [type])) {
        if (Test-Path $csPath) {
            try {
                Add-Type -Path $csPath -ErrorAction Stop
            } catch {
                return $null
            }
        } else {
            return $null
        }
    }

    try {
        [BrainRenderer]::EnableVT()
        $brain = New-Object BrainRenderer
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        [Console]::CursorVisible = $false

        $pressedKey = $null
        while ($true) {
            $elapsed = $sw.Elapsed.TotalSeconds
            if ($DurationSeconds -gt 0 -and $elapsed -ge $DurationSeconds) {
                break
            }

            if ([Console]::KeyAvailable) {
                $k = [Console]::ReadKey($true)
                $pressedKey = $k.KeyChar.ToString()
                break
            }

            $w = [Math]::Max(40, [Console]::WindowWidth)
            $h = [Math]::Max(15, [Console]::WindowHeight)

            $frame = $brain.Render($elapsed, $w, $h, 3, 1, $HeaderText, $SubHeaderText, $BottomText)
            [Console]::Out.Write($frame)
            Start-Sleep -Milliseconds 33
        }

        return $pressedKey
    } catch {
        return $null
    } finally {
        try {
            [Console]::CursorVisible = $true
            [Console]::Out.Write([string][char]27 + "[0m")
            Clear-Host
        } catch {}
    }
}



