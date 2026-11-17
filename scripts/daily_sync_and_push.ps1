# Automated 20:30 PM NSE Derivatives Daily Sync & Deployment Script
# Can be executed automatically via Windows Task Scheduler or manually anytime.
param (
    [string]$TargetDate = ""
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  NSE Daily 20:30 PM Settlement Auto-Sync & Push Engine   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$CurrentLocation = Split-Path -Parent $PSScriptRoot
Set-Location $CurrentLocation

if ($TargetDate -ne "") {
    python scripts/sync_nse_settlement.py --date $TargetDate
} else {
    python scripts/sync_nse_settlement.py
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync script exited with error code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`nChecking for changes to push to GitHub / Vercel..." -ForegroundColor Yellow
git add public/data/ src/data/

$DiffCheck = git diff --staged --name-only
if ([string]::IsNullOrWhiteSpace($DiffCheck)) {
    Write-Host "No changes to commit. Data is already up to date!" -ForegroundColor Green
} else {
    $DateStr = Get-Date -Format "yyyy-MM-dd"
    $CommitMsg = "Auto-sync NSE 20:30 PM settlement for $DateStr [automated]"
    Write-Host "Committing and pushing changes: $CommitMsg" -ForegroundColor Cyan
    git commit -m $CommitMsg
    git push origin main
    Write-Host "`n✓ Successfully synced and pushed to GitHub! Vercel is now deploying updated data automatically." -ForegroundColor Green
}
