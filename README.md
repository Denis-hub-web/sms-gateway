# 📡 Android SMS Gateway — Production-Ready System

A full-stack SMS Gateway platform that enables remote web applications to send SMS automatically through Android phones.

---

## 🏗️ Project Structure

```
sms-gateway/
├── backend/                    # Spring Boot REST API (Java 21)
│   ├── src/main/java/com/smsgateway/
│   │   ├── config/             # Security, Swagger, CORS
│   │   ├── controller/         # REST Controllers
│   │   ├── dto/                # Request/Response DTOs
│   │   ├── entity/             # JPA Entities + Enums
│   │   ├── exception/          # Global Exception Handler
│   │   ├── repository/         # Spring Data JPA Repositories
│   │   ├── security/           # JWT Provider, Filter, UserDetails
│   │   └── service/            # Business Logic + Scheduler
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── db/migration/       # Flyway SQL migrations
│   ├── Dockerfile
│   └── pom.xml
│
├── android/                    # Android SMS Gateway App (Kotlin)
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml
│   │   └── kotlin/com/smsgateway/
│   │       ├── SmsGatewayApp.kt    # Hilt Application
│   │       ├── di/                 # Hilt DI Modules
│   │       ├── data/
│   │       │   ├── local/          # Room DB, Entities, DAOs, SessionManager
│   │       │   ├── remote/         # Retrofit API Service + DTOs
│   │       │   └── repository/     # Repository Implementation
│   │       ├── domain/
│   │       │   ├── model/          # Domain Models
│   │       │   └── repository/     # Repository Interface
│   │       ├── presentation/
│   │       │   ├── MainActivity.kt
│   │       │   ├── navigation/     # NavHost
│   │       │   ├── login/          # Login Screen + ViewModel
│   │       │   ├── dashboard/      # Dashboard Screen + ViewModel
│   │       │   ├── queue/          # SMS Queue Screen
│   │       │   ├── logs/           # Event Logs Screen
│   │       │   └── theme/          # Material 3 Dark Theme
│   │       ├── service/
│   │       │   ├── GatewayForegroundService.kt
│   │       │   └── SmsWorker.kt    # Core WorkManager worker
│   │       └── receiver/
│   │           ├── BootReceiver.kt
│   │           └── SmsStatusReceiver.kt
│   ├── gradle/libs.versions.toml
│   └── build.gradle.kts
│
├── admin-dashboard/            # HTML/CSS/JS Admin Dashboard
│   ├── index.html
│   ├── style.css
│   └── dashboard.js
│
└── docker-compose.yml          # Full-stack deployment
```

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
cd sms-gateway
docker compose up -d
```

- **Backend API**: http://localhost:8080
- **Swagger UI**: http://localhost:8080/swagger-ui.html
- **Admin Dashboard**: http://localhost:3000

### Option 2: Manual Setup

**Prerequisites**: Java 21, Maven, PostgreSQL 16

```bash
# 1. Start PostgreSQL
createdb smsgateway

# 2. Start backend
cd backend
./mvnw spring-boot:run

# 3. Open admin dashboard in browser
# Open admin-dashboard/index.html
```

---

## 🔐 Default Credentials

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `Admin@123` |

> ⚠️ Change these immediately in production!

---

## 📱 Android App Setup

1. Open `android/` in Android Studio
2. Edit `app/build.gradle.kts` → set `BASE_URL` to your server
3. Build & install on Android phone (API 26+)
4. Login with admin credentials
5. The app auto-registers as a gateway
6. Toggle the switch ON to start receiving SMS jobs

### Required Android Permissions
- `SEND_SMS` — To send messages
- `RECEIVE_BOOT_COMPLETED` — Auto-start after reboot
- `FOREGROUND_SERVICE` — Background operation
- `READ_PHONE_STATE` — SIM info
- `INTERNET` — Server communication

---

## 🌐 API Reference

### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{ "username": "admin", "password": "Admin@123" }
```

### Send SMS
```http
POST /api/sms/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "phoneNumber": "+254700000000",
  "message": "Hello from SMS Gateway!",
  "priority": 5
}
```

### Get Dashboard Stats
```http
GET /api/dashboard
Authorization: Bearer {token}
```

### Get Jobs (Android app calls this)
```http
GET /api/gateway/jobs
Authorization: Bearer {gateway-token}
```

### Submit Delivery Report (Android app)
```http
POST /api/gateway/report
Authorization: Bearer {gateway-token}
Content-Type: application/json

{
  "messageId": "uuid-here",
  "status": "DELIVERED",
  "errorCode": null,
  "errorMessage": null
}
```

### Heartbeat (Android app, every 30s)
```http
POST /api/gateway/heartbeat
Authorization: Bearer {gateway-token}
```

---

## 📊 SMS Status Flow

```
PENDING → SENDING → SENT → DELIVERED
                 ↓         ↓
               FAILED → RETRY (up to 3x)
                           ↓
                         EXPIRED
```

---

## 🔒 Security

| Layer | Implementation |
|---|---|
| API Authentication | JWT (15-min access + 7-day refresh) |
| Gateway Authentication | Long-lived JWT (1 year) |
| Token Storage (Android) | AES256-GCM EncryptedSharedPreferences |
| Password Hashing | BCrypt (strength 12) |
| Transport | HTTPS (configure in production) |
| Audit Trail | All sensitive operations logged |
| Rate Limiting | Configurable per-tenant via `bucket4j` |

---

## ⚙️ Configuration

Edit `backend/src/main/resources/application.yml`:

```yaml
app:
  jwt:
    secret: "your-min-256-bit-secret"
    access-token-expiry-ms: 900000       # 15 min
  gateway:
    job-batch-size: 10
    heartbeat-timeout-seconds: 120
    max-retry-attempts: 3
    message-delay-ms: 1000               # Delay between SMS sends
  rate-limit:
    sms-send-per-minute: 60
```

---

## 🧪 Running Tests

```bash
cd backend
./mvnw test
```

Tests cover:
- `AuthService` — Login success and bad credentials
- `SmsService` — Single, multipart, and unicode message type detection

---

## 🏛️ Architecture

### Clean Architecture Layers

```
Android App:
  Presentation → ViewModel → UseCase → Repository Interface → Data Layer

Backend:
  Controller → Service → Repository → JPA Entity → PostgreSQL
```

### Key Design Decisions
- **WorkManager** ensures SMS polling survives process death and respects battery
- **EncryptedSharedPreferences** for secure token storage on Android
- **Flyway** for database versioning and schema management
- **Multi-tenant** design — each customer has isolated gateways
- **Idempotent registration** — re-registering a gateway returns the same token
- **Delivery reports** via Android broadcast receivers → server
- **Heartbeat scheduler** marks stale gateways offline every 30s

---

## 📞 Supported SMS Types

| Type | Detection | Notes |
|---|---|---|
| Single | ≤160 ASCII chars | Standard GSM |
| Multipart | >160 ASCII chars | Auto-split by SmsManager |
| Unicode | Any non-ASCII char | Supports emoji, Arabic, Swahili, etc. |

---

## 🚧 Production Checklist

- [ ] Change `JWT_SECRET` to a 256-bit random value
- [ ] Change default admin password
- [ ] Enable HTTPS (configure behind nginx/load balancer)
- [ ] Set `app.gateway.max-retry-attempts` per your SLA
- [ ] Configure rate limiting per tenant
- [ ] Enable database backups
- [ ] Set up monitoring (Spring Actuator → Prometheus → Grafana)
- [ ] Configure `CORS_ORIGINS` to your exact domains
