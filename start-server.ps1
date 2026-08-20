# ============================================================
# SMS Gateway — Quick Start Script
# Run this after installing Java 21 and PostgreSQL
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SMS Gateway Backend - Quick Start    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Java
Write-Host "Checking Java..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1
    Write-Host "✅ Java found: $($javaVersion[0])" -ForegroundColor Green
} catch {
    Write-Host "❌ Java not found! Please install Java 21 from https://adoptium.net" -ForegroundColor Red
    Write-Host "   After installing, close and reopen PowerShell, then run this script again."
    Read-Host "Press Enter to exit"
    exit 1
}

# Check PostgreSQL
Write-Host "Checking PostgreSQL..." -ForegroundColor Yellow
$pgPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
if (Test-Path $pgPath) {
    Write-Host "✅ PostgreSQL found" -ForegroundColor Green
    
    # Create database if not exists
    Write-Host "Creating database 'smsgateway' if not exists..." -ForegroundColor Yellow
    & "C:\Program Files\PostgreSQL\16\bin\createdb.exe" -U postgres smsgateway 2>$null
    Write-Host "✅ Database ready" -ForegroundColor Green
} else {
    Write-Host "⚠️  PostgreSQL not found at default path. Make sure it's installed and running." -ForegroundColor Yellow
    Write-Host "   Download from: https://www.postgresql.org/download/windows/"
    Write-Host "   If installed elsewhere, update this script with your path."
    Write-Host ""
}

# Get local IP
Write-Host ""
Write-Host "Your local IP addresses:" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } | ForEach-Object {
    Write-Host "  📍 $($_.IPAddress) (Interface: $($_.InterfaceAlias))" -ForegroundColor White
}
Write-Host ""
Write-Host "👆 Use one of these IPs in the Android app's BASE_URL setting" -ForegroundColor Yellow
Write-Host "   Format: http://YOUR_IP:8080/"
Write-Host ""

# Start backend
Write-Host "Starting Spring Boot backend..." -ForegroundColor Cyan
Write-Host "(First run will download dependencies — this takes 2-5 minutes)" -ForegroundColor Yellow
Write-Host ""
Write-Host "When you see 'Started SmsGatewayApplication', open:" -ForegroundColor Green
Write-Host "  🌐 Swagger UI:      http://localhost:8080/swagger-ui.html" -ForegroundColor White
Write-Host "  📊 Admin Dashboard: Open admin-dashboard\index.html in browser" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server"
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"

Set-Location $backendDir
.\mvnw.cmd spring-boot:run
