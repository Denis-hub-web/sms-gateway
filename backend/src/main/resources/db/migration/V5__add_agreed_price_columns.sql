-- ============================================================
-- V5: Add Agreed Price Columns for School Tenant Price Locking
-- ============================================================

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS agreed_monthly_price_tzs INTEGER DEFAULT 25000,
    ADD COLUMN IF NOT EXISTS agreed_setup_fee_tzs     INTEGER DEFAULT 150000;
