# Strip EXE Metadata Script
# Uses Resource Hacker to remove VERSIONINFO from EXE files
# Usage: .\strip_metadata.ps1 [-Mode dev|release]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "release")]
    [string]$Mode = "release"
)

$ErrorActionPreference = "Stop"

# Resource Hacker path
$ResourceHacker = "E:\resource_hacker\ResourceHacker.exe"

# Project root - absolute path
$ProjectRoot = "E:\code\Antigravity-Manager"

Write-Host "[strip_metadata] Mode: $Mode" -ForegroundColor Cyan

# Check if Resource Hacker exists
if (-not (Test-Path $ResourceHacker)) {
    Write-Host "[strip_metadata] Resource Hacker not found at: $ResourceHacker" -ForegroundColor Red
    exit 1
}

function Remove-ExeMetadata {
    param([string]$FilePath)
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "[strip_metadata] File not found: $FilePath" -ForegroundColor Yellow
        return $false
    }
    
    Write-Host "[strip_metadata] Processing: $FilePath" -ForegroundColor Cyan
    
    $TempFile = "${FilePath}.stripped"
    
    # Remove old temp file if exists
    if (Test-Path $TempFile) {
        Remove-Item $TempFile -Force
    }
    
    # Run Resource Hacker with timeout (120 seconds for large files)
    $proc = Start-Process -FilePath $ResourceHacker -ArgumentList @(
        "-open", "`"$FilePath`"",
        "-save", "`"$TempFile`"",
        "-action", "delete",
        "-mask", "VERSIONINFO,,",
        "-log", "NUL"
    ) -Wait -PassThru -NoNewWindow
    
    # Check result
    if ((Test-Path $TempFile) -and ((Get-Item $TempFile).Length -gt 0)) {
        $origSize = (Get-Item $FilePath).Length
        $newSize = (Get-Item $TempFile).Length
        
        # Replace original with stripped version
        Remove-Item $FilePath -Force
        Move-Item $TempFile $FilePath -Force
        
        Write-Host "[strip_metadata] SUCCESS: $FilePath" -ForegroundColor Green
        Write-Host "[strip_metadata] Size: $origSize -> $newSize (removed $($origSize - $newSize) bytes)" -ForegroundColor Gray
        return $true
    } else {
        Write-Host "[strip_metadata] SKIPPED: No VERSIONINFO or already stripped" -ForegroundColor Yellow
        if (Test-Path $TempFile) {
            Remove-Item $TempFile -Force
        }
        return $false
    }
}

# Determine paths based on mode
if ($Mode -eq "dev") {
    $TargetDir = Join-Path $ProjectRoot "src-tauri\target\debug"
} else {
    $TargetDir = Join-Path $ProjectRoot "src-tauri\target\release"
}

# 1. Strip main EXE
$MainExe = Join-Path $TargetDir "antigravity_tools.exe"
Remove-ExeMetadata -FilePath $MainExe

# 2. Strip NSIS installer (release mode only)
if ($Mode -eq "release") {
    $NsisDir = Join-Path $TargetDir "bundle\nsis"
    
    if (Test-Path $NsisDir) {
        $SetupFiles = Get-ChildItem -Path $NsisDir -Filter "*-setup.exe" -ErrorAction SilentlyContinue
        
        foreach ($setupFile in $SetupFiles) {
            Remove-ExeMetadata -FilePath $setupFile.FullName
        }
    } else {
        Write-Host "[strip_metadata] NSIS directory not found" -ForegroundColor Yellow
    }
}

Write-Host "[strip_metadata] Done!" -ForegroundColor Green
exit 0
