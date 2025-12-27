# Start All Components of UWB Tracking System
Write-Host "`n===================================" -ForegroundColor Cyan
Write-Host "  UWB Tracking System Launcher" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This will open 3 separate windows:" -ForegroundColor Yellow
Write-Host "  1. Backend Server (Node.js)" -ForegroundColor White
Write-Host "  2. Frontend (React/Vite)" -ForegroundColor White
Write-Host "  3. Python Simulation" -ForegroundColor White
Write-Host ""

Write-Host "Starting in 3 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Start Backend in new window
Write-Host "Launching Backend Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\start-backend.ps1"
Start-Sleep -Seconds 3

# Start Frontend in new window
Write-Host "Launching Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\start-frontend.ps1"
Start-Sleep -Seconds 5

# Start Python in new window
Write-Host "Launching Python Simulation..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\start-python.ps1"

Write-Host "`n===================================" -ForegroundColor Cyan
Write-Host "All components launched!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access the web app at: http://localhost:5173" -ForegroundColor Yellow
Write-Host "To stop all services, close each PowerShell window" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit this launcher..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
