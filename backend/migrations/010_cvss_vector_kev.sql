ALTER TABLE vulnerabilities ADD COLUMN IF NOT EXISTS cvss_vector VARCHAR(100);
ALTER TABLE vulnerabilities ADD COLUMN IF NOT EXISTS is_kev BOOLEAN DEFAULT false;
ALTER TABLE vulnerabilities ADD COLUMN IF NOT EXISTS kev_due_date DATE;

CREATE INDEX IF NOT EXISTS vulnerabilities_is_kev_idx ON vulnerabilities (is_kev) WHERE is_kev = true;
