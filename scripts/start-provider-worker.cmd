@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%run-provider-discovery.ps1"

echo.
echo Navigate Wealth Provider Portal Worker
echo.
echo Choose a mode:
echo   1. Discover selectors
echo   2. Dry run extraction
echo   3. Stage rows after successful dry run
echo.
set /p MODE_CHOICE="Enter 1, 2, or 3: "

if "%MODE_CHOICE%"=="1" set "MODE=discover"
if "%MODE_CHOICE%"=="2" set "MODE=dry-run"
if "%MODE_CHOICE%"=="3" set "MODE=run"

if "%MODE%"=="" (
  echo Invalid choice.
  pause
  exit /b 1
)

set /p HEADED_CHOICE="Show browser window? y/N: "
set "HEADED_ARG="
if /I "%HEADED_CHOICE%"=="y" set "HEADED_ARG=-Headed"

powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -File "%PS_SCRIPT%" -Mode "%MODE%" %HEADED_ARG%

endlocal
