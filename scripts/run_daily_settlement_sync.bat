@echo off
cd /d "%~dp0\.."
echo ========================================================
echo   NSE Daily 20:30 PM Settlement Auto-Sync & Push Engine
echo ========================================================
python scripts\sync_nse_settlement.py --auto-push
