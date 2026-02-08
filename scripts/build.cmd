@echo off
REM Build script for Antigravity Tools
REM This script runs tauri build and then strips metadata from all EXE files

echo [build] Current directory: %CD%
echo [build] Starting tauri build...

call npx tauri build

REM Save the exit code but continue anyway if NSIS was created
set BUILD_ERROR=%ERRORLEVEL%

if %BUILD_ERROR% neq 0 (
    echo [build] tauri build returned error %BUILD_ERROR%, checking if NSIS bundle was created...
)

REM Always try to strip metadata if bundle exists
echo [build] Stripping metadata...
echo [build] Script path: %~dp0strip_metadata.ps1

powershell -ExecutionPolicy Bypass -File "%~dp0strip_metadata.ps1" -Mode release

if %ERRORLEVEL% neq 0 (
    echo [build] strip_metadata failed with error %ERRORLEVEL%
)

echo [build] Done!

REM Return the original build error if there was one
if %BUILD_ERROR% neq 0 (
    echo [build] Note: Original build error was %BUILD_ERROR%
    exit /b %BUILD_ERROR%
)
