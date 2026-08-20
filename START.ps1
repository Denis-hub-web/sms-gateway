# ================================================================
# SMS Gateway - FULL RESTART SCRIPT
# Domain: https://sms.simukitaa.com
# Run this script every time you want to start the server
# ================================================================

$projectDir = "c:\Users\ADMIN\.gemini\antigravity-ide\scratch\sms-gateway"
$backendDir  = "$projectDir\backend"
$cfConfig    = "C:\Users\ADMIN\.cloudflared\config.yml"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   SMS Gateway - Starting Up..." -ForegroundColor Cyan
Write-Host "   https://sms.simukitaa.com" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ── STEP 1: Check Java ─────────────────────────────────────────
Write-Host "[1/4] Checking Java 21..." -ForegroundColor Yellow
$java = java -version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Java not found! Install Java 21 from https://adoptium.net" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  OK: $($java[0])" -ForegroundColor Green

# ── STEP 2: Check PostgreSQL ────────────────────────────────────
Write-Host "[2/4] Checking PostgreSQL (port 5432)..." -ForegroundColor Yellow
$pg = netstat -ano | Select-String ":5432.*LISTENING"
if (-not $pg) {
    Write-Host "  ERROR: PostgreSQL is NOT running!" -ForegroundColor Red
    Write-Host "  Start it from: Services (services.msc) -> postgresql-x64-16 -> Start" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  OK: PostgreSQL is running" -ForegroundColor Green

# ── STEP 3: Start Cloudflare Tunnel ────────────────────────────
Write-Host "[3/4] Starting Cloudflare Tunnel (sms.simukitaa.com)..." -ForegroundColor Yellow

# Kill any stale cloudflared process
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# Launch tunnel as a background managed process
$cfLog = "$projectDir\cloudflared.log"
$cfErrLog = "$projectDir\cloudflared-error.log"

# Use cmd /c to properly run cloudflared in background
$cfArgs = "tunnel --config `"$cfConfig`" run"
Start-Process -FilePath "cmd" `
    -ArgumentList "/c cloudflared $cfArgs >> `"$cfLog`" 2>> `"$cfErrLog`"" `
    -WindowStyle Hidden

Start-Sleep -Seconds 4

# Verify tunnel process is alive
$cfProc = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if ($cfProc) {
    Write-Host "  OK: Cloudflare Tunnel running (PID $($cfProc.Id))" -ForegroundColor Green
    Write-Host "  Logs: $cfLog" -ForegroundColor Gray
} else {
    Write-Host "  WARNING: cloudflared may not have started - check $cfErrLog" -ForegroundColor Yellow
}

# ── STEP 4: Start Spring Boot Backend ──────────────────────────
Write-Host "[4/4] Starting Spring Boot Backend on port 8080..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  (First run downloads Maven dependencies - takes 2-5 min)" -ForegroundColor Gray
Write-Host ""
Write-Host "================================================" -ForegroundColor DarkGray
Write-Host "  Public:         https://sms.simukitaa.com" -ForegroundColor Green
Write-Host "  Admin Login:    https://sms.simukitaa.com/" -ForegroundColor White
Write-Host "  School Portal:  https://sms.simukitaa.com/school-portal" -ForegroundColor White
Write-Host "  Swagger API:    https://sms.simukitaa.com/swagger-ui.html" -ForegroundColor White
Write-Host "  Local only:     http://localhost:8080" -ForegroundColor Gray
Write-Host "  Default login:  admin / Admin@123" -ForegroundColor Gray
Write-Host "================================================" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Press Ctrl+C to STOP the backend" -ForegroundColor Yellow
Write-Host "  (Cloudflare tunnel will keep running in background)" -ForegroundColor Gray
Write-Host ""

Set-Location $backendDir
.\mvnw.cmd spring-boot:run
