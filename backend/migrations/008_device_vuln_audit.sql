ALTER TABLE device_vulnerabilities
  ADD COLUMN IF NOT EXISTS updated_by_name VARCHAR(100);
