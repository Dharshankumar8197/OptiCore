# ==============================================================================
# OptiCore Portable AI Server — Update Script
# ==============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ServerRoot = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir "common.ps1")

Write-OptiCoreBanner "Update Server"

# 1. Preserve and Backup Configuration
$envPath = Join-Path $ServerRoot ".env"
if (Test-Path $envPath) {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupEnv = Join-Path $ServerRoot ".env.backup.$timestamp"
    Copy-Item -Path $envPath -Destination $backupEnv -Force
    Log-Success "Configuration preserved. Backup saved to '.env.backup.$timestamp'"
}

# 2. Pull Latest Image from GHCR
$envMap = Parse-EnvFile $envPath
$imageName = if ($envMap["OPTICORE_IMAGE"]) { $envMap["OPTICORE_IMAGE"] } else { "ghcr.io/dharshankumar8197/opticore-server" }
$imageVersion = if ($envMap["OPTICORE_VERSION"]) { $envMap["OPTICORE_VERSION"] } else { "latest" }
$fullImageRef = "${imageName}:${imageVersion}"

Log-Info "Pulling latest OptiCore image: $fullImageRef..."

if (Ensure-DockerDesktopRunning -MaxWaitSeconds 30) {
    try {
        & docker pull $fullImageRef
        if ($LASTEXITCODE -eq 0) {
            Log-Success "Image successfully updated to latest version."
        } else {
            Log-Warn "Could not pull '$fullImageRef' (Exit Code: $LASTEXITCODE)."
        }
    } catch {
        Log-Warn "Docker pull error: $_"
    }
}

Log-Success "Update process complete. Start OptiCore with '.\start.bat' to apply changes."
