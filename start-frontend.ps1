# Start Frontend (fe-uwb)
Write-Host "Starting Frontend..." -ForegroundColor Cyan

Set-Location -Path "$PSScriptRoot\fe-uwb"

if (-Not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "`nFrontend starting on http://localhost:5173 (or next available port)" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow

npm run dev
