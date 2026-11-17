# Script to register the scheduled task in Windows Task Scheduler
$ScriptPath = Join-Path $PSScriptRoot "daily_sync_and_push.ps1"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At "20:35"
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    Register-ScheduledTask -TaskName "stocksNFT_NSE_Daily_Settlement_Sync" -Action $Action -Trigger $Trigger -Settings $Settings -Force
    Write-Host "[SUCCESS] Windows Task 'stocksNFT_NSE_Daily_Settlement_Sync' registered successfully!" -ForegroundColor Green
    Write-Host "It will automatically run every weekday (Mon-Fri) at 20:35 IST." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Could not register task: $_" -ForegroundColor Red
}
