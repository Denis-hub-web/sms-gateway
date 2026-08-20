ALTER TABLE api_keys 
ADD COLUMN gateway_id BIGINT REFERENCES gateways(id) ON DELETE SET NULL;

ALTER TABLE gateways
ADD COLUMN sim_verified BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN verification_pin VARCHAR(10);

CREATE INDEX idx_api_keys_gateway ON api_keys(gateway_id);
