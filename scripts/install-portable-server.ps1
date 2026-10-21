# ==============================================================================
# OptiCore Portable AI Server — One-Command Windows Installer
# ==============================================================================
# Usage:
#   irm https://raw.githubusercontent.com/Dharshankumar8197/OptiCore/main/scripts/install-portable-server.ps1 | iex
# ==============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   OptiCore Portable AI Server - One-Command Installer" -ForegroundColor Cyan
Write-Host "   YOLO26s | Docker Desktop | ngrok HTTPS | Zero Client Python Required" -ForegroundColor DarkCyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$RepoOwner = "Dharshankumar8197"
$RepoName  = "OptiCore"
$ReleaseZipName = "portable_server.zip"
$ReleaseUrl = "https://github.com/$RepoOwner/$RepoName/releases/latest/download/$ReleaseZipName"
$ChecksumUrl = "https://github.com/$RepoOwner/$RepoName/releases/latest/download/$ReleaseZipName.sha256"

# 1. Ask for Destination Directory (auto-creates a 'portable_server' folder)
$defaultParent = $env:USERPROFILE
Write-Host "Where would you like to install the portable runner?" -ForegroundColor White
Write-Host "The installer will automatically create and extract into a 'portable_server' folder." -ForegroundColor DarkCyan
Write-Host "Default parent location: $defaultParent (creates $defaultParent\portable_server)" -ForegroundColor DarkGray
$inputPath = Read-Host "Enter target folder [Press Enter for default]"

$baseDir = if ($inputPath -and $inputPath.Trim() -ne "") { $inputPath.Trim() } else { $defaultParent }
$baseDir = [System.IO.Path]::GetFullPath($baseDir)

# Ensure the destination directory is named 'portable_server'
$installPath = if ((Split-Path -Leaf $baseDir) -ieq "portable_server") {
    $baseDir
} else {
    Join-Path $baseDir "portable_server"
}

Write-Host "[*] Extracting automatically into: '$installPath'" -ForegroundColor Green
Write-Host ""

# 2. Download portable_server.zip
$tempZip = Join-Path $env:TEMP "opticore_portable_server.zip"
$tempChecksum = Join-Path $env:TEMP "opticore_portable_server.zip.sha256"
$downloadSucceeded = $false

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

Write-Host "[*] Downloading OptiCore package from GitHub..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $ReleaseUrl -OutFile $tempZip -TimeoutSec 45 -UseBasicParsing
    $downloadSucceeded = $true
    Write-Host "[+] Downloaded release package ($([math]::Round((Get-Item $tempZip).Length / 1KB, 2)) KB)" -ForegroundColor Green

    # Verify checksum if available
    try {
        Invoke-WebRequest -Uri $ChecksumUrl -OutFile $tempChecksum -TimeoutSec 15 -UseBasicParsing
        $expectedHash = (Get-Content $tempChecksum).Trim().Split(" ")[0]
        $actualHash = (Get-FileHash -Path $tempZip -Algorithm SHA256).Hash.ToLower()
        if ($expectedHash.ToLower() -eq $actualHash) {
            Write-Host "[+] SHA-256 Checksum verified: $actualHash" -ForegroundColor Green
        }
    } catch {}

} catch {
    # Fallback to direct download from repository raw main branch
    $rawUrl = "https://github.com/$RepoOwner/$RepoName/raw/main/$ReleaseZipName"
    Write-Host "[*] Fetching package directly from repository branch: $rawUrl..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri $rawUrl -OutFile $tempZip -TimeoutSec 60 -UseBasicParsing
        $downloadSucceeded = $true
        Write-Host "[+] Downloaded latest package from repository ($([math]::Round((Get-Item $tempZip).Length / 1KB, 2)) KB)" -ForegroundColor Green
    } catch {
        # Check local fallbacks (e.g. if run in local clone)
        $localZips = @(
            (Join-Path $PSScriptRoot "..\portable_server.zip"),
            (Join-Path (Get-Location) "portable_server.zip"),
            "C:\IMP PROJECTS\opticore\portable_server.zip"
        )
        foreach ($lz in $localZips) {
            if (Test-Path $lz) {
                Write-Host "[+] Using local build package: '$lz'" -ForegroundColor Green
                Copy-Item -Path $lz -Destination $tempZip -Force
                $downloadSucceeded = $true
                break
            }
        }
    }
}

if (-not $downloadSucceeded -or -not (Test-Path $tempZip)) {
    Write-Host ""
    Write-Host "[-] Failed to download or locate '$ReleaseZipName'." -ForegroundColor Red
    Write-Host "    Please check your internet connection or download manually from:" -ForegroundColor Yellow
    Write-Host "    https://github.com/$RepoOwner/$RepoName" -ForegroundColor White
    exit 1
}

# 3. Auto-Extract into 'portable_server' folder & delete zip
Write-Host "[*] Auto-extracting into '$installPath'..." -ForegroundColor Cyan
if (-not (Test-Path $installPath)) {
    New-Item -ItemType Directory -Path $installPath -Force | Out-Null
}

$tempExtract = Join-Path $env:TEMP "opticore_extract_$(Get-Random)"
New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null

try {
    Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
    $extractedFolder = Join-Path $tempExtract "portable_server"
    if (Test-Path $extractedFolder) {
        Copy-Item -Path "$extractedFolder\*" -Destination $installPath -Recurse -Force
    } else {
        Copy-Item -Path "$tempExtract\*" -Destination $installPath -Recurse -Force
    }
    Write-Host "[+] Extraction complete into '$installPath'." -ForegroundColor Green
} finally {
    # Automatically delete temporary extract directory and the zip file
    Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $tempChecksum -Force -ErrorAction SilentlyContinue
    Write-Host "[+] Deleted temporary zip archive automatically." -ForegroundColor DarkGray
}

# 4. Launch interactive post-install configuration in destination
$targetInstallScript = Join-Path $installPath "scripts\install.ps1"
if (Test-Path $targetInstallScript) {
    & powershell.exe -ExecutionPolicy Bypass -File $targetInstallScript -DestinationPath $installPath
} else {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "   [SUCCESS] OptiCore Portable Server files placed in '$installPath'!" -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "   Launch interactive control center:" -ForegroundColor Cyan
    Write-Host "     cd `"$installPath`" ; .\menu.bat" -ForegroundColor White
    Write-Host "   Start server directly:" -ForegroundColor Cyan
    Write-Host "     cd `"$installPath`" ; .\start.bat" -ForegroundColor White
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host ""
}
