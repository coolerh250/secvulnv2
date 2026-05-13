-- SecVuln Tracker — Seed Data (mirrors original mock data)
-- Passwords are bcrypt hashes of the originals:
--   superadmin: admin1234
--   alice:      alice1234
--   bob:        bob12345
--   carol:      carol123

INSERT INTO users (username, password_hash, display_name, display_name_en, email, role, active, last_login, created_at)
VALUES
  ('superadmin', '$2a$10$0dSB3RS58HHalRIso/zDeOSLGDIaMOY5k57L47w7dEMgkZHJH0hwW', '系統管理員', 'System Admin', 'superadmin@secvuln.local', 'superadmin', true,  '2026-05-04 09:12:00', '2026-01-01'),
  ('alice',      '$2a$10$tHIATxvOOayefjvBMB5JduZcVU2NTACa1LkHVWP17Hm6ehulMhpai', '王小明',     'Alice Wang',  'alice@secvuln.local',      'admin',      true,  '2026-05-03 14:30:00', '2026-02-15'),
  ('bob',        '$2a$10$J37C9df62wil8FJd1G1RtefJa/Fjp0YD4SYcVqJV/JwbAuRKDAlSm', '李大華',     'Bob Lee',     'bob@secvuln.local',        'user',       true,  '2026-05-02 10:05:00', '2026-03-01'),
  ('carol',      '$2a$10$YWTM4.6vr74W1o7f.b9bI.tZlYeGTrvXZwPYUgJ5LPV/cAkoW/U12', '陳美玲',     'Carol Chen',  'carol@secvuln.local',      'user',       false, '2026-04-28 16:45:00', '2026-03-10')
ON CONFLICT (username) DO NOTHING;

