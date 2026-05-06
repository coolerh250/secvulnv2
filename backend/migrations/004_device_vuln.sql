-- Per-device vulnerability tracking: each device×vuln pair gets its own handle_status
CREATE TABLE IF NOT EXISTS device_vulnerabilities (
  device_id     INTEGER      NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  vuln_id       VARCHAR(30)  NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  handle_status VARCHAR(20)  NOT NULL DEFAULT 'pending',
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, vuln_id)
);

-- Allow notes and risk acceptances to be scoped to a specific device
ALTER TABLE vuln_notes
  ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL;

ALTER TABLE risk_acceptances
  ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL;
