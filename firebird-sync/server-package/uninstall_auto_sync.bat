@echo off
setlocal
set "TASK_NAME=PredictionSalesAutoSync"

echo Removing Windows Task Scheduler job: %TASK_NAME% ...
schtasks /Delete /TN "%TASK_NAME%" /F
if errorlevel 1 (
  echo.
  echo [WARNING] Could not remove "%TASK_NAME%" (it may not exist, or run as Administrator).
) else (
  echo.
  echo [SUCCESS] "%TASK_NAME%" has been removed.
)

echo.
pause
