@echo off
echo Setting up daily 20:35 PM IST NSE Settlement Auto-Sync in Windows Task Scheduler...
schtasks /create /tn "stocksNFT_NSE_Daily_Settlement_Sync" /tr "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%~dp0daily_sync_and_push.ps1\"" /sc weekly /d MON,TUE,WED,THU,FRI /st 20:35 /f
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Windows Task created successfully!
    echo It will run automatically in the background Monday to Friday at 20:35 PM IST.
) else (
    echo [NOTE] If permission was denied, please right-click this .bat file and select 'Run as Administrator'.
)
pause
