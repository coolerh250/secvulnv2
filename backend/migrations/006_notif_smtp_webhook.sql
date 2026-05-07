ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS notif_smtp_host     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notif_smtp_port     INTEGER DEFAULT 587,
  ADD COLUMN IF NOT EXISTS notif_smtp_user     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notif_smtp_pass     TEXT,
  ADD COLUMN IF NOT EXISTS notif_smtp_from     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notif_webhook_url   TEXT,
  ADD COLUMN IF NOT EXISTS notif_webhook_type  VARCHAR(20) DEFAULT 'teams',
  ADD COLUMN IF NOT EXISTS notif_webhook_token TEXT;
