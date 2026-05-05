-- Add device_type to devices for more precise vulnerability matching
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) NOT NULL DEFAULT '';

-- Add affected_products to vulnerabilities (array of lowercase CPE product names)
ALTER TABLE vulnerabilities ADD COLUMN IF NOT EXISTS affected_products JSONB NOT NULL DEFAULT '[]';
