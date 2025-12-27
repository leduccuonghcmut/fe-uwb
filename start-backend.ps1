# Start Backend Server (be-uwb)
Write-Host "Starting Backend Server..." -ForegroundColor Cyan

Set-Location -Path "$PSScriptRoot\be-uwb"

if (-Not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "`nBackend server starting on http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow

npm run dev