INSERT INTO vulnerabilities (id, vendor, product, firmware_versions, cvss, severity, published, title, title_en, description, description_en, source, recommendation, recommendation_en, refs, handle_status)
VALUES
  ('CVE-2026-21345','Fortinet','FortiGate 60F','["7.0.0-7.0.14","7.2.0-7.2.7"]',9.8,'CRITICAL','2026-04-25','FortiOS SSL-VPN 遠端代碼執行弱點','FortiOS SSL-VPN Remote Code Execution','攻擊者可透過特製的 HTTP 請求在未認證情況下執行任意代碼，影響 FortiOS SSL-VPN 服務。','An attacker can execute arbitrary code via crafted HTTP requests to the SSL-VPN service without authentication.','NVD + Fortinet PSIRT','立即更新至 FortiOS 7.0.15 或 7.2.8','Update to FortiOS 7.0.15 or 7.2.8 immediately','["https://nvd.nist.gov/vuln/detail/CVE-2026-21345","https://fortiguard.com/psirt/FG-IR-26-055"]','pending'),
  ('CVE-2026-20198','Palo Alto','PA-850','["10.1.0-10.1.11","10.2.0-10.2.6"]',8.8,'HIGH','2026-04-22','PAN-OS GlobalProtect 權限提升弱點','PAN-OS GlobalProtect Privilege Escalation','經認證的使用者可透過 GlobalProtect portal 介面提升至管理員權限。','Authenticated users can escalate to admin privileges via the GlobalProtect portal interface.','NVD + PAN Security Advisory','更新至 PAN-OS 10.1.12 或 10.2.7','Update to PAN-OS 10.1.12 or 10.2.7','["https://nvd.nist.gov/vuln/detail/CVE-2026-20198","https://security.paloaltonetworks.com/PAN-SA-2026-0012"]','pending'),
  ('CVE-2026-18877','Fortinet','FortiGate 100F','["7.2.0-7.2.5"]',7.5,'HIGH','2026-04-18','FortiOS 管理介面 XSS 弱點','FortiOS Management Interface XSS Vulnerability','攻擊者可透過特製的管理介面請求注入惡意腳本，竊取管理員 session。','Attackers can inject malicious scripts via crafted management interface requests to steal admin sessions.','Fortinet PSIRT','更新至 FortiOS 7.2.6 或啟用 CSP headers','Update to FortiOS 7.2.6 or enable CSP headers','["https://fortiguard.com/psirt/FG-IR-26-041"]','pending'),
  ('CVE-2026-17654','Palo Alto','PA-3260','["11.0.0-11.0.3"]',6.5,'MEDIUM','2026-04-15','PAN-OS 日誌注入弱點','PAN-OS Log Injection Vulnerability','攻擊者可透過特製封包在系統日誌中注入偽造記錄，影響日誌完整性。','Attackers can inject forged entries into system logs via crafted packets, affecting log integrity.','NVD','更新至 PAN-OS 11.0.4','Update to PAN-OS 11.0.4','["https://nvd.nist.gov/vuln/detail/CVE-2026-17654"]','accepted'),
  ('CVE-2026-16432','Fortinet','FortiGate 200F','["7.4.0-7.4.2"]',9.1,'CRITICAL','2026-04-10','FortiOS IPSec VPN 緩衝區溢位弱點','FortiOS IPSec VPN Buffer Overflow','遠端攻擊者可透過特製的 IKE 封包觸發緩衝區溢位，可能導致服務中斷或代碼執行。','Remote attackers can trigger a buffer overflow via crafted IKE packets, potentially causing DoS or code execution.','NVD + Fortinet PSIRT','立即更新至 FortiOS 7.4.3','Update to FortiOS 7.4.3 immediately','["https://nvd.nist.gov/vuln/detail/CVE-2026-16432","https://fortiguard.com/psirt/FG-IR-26-033"]','pending'),
  ('CVE-2026-15211','Palo Alto','PA-450','["10.2.0-10.2.5"]',5.3,'MEDIUM','2026-04-05','PAN-OS DNS Proxy 資訊洩漏弱點','PAN-OS DNS Proxy Information Disclosure','DNS proxy 功能可能在回應中洩漏內部網路架構資訊。','The DNS proxy feature may leak internal network architecture information in responses.','PAN Security Advisory','更新至 PAN-OS 10.2.6 或停用 DNS proxy','Update to PAN-OS 10.2.6 or disable DNS proxy','["https://security.paloaltonetworks.com/PAN-SA-2026-0009"]','deferred'),
  ('CVE-2026-14088','Fortinet','FortiGate 60F','["7.0.0-7.0.12"]',4.3,'MEDIUM','2026-03-28','FortiOS SNMP 社群字串洩漏弱點','FortiOS SNMP Community String Disclosure','SNMP 設定在特定條件下可能洩漏社群字串明文。','SNMP configuration may disclose community strings in plaintext under specific conditions.','Fortinet PSIRT','更新至 FortiOS 7.0.13 或改用 SNMPv3','Update to FortiOS 7.0.13 or switch to SNMPv3','["https://fortiguard.com/psirt/FG-IR-26-027"]','accepted'),
  ('CVE-2026-13900','Palo Alto','PA-850','["10.1.0-10.1.10","11.0.0-11.0.2"]',3.5,'LOW','2026-03-20','PAN-OS Web UI Session 固定弱點','PAN-OS Web UI Session Fixation','在特定情境下 session ID 未在登入後更新，可能被利用進行 session fixation 攻擊。','Session ID is not updated after login in specific scenarios, potentially exploitable for session fixation.','NVD','更新至最新版本','Update to the latest version','["https://nvd.nist.gov/vuln/detail/CVE-2026-13900"]','fixed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO risk_acceptances (vuln_id, reason, reason_detail, mitigation, mitigation_en, review_date, accepted_date, note)
VALUES
  ('CVE-2026-17654', 'internal_only', '', '已設定 ACL 限制僅允許管理網段存取', 'ACL configured to allow management subnet only', '2026-06-15', '2026-04-16', '下次韌體更新時一併處理'),
  ('CVE-2026-14088', 'compensating', '', '已改用 SNMPv3 作為替代方案', 'Switched to SNMPv3 as alternative', '2026-07-01', '2026-03-29', '')
ON CONFLICT DO NOTHING;

INSERT INTO vuln_notes (vuln_id, text, author, created_at)
VALUES
  ('CVE-2026-17654', '已確認此設備僅內網使用',                            'Admin', '2026-04-16 00:00:00'),
  ('CVE-2026-15211', '等待 PAN-OS 10.2.6 正式版釋出後再處理',             'Admin', '2026-04-06 00:00:00'),
  ('CVE-2026-13900', '已更新至最新版本',                                   'Admin', '2026-04-01 00:00:00')
ON CONFLICT DO NOTHING;

INSERT INTO devices (name, name_en, vendor, model, firmware, status, last_check, vuln_count)
VALUES
  ('總部防火牆-1', 'HQ Firewall-1',     'Fortinet',  'FortiGate 200F', '7.4.1',   'vulnerable',  '2026-04-28', 2),
  ('總部防火牆-2', 'HQ Firewall-2',     'Palo Alto', 'PA-850',         '10.1.11', 'vulnerable',  '2026-04-28', 3),
  ('分部防火牆-A', 'Branch Firewall-A', 'Fortinet',  'FortiGate 60F',  '7.0.15',  'upToDate',    '2026-04-27', 0),
  ('分部防火牆-B', 'Branch Firewall-B', 'Palo Alto', 'PA-450',         '10.2.4',  'updateAvail', '2026-04-26', 1),
  ('DMZ 防火牆',   'DMZ Firewall',      'Fortinet',  'FortiGate 100F', '7.2.5',   'vulnerable',  '2026-04-28', 1)
ON CONFLICT DO NOTHING;

INSERT INTO settings (id, ai_provider, ai_model, notif_email, notif_web, notif_threshold, notif_email_addr, data_sources)
VALUES (1, 'claude', 'claude-sonnet-4', true, true, 'HIGH', 'admin@example.com', '[
  {"id":"nvd","name":"NVD (NIST)","nameEn":"NVD (NIST)","desc":"National Vulnerability Database — 公開 CVE 資料庫","descEn":"National Vulnerability Database — public CVE repository","type":"builtin","url":"https://services.nvd.nist.gov/rest/json/cves/2.0","apiKey":"","requiresKey":true,"keyPlaceholder":"NVD API Key","enabled":true,"lastSync":"2026-05-04 08:00","syncStatus":"ok","syncFreq":"6h"},
  {"id":"fortinet","name":"Fortinet PSIRT","nameEn":"Fortinet PSIRT","desc":"FortiGuard 安全公告","descEn":"FortiGuard Security Advisories","type":"builtin","url":"https://fortiguard.com/psirt","apiKey":"","requiresKey":false,"enabled":true,"lastSync":"2026-05-04 08:05","syncStatus":"ok","syncFreq":"12h"},
  {"id":"paloalto","name":"Palo Alto Networks","nameEn":"Palo Alto Networks","desc":"PAN Security Advisories","descEn":"PAN Security Advisories","type":"builtin","url":"https://security.paloaltonetworks.com","apiKey":"","requiresKey":false,"enabled":true,"lastSync":"2026-05-04 08:10","syncStatus":"ok","syncFreq":"12h"},
  {"id":"cisa_kev","name":"CISA KEV","nameEn":"CISA KEV","desc":"CISA 已知被利用弱點目錄","descEn":"CISA Known Exploited Vulnerabilities","type":"builtin","url":"https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json","apiKey":"","requiresKey":false,"enabled":false,"lastSync":"—","syncStatus":"disabled","syncFreq":"24h"}
]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vuln_trends (month, year, critical_count, high_count, medium_count, low_count)
VALUES
  ('Nov', 2025, 2, 5, 8, 3),
  ('Dec', 2025, 1, 3, 6, 4),
  ('Jan', 2026, 3, 7, 10, 5),
  ('Feb', 2026, 2, 4, 7, 2),
  ('Mar', 2026, 1, 6, 9, 6),
  ('Apr', 2026, 2, 5, 8, 4)
ON CONFLICT (month, year) DO NOTHING;
