# Script to register the scheduled task in Windows Task Scheduler
$PythonExe = "C:\Users\WELCOME\AppData\Local\Programs\Python\Python310\python.exe"
$ScriptPath = Join-Path $PSScriptRoot "sync_nse_settlement.py"
$WorkingDir = Split-Path -Parent $PSScriptRoot

$Action = New-ScheduledTaskAction -Execute $PythonExe -Argument "`"$ScriptPath`" --auto-push" -WorkingDirectory $WorkingDir
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At "20:35"
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    Register-ScheduledTask -TaskName "stocksNFT_NSE_Daily_Settlement_Sync" -Action $Action -Trigger $Trigger -Settings $Settings -Force
    Write-Host "[SUCCESS] Windows Task 'stocksNFT_NSE_Daily_Settlement_Sync' registered directly with Python!" -ForegroundColor Green
    Write-Host "Action: $PythonExe `"$ScriptPath`" --auto-push" -ForegroundColor Green
    Write-Host "It will automatically run every weekday (Mon-Fri) at 20:35 IST with StartWhenAvailable enabled." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Could not register task: $_" -ForegroundColor Red
}
