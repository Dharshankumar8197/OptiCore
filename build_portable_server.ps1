# ==============================================================================
# OptiCore — Build and Package portable_server.zip
# ==============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RootDir = $PSScriptRoot
$SourceFolder = Join-Path $RootDir "portable_server"
$ZipOutput = Join-Path $RootDir "portable_server.zip"
$ChecksumOutput = Join-Path $RootDir "portable_server.zip.sha256"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   Building OptiCore portable_server.zip" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

if (-not (Test-Path $SourceFolder)) {
    Write-Error "Source folder '$SourceFolder' does not exist."
    exit 1
}

# 1. Clean previous build artifacts
if (Test-Path $ZipOutput) { Remove-Item -Path $ZipOutput -Force }
if (Test-Path $ChecksumOutput) { Remove-Item -Path $ChecksumOutput -Force }

# 2. Generate checksums.txt inside portable_server
Write-Host "[*] Calculating SHA-256 checksums for package contents..." -ForegroundColor Cyan
$checksumFile = Join-Path $SourceFolder "checksums.txt"
if (Test-Path $checksumFile) { Remove-Item -Path $checksumFile -Force }

$lines = [System.Collections.Generic.List[string]]::new()
$files = Get-ChildItem -Path $SourceFolder -Recurse -File | Where-Object { 
    $_.Name -ne "checksums.txt" -and 
    $_.Name -ne ".env" -and 
    $_.FullName -notmatch "\\data\\" -and 
    $_.FullName -notmatch "\\models\\" -and 
    $_.Extension -ne ".db" -and 
    $_.Extension -ne ".log"
}

foreach ($f in ($files | Sort-Object FullName)) {
    $relPath = $f.FullName.Substring($SourceFolder.Length).TrimStart("\", "/")
    $hash = (Get-FileHash -Path $f.FullName -Algorithm SHA256).Hash.ToLower()
    $lines.Add("$hash  $relPath")
}

$lines | Set-Content -Path $checksumFile -Encoding UTF8
Write-Host "[+] Generated checksums.txt with $($lines.Count) files." -ForegroundColor Green

# 3. Create portable_server.zip with root directory 'portable_server'
Write-Host "[*] Compressing into '$ZipOutput'..." -ForegroundColor Cyan

# Use temporary directory to guarantee root folder inside ZIP is 'portable_server'
$tempStage = Join-Path $env:TEMP "opticore_stage_$(Get-Random)"
$stagePortable = Join-Path $tempStage "portable_server"
New-Item -ItemType Directory -Path $stagePortable -Force | Out-Null

try {
    # Copy only release files into stage
    foreach ($f in $files) {
        $relPath = $f.FullName.Substring($SourceFolder.Length).TrimStart("\", "/")
        $targetFile = Join-Path $stagePortable $relPath
        $targetDir = Split-Path -Parent $targetFile
        if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
        Copy-Item -Path $f.FullName -Destination $targetFile -Force
    }
    Copy-Item -Path $checksumFile -Destination (Join-Path $stagePortable "checksums.txt") -Force

    Compress-Archive -Path $stagePortable -DestinationPath $ZipOutput -CompressionLevel Optimal
    Write-Host "[+] Successfully created $ZipOutput ($([math]::Round((Get-Item $ZipOutput).Length / 1KB, 2)) KB)" -ForegroundColor Green
} finally {
    Remove-Item -Path $tempStage -Recurse -Force -ErrorAction SilentlyContinue
}


# 4. Generate portable_server.zip.sha256
$zipHash = (Get-FileHash -Path $ZipOutput -Algorithm SHA256).Hash.ToLower()
"$zipHash  portable_server.zip" | Set-Content -Path $ChecksumOutput -Encoding UTF8
Write-Host "[+] SHA-256: $zipHash" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
