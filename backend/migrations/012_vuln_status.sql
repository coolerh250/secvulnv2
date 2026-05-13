ALTER TABLE vulnerabilities
  ADD COLUMN IF NOT EXISTS vuln_status VARCHAR(50);
