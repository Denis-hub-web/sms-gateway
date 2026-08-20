-- ============================================================
-- V4: School SaaS Multi-Tenant Subscription Schema
-- ============================================================

-- Extend tenants table with school-specific fields
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS school_name         VARCHAR(200),
    ADD COLUMN IF NOT EXISTS school_code         VARCHAR(20) UNIQUE,
    ADD COLUMN IF NOT EXISTS school_type         VARCHAR(20) DEFAULT 'PRIVATE',
    ADD COLUMN IF NOT EXISTS region              VARCHAR(100),
    ADD COLUMN IF NOT EXISTS contact_phone       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS contact_email       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS student_count       INTEGER,
    ADD COLUMN IF NOT EXISTS setup_fee_paid      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS subscription_plan   VARCHAR(20) DEFAULT 'STARTER',
    ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'INACTIVE',
    ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approved_by_admin   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS registration_notes  TEXT;

-- Subscriptions payment history table
CREATE TABLE IF NOT EXISTS subscriptions (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan                VARCHAR(20) NOT NULL,
    type                VARCHAR(20) NOT NULL CHECK (type IN ('SETUP_FEE','MONTHLY','YEARLY','TERMLY')),
    amount_tzs          INTEGER NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING','PAID','FAILED','REFUNDED')),
    payment_method      VARCHAR(50),
    payment_reference   VARCHAR(100),
    period_start        TIMESTAMPTZ,
    period_end          TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Update default tenant to be approved and active (existing admin account)
UPDATE tenants
SET school_name = 'Default Tenant',
    school_code = 'SYS-001',
    setup_fee_paid = true,
    subscription_plan = 'PREMIUM',
    subscription_status = 'ACTIVE',
    approved_by_admin = true,
    approved_at = NOW()
WHERE id = 1;
