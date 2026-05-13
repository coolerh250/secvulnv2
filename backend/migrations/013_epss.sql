ALTER TABLE vulnerabilities
  ADD COLUMN IF NOT EXISTS epss_score      NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS epss_percentile NUMERIC(5,4);
