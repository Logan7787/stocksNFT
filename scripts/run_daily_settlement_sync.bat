@echo off
cd /d "%~dp0\.."
powershell.exe -ExecutionPolicy Bypass -File "%~dp0daily_sync_and_push.ps1"
pause
