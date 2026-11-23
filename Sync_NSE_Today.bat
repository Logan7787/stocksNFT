@echo off
cd /d "%~dp0"
echo ========================================================
echo   stocksNFT: Instant NSE Settlement Sync & Deploy
echo ========================================================
echo [1/3] Pulling latest cloud updates...
git pull --rebase origin main
echo [2/3] Fetching and parsing official NSE Settlement...
python scripts\sync_nse_settlement.py --auto-push
echo.
echo Sync and deployment completed! Press any key to close.
pause
