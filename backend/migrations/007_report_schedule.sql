ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS report_schedules JSONB DEFAULT '[]';
-- 格式: [{ id, name, devices:[id], periodType:'30d'|'90d'|'custom', periodFrom, periodTo, freq:'24h'|'168h'|'manual', format:1|2|3, recipient, lastRun, enabled }]
