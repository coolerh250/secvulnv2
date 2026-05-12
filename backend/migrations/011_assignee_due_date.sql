ALTER TABLE vulnerabilities
  ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE device_vulnerabilities
  ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE INDEX IF NOT EXISTS vulnerabilities_due_date_idx ON vulnerabilities (due_date) WHERE due_date IS NOT NULL;
