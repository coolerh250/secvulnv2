-- SecVuln Tracker — Seed Data
-- Only essential bootstrap data; all vulnerability/device data comes from live syncs.
--
-- Default credentials:
--   superadmin: admin1234  (change immediately after first login)

INSERT INTO users (username, password_hash, display_name, display_name_en, email, role, active, created_at)
VALUES
  ('superadmin', '$2a$10$0dSB3RS58HHalRIso/zDeOSLGDIaMOY5k57L47w7dEMgkZHJH0hwW', '系統管理員', 'System Admin', 'superadmin@secvuln.local', 'superadmin', true, NOW())
ON CONFLICT (username) DO NOTHING;

INSERT INTO settings (id, ai_provider, ai_model, notif_email, notif_web, notif_threshold, notif_email_addr, data_sources)
VALUES (1, 'claude', 'claude-sonnet-4', true, true, 'HIGH', 'admin@example.com', '[
  {"id":"nvd","name":"NVD (NIST)","nameEn":"NVD (NIST)","desc":"National Vulnerability Database — 公開 CVE 資料庫","descEn":"National Vulnerability Database — public CVE repository","type":"builtin","url":"https://services.nvd.nist.gov/rest/json/cves/2.0","apiKey":"","requiresKey":true,"keyPlaceholder":"NVD API Key","enabled":true,"lastSync":"","syncStatus":"pending","syncFreq":"6h"},
  {"id":"fortinet","name":"Fortinet PSIRT","nameEn":"Fortinet PSIRT","desc":"FortiGuard 安全公告","descEn":"FortiGuard Security Advisories","type":"builtin","url":"https://fortiguard.com/psirt","apiKey":"","requiresKey":false,"enabled":true,"lastSync":"","syncStatus":"pending","syncFreq":"12h"},
  {"id":"paloalto","name":"Palo Alto Networks","nameEn":"Palo Alto Networks","desc":"PAN Security Advisories","descEn":"PAN Security Advisories","type":"builtin","url":"https://security.paloaltonetworks.com","apiKey":"","requiresKey":false,"enabled":true,"lastSync":"","syncStatus":"pending","syncFreq":"12h"},
  {"id":"cisa_kev","name":"CISA KEV","nameEn":"CISA KEV","desc":"CISA 已知被利用弱點目錄","descEn":"CISA Known Exploited Vulnerabilities","type":"builtin","url":"https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json","apiKey":"","requiresKey":false,"enabled":false,"lastSync":"","syncStatus":"disabled","syncFreq":"24h"}
]')
ON CONFLICT (id) DO NOTHING;
