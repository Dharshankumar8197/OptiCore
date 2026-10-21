# ==============================================================================
# OptiCore Portable AI Server — One-Command Windows Installer
# ==============================================================================
# Usage:
#   irm https://raw.githubusercontent.com/Dharshankumar8197/OptiCore/main/scripts/install-portable-server.ps1 | iex
# ==============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   OptiCore Portable AI Server - One-Command Installer" -ForegroundColor Cyan
Write-Host "   YOLO26s · Docker Desktop · ngrok HTTPS · Zero Client Python Required" -ForegroundColor DarkCyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$RepoOwner = "Dharshankumar8197"
$RepoName  = "OptiCore"
$ReleaseZipName = "portable_server.zip"
$ReleaseUrl = "https://github.com/$RepoOwner/$RepoName/releases/latest/download/$ReleaseZipName"
$ChecksumUrl = "https://github.com/$RepoOwner/$RepoName/releases/latest/download/$ReleaseZipName.sha256"

# 1. Ask for Destination Directory
$defaultDest = Join-Path $env:USERPROFILE "OptiCoreServer"
Write-Host "Select destination directory for OptiCore Portable Server." -ForegroundColor White
Write-Host "Default: $defaultDest" -ForegroundColor DarkGray
$inputPath = Read-Host "Enter path [Press Enter to accept default]"

$installPath = if ($inputPath -and $inputPath.Trim() -ne "") { $inputPath.Trim() } else { $defaultDest }
$installPath = [System.IO.Path]::GetFullPath($installPath)

Write-Host "[*] Target installation folder: '$installPath'" -ForegroundColor Cyan

if (-not (Test-Path $installPath)) {
    New-Item -ItemType Directory -Path $installPath -Force | Out-Null
    Write-Host "[+] Directory created: '$installPath'" -ForegroundColor Green
}

# 2. Download or Locate portable_server.zip
$tempZip = Join-Path $env:TEMP "opticore_portable_server.zip"
$tempChecksum = Join-Path $env:TEMP "opticore_portable_server.zip.sha256"
$downloadSucceeded = $false

Write-Host "[*] Checking for latest release package from GitHub: $ReleaseUrl..." -ForegroundColor Cyan
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    Invoke-WebRequest -Uri $ReleaseUrl -OutFile $tempZip -TimeoutSec 45 -UseBasicParsing
    $downloadSucceeded = $true
    Write-Host "[+] Downloaded release package ($([math]::Round((Get-Item $tempZip).Length / 1MB, 2)) MB)" -ForegroundColor Green

    # Download Checksum if available
    try {
        Invoke-WebRequest -Uri $ChecksumUrl -OutFile $tempChecksum -TimeoutSec 15 -UseBasicParsing
        $expectedHash = (Get-Content $tempChecksum).Trim().Split(" ")[0]
        $actualHash = (Get-FileHash -Path $tempZip -Algorithm SHA256).Hash.ToLower()
        if ($expectedHash.ToLower() -eq $actualHash) {
            Write-Host "[+] SHA-256 Checksum verified: $actualHash" -ForegroundColor Green
        } else {
            Write-Host "[!] Warning: Checksum mismatch. Expected: $expectedHash, Actual: $actualHash" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[*] Checksum file not published on release; proceeding with downloaded package." -ForegroundColor DarkGray
    }

} catch {
    Write-Host "[!] Note: Remote release package not found at $ReleaseUrl." -ForegroundColor Yellow
    Write-Host "    (The release has not yet been published to GitHub Releases by the maintainer)." -ForegroundColor DarkGray
    
    # Check if a local package exists (e.g. if run in a cloned repo or local build)
    $localZips = @(
        (Join-Path $PSScriptRoot "..\portable_server.zip"),
        (Join-Path (Get-Location) "portable_server.zip"),
        "C:\IMP PROJECTS\opticore\portable_server.zip"
    )

    $foundLocal = $null
    foreach ($lz in $localZips) {
        if (Test-Path $lz) {
            $foundLocal = $lz
            break
        }
    }

    if ($foundLocal) {
        Write-Host "[+] Found local build package: '$foundLocal'" -ForegroundColor Green
        Copy-Item -Path $foundLocal -Destination $tempZip -Force
        $downloadSucceeded = $true
    } else {
        Write-Host ""
        Write-Host "======================================================================" -ForegroundColor Yellow
        Write-Host "   [BOOTSTRAP NOTICE] GitHub Release Not Yet Published" -ForegroundColor Yellow
        Write-Host "======================================================================" -ForegroundColor Yellow
        Write-Host " The automated GitHub Actions release workflow has not yet published" -ForegroundColor White
        Write-Host " '$ReleaseZipName' to GitHub Releases." -ForegroundColor White
        Write-Host ""
        Write-Host " If you have cloned this repository, build and install directly with:" -ForegroundColor Cyan
        Write-Host "   1. .\build_portable_server.ps1" -ForegroundColor White
        Write-Host "   2. .\portable_server\install.bat `"$installPath`"" -ForegroundColor White
        Write-Host "======================================================================" -ForegroundColor Yellow
        Write-Host ""
        exit 0
    }
}

# 3. Extract Archive
Write-Host "[*] Extracting package into '$installPath'..." -ForegroundColor Cyan
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
    Write-Host "[+] Extraction complete." -ForegroundColor Green
} finally {
    Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
}

# 4. Run installer script in destination to configure .env
$targetInstallScript = Join-Path $installPath "scripts\install.ps1"
if (Test-Path $targetInstallScript) {
    & powershell.exe -ExecutionPolicy Bypass -File $targetInstallScript -DestinationPath $installPath
} else {
    Write-Host "[+] OptiCore Portable Server files placed in '$installPath'." -ForegroundColor Green
}
