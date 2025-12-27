# Start Python Simulation (kalman_test)
Write-Host "Starting Python Simulation..." -ForegroundColor Cyan

Set-Location -Path "$PSScriptRoot\kalman_test\simulation"

Write-Host "`nChecking Python dependencies..." -ForegroundColor Yellow

# Check if dependencies are installed
$pipList = pip list 2>&1
$hasNumpy = $pipList -match "numpy"
$hasRequests = $pipList -match "requests"
$hasSocketIO = $pipList -match "python-socketio"

if (-Not ($hasNumpy -and $hasRequests -and $hasSocketIO)) {
    Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
    pip install numpy requests python-socketio[client]
}

Write-Host "`nMake sure Backend Server is running on http://localhost:3000" -ForegroundColor Yellow
Write-Host "Python simulation will send data every 0.1 seconds" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow

Start-Sleep -Seconds 2

python main.py
