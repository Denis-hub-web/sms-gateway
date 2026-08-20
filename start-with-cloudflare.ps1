# ============================================================
# SMS Gateway — Start Backend + Cloudflare Tunnel
# Domain: sms.simukitaa.com
# ============================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SMS Gateway + Cloudflare Tunnel Start " -ForegroundColor Cyan
Write-Host "  Domain: https://sms.simukitaa.com     " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Check Java ---
Write-Host "Checking Java..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1
    Write-Host "OK Java found" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Java not found! Install Java 21" -ForegroundColor Red
    exit 1
}

# --- Check PostgreSQL ---
Write-Host "Checking PostgreSQL (port 5432)..." -ForegroundColor Yellow
$pgCheck = netstat -ano | Select-String ":5432.*LISTENING"
if ($pgCheck) {
    Write-Host "OK PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "ERROR: PostgreSQL is NOT running!" -ForegroundColor Red
    exit 1
}

# --- Kill any existing cloudflared ---
Write-Host ""
Write-Host "Stopping any existing cloudflared..." -ForegroundColor Yellow
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# --- Start Cloudflare Tunnel in background ---
Write-Host "Starting Cloudflare Tunnel for sms.simukitaa.com..." -ForegroundColor Cyan
$cfConfig = "$env:USERPROFILE\.cloudflared\config.yml"
Start-Process -FilePath "cloudflared" `
    -ArgumentList "tunnel", "--config", $cfConfig, "run" `
    -WindowStyle Minimized `
    -RedirectStandardOutput "$scriptDir\cloudflared.log" `
    -RedirectStandardError "$scriptDir\cloudflared-error.log"

Start-Sleep -Seconds 2
Write-Host "OK Cloudflare Tunnel started" -ForegroundColor Green
Write-Host "   Logs: $scriptDir\cloudflared.log" -ForegroundColor Gray

# --- Start Spring Boot Backend ---
Write-Host ""
Write-Host "-------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Public URL:    https://sms.simukitaa.com" -ForegroundColor Green
Write-Host "  Dashboard:     https://sms.simukitaa.com/" -ForegroundColor White
Write-Host "  School Portal: https://sms.simukitaa.com/school-portal" -ForegroundColor White
Write-Host "  Swagger:       https://sms.simukitaa.com/swagger-ui.html" -ForegroundColor White
Write-Host "  Local:         http://localhost:8080" -ForegroundColor Gray
Write-Host "-------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

Set-Location $backendDir
.\mvnw.cmd spring-boot:run
