-- SecVuln Tracker — Initial Schema

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name     VARCHAR(100),
  display_name_en  VARCHAR(100),
  email         VARCHAR(255) UNIQUE,
  role          VARCHAR(20)  NOT NULL DEFAULT 'user',
  active        BOOLEAN      NOT NULL DEFAULT true,
  last_login    TIMESTAMP,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vulnerabilities (
  id                 VARCHAR(50)  PRIMARY KEY,
  vendor             VARCHAR(100),
  product            VARCHAR(100),
  firmware_versions  JSONB        NOT NULL DEFAULT '[]',
  cvss               NUMERIC(3,1) NOT NULL DEFAULT 0,
  severity           VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
  published          DATE,
  title              VARCHAR(255),
  title_en           VARCHAR(255),
  description        TEXT,
  description_en     TEXT,
  source             VARCHAR(255),
  recommendation     TEXT,
  recommendation_en  TEXT,
  refs               JSONB        NOT NULL DEFAULT '[]',
  handle_status      VARCHAR(20)  NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_acceptances (
  id             SERIAL PRIMARY KEY,
  vuln_id        VARCHAR(50) NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  reason         VARCHAR(50),
  reason_detail  TEXT,
  mitigation     TEXT,
  mitigation_en  TEXT,
  review_date    DATE,
  accepted_date  DATE,
  note           TEXT,
  accepted_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vuln_notes (
  id         SERIAL PRIMARY KEY,
  vuln_id    VARCHAR(50) NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  text       TEXT        NOT NULL,
  author     VARCHAR(100),
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100),
  name_en    VARCHAR(100),
  vendor     VARCHAR(100),
  model      VARCHAR(100),
  firmware   VARCHAR(50),
  status     VARCHAR(20)  NOT NULL DEFAULT 'upToDate',
  last_check DATE,
  vuln_count INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id                 INTEGER  PRIMARY KEY DEFAULT 1,
  ai_provider        VARCHAR(50)  NOT NULL DEFAULT 'claude',
  ai_model           VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4',
  ai_api_key         TEXT,
  ai_auth_method     VARCHAR(20)  NOT NULL DEFAULT 'webauth',
  notif_email        BOOLEAN      NOT NULL DEFAULT true,
  notif_web          BOOLEAN      NOT NULL DEFAULT true,
  notif_threshold    VARCHAR(20)  NOT NULL DEFAULT 'HIGH',
  notif_email_addr   VARCHAR(255) DEFAULT 'admin@example.com',
  interface_language VARCHAR(10)  NOT NULL DEFAULT 'zh',
  data_sources       JSONB        NOT NULL DEFAULT '[]',
  updated_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vuln_trends (
  id             SERIAL PRIMARY KEY,
  month          VARCHAR(10) NOT NULL,
  year           INTEGER     NOT NULL,
  critical_count INTEGER     NOT NULL DEFAULT 0,
  high_count     INTEGER     NOT NULL DEFAULT 0,
  medium_count   INTEGER     NOT NULL DEFAULT 0,
  low_count      INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (month, year)
);
