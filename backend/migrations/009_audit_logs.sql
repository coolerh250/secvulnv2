CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username    VARCHAR(100),
  role        VARCHAR(20),
  action      VARCHAR(60) NOT NULL,
  category    VARCHAR(30) NOT NULL,
  target_id   VARCHAR(100),
  target_name VARCHAR(255),
  detail      JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_category_idx   ON audit_logs (category);
CREATE INDEX IF NOT EXISTS audit_logs_username_idx   ON audit_logs (username);

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS log_retention_days INTEGER DEFAULT 90;

GRANT ALL ON TABLE audit_logs TO secvulnv2;
GRANT USAGE, SELECT ON SEQUENCE audit_logs_id_seq TO secvulnv2;
