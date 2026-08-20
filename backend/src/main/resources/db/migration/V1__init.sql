-- ============================================================
-- SMS Gateway Database Schema - V1 Initial Migration
-- ============================================================

-- Tenants (Multi-tenant support)
CREATE TABLE tenants (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    api_key     VARCHAR(64)   NOT NULL UNIQUE,
    description TEXT,
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    rate_limit  INTEGER       NOT NULL DEFAULT 60,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Roles
CREATE TABLE roles (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO roles (name) VALUES ('ROLE_ADMIN'), ('ROLE_USER'), ('ROLE_GATEWAY');

-- Users
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT        REFERENCES tenants(id),
    username        VARCHAR(50)   NOT NULL UNIQUE,
    email           VARCHAR(100)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255)  NOT NULL,
    full_name       VARCHAR(100),
    active          BOOLEAN       NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- User Roles
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

-- Gateways (Android devices)
CREATE TABLE gateways (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT       NOT NULL REFERENCES tenants(id),
    user_id          BIGINT       REFERENCES users(id),
    gateway_uid      VARCHAR(64)  NOT NULL UNIQUE,
    display_name     VARCHAR(100) NOT NULL,
    device_name      VARCHAR(100),
    android_version  VARCHAR(20),
    phone_number     VARCHAR(20),
    sim_operator     VARCHAR(50),
    sim_serial       VARCHAR(50),
    battery_level    INTEGER,
    signal_strength  INTEGER,
    status           VARCHAR(20)  NOT NULL DEFAULT 'OFFLINE'
                         CHECK (status IN ('ONLINE','OFFLINE','SENDING','FAILED')),
    auth_token       VARCHAR(255) NOT NULL UNIQUE,
    last_heartbeat   TIMESTAMPTZ,
    last_sync        TIMESTAMPTZ,
    enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- SMS Queue
CREATE TABLE sms_queue (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL REFERENCES tenants(id),
    gateway_id      BIGINT       REFERENCES gateways(id),
    message_uid     VARCHAR(64)  NOT NULL UNIQUE,
    phone_number    VARCHAR(20)  NOT NULL,
    message         TEXT         NOT NULL,
    message_type    VARCHAR(20)  NOT NULL DEFAULT 'SINGLE'
                        CHECK (message_type IN ('SINGLE','MULTIPART','UNICODE')),
    priority        INTEGER      NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','SENDING','SENT','DELIVERED','FAILED','RETRY','EXPIRED')),
    retry_count     INTEGER      NOT NULL DEFAULT 0,
    max_retries     INTEGER      NOT NULL DEFAULT 3,
    error_message   TEXT,
    scheduled_at    TIMESTAMPTZ,
    assigned_at     TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- SMS History (archived completed records)
CREATE TABLE sms_history (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    gateway_id      BIGINT,
    message_uid     VARCHAR(64)  NOT NULL,
    phone_number    VARCHAR(20)  NOT NULL,
    message         TEXT         NOT NULL,
    message_type    VARCHAR(20)  NOT NULL,
    final_status    VARCHAR(20)  NOT NULL,
    retry_count     INTEGER      NOT NULL DEFAULT 0,
    error_message   TEXT,
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    archived_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Delivery Reports
CREATE TABLE delivery_reports (
    id              BIGSERIAL PRIMARY KEY,
    message_uid     VARCHAR(64)  NOT NULL,
    gateway_uid     VARCHAR(64)  NOT NULL,
    status          VARCHAR(20)  NOT NULL
                        CHECK (status IN ('SENT','DELIVERED','FAILED','TIMEOUT')),
    error_code      VARCHAR(50),
    error_message   TEXT,
    reported_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT       REFERENCES users(id),
    tenant_id       BIGINT,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       VARCHAR(64),
    details         TEXT,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX idx_sms_queue_status ON sms_queue(status);
CREATE INDEX idx_sms_queue_gateway_id ON sms_queue(gateway_id);
CREATE INDEX idx_sms_queue_tenant_id ON sms_queue(tenant_id);
CREATE INDEX idx_sms_queue_priority ON sms_queue(priority DESC, created_at ASC);
CREATE INDEX idx_sms_queue_message_uid ON sms_queue(message_uid);
CREATE INDEX idx_sms_queue_created_at ON sms_queue(created_at);

CREATE INDEX idx_sms_history_tenant_id ON sms_history(tenant_id);
CREATE INDEX idx_sms_history_message_uid ON sms_history(message_uid);
CREATE INDEX idx_sms_history_archived_at ON sms_history(archived_at);

CREATE INDEX idx_delivery_reports_message_uid ON delivery_reports(message_uid);
CREATE INDEX idx_delivery_reports_gateway_uid ON delivery_reports(gateway_uid);

CREATE INDEX idx_gateways_tenant_id ON gateways(tenant_id);
CREATE INDEX idx_gateways_gateway_uid ON gateways(gateway_uid);
CREATE INDEX idx_gateways_status ON gateways(status);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- Seed data
-- ============================================================

-- Default tenant
INSERT INTO tenants (name, api_key, description)
VALUES ('Default Tenant', 'default-api-key-change-this-in-production', 'Default system tenant');

-- Default admin user (password: Admin@123)
INSERT INTO users (tenant_id, username, email, password_hash, full_name)
VALUES (1, 'admin', 'admin@smsgateway.com',
        '$2a$12$7ekHCKU9gG2JZOfMPnoCcOH/eYfuOoBMBQPffINxPHjoNSV4BRIDO', 'System Administrator');

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'admin' AND r.name = 'ROLE_ADMIN';
