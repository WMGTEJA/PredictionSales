@echo off
setlocal
set "TASK_NAME=PredictionSalesAutoSync"
set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
set "EXE_PATH=%APP_DIR%\sync_to_supabase.exe"

if not exist "%EXE_PATH%" (
  echo [ERROR] Could not find %EXE_PATH%
  echo Make sure install_auto_sync.bat is in the same folder as sync_to_supabase.exe.
  pause
  exit /b 1
)

if not exist "%APP_DIR%\.env" (
  echo [ERROR] Could not find %APP_DIR%\.env
  echo Please copy your .env file into this folder before installing.
  pause
  exit /b 1
)

echo ============================================================
echo  Installing Windows Task Scheduler job: %TASK_NAME%
echo  Executable : %EXE_PATH%
echo  Schedule   : Every 15 minutes (silent, runs as SYSTEM)
echo ============================================================
echo.

schtasks /Create /TN "%TASK_NAME%" /TR "\"%EXE_PATH%\"" /SC MINUTE /MO 15 /RU "SYSTEM" /RL HIGHEST /F
if errorlevel 1 (
  echo.
  echo [ERROR] Failed to create scheduled task.
  echo Please right-click install_auto_sync.bat and choose "Run as administrator".
  pause
  exit /b 1
)

echo.
echo Running an initial test sync now...
"%EXE_PATH%"
if errorlevel 1 (
  echo.
  echo [WARNING] The task was installed, but the test sync reported an error.
  echo Check "%APP_DIR%\sync.log" for details.
) else (
  echo.
  echo [SUCCESS] Auto-sync is installed and initial sync succeeded!
  echo Logs are saved to: "%APP_DIR%\sync.log"
)

echo.
pause
