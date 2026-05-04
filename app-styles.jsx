// Design Tokens & Shared Styles
const TOKENS = {
  bg: '#0a0e1a',
  bgCard: '#131829',
  bgCardHover: '#1a2038',
  bgInput: '#0d1220',
  border: '#1e2540',
  borderFocus: '#00d4aa',
  primary: '#00d4aa',
  primaryDim: 'rgba(0,212,170,0.15)',
  warning: '#f0a030',
  warningDim: 'rgba(240,160,48,0.12)',
  danger: '#f04040',
  dangerDim: 'rgba(240,64,64,0.12)',
  info: '#4090f0',
  infoDim: 'rgba(64,144,240,0.12)',
  medium: '#c0a020',
  mediumDim: 'rgba(192,160,32,0.12)',
  low: '#50b080',
  lowDim: 'rgba(80,176,128,0.12)',
  text: '#e0e4f0',
  textSecondary: '#7880a0',
  textMuted: '#4a5070',
  font: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', 'SF Mono', monospace",
  radius: '8px',
  radiusSm: '6px',
  radiusLg: '12px',
  shadow: '0 2px 12px rgba(0,0,0,0.3)',
};

const SEVERITY_MAP = {
  CRITICAL: { color: TOKENS.danger, bg: TOKENS.dangerDim, label: '嚴重', labelEn: 'Critical', icon: '●' },
  HIGH:     { color: TOKENS.warning, bg: TOKENS.warningDim, label: '高', labelEn: 'High', icon: '●' },
  MEDIUM:   { color: TOKENS.medium, bg: TOKENS.mediumDim, label: '中', labelEn: 'Medium', icon: '●' },
  LOW:      { color: TOKENS.low, bg: TOKENS.lowDim, label: '低', labelEn: 'Low', icon: '●' },
};

// i18n
const LANG = {
  zh: {
    appTitle: 'SecVuln Tracker',
    appSubtitle: '資訊安全弱點追蹤系統',
    dashboard: '儀表板',
    search: '弱點搜尋',
    devices: '設備管理',
    settings: '系統設定',
    totalVulns: '弱點總數',
    criticalVulns: '嚴重弱點',
    affectedDevices: '受影響設備',
    pendingActions: '待處理項目',
    recentVulns: '近期弱點',
    vulnTrend: '弱點趨勢 (近6個月)',
    severityDist: '嚴重程度分佈',
    vendorDist: '廠商分佈',
    searchTitle: '弱點查詢',
    vendor: '廠商',
    product: '產品型號',
    firmware: '韌體版本',
    dateRange: '日期範圍',
    severity: '嚴重程度',
    searchBtn: '搜尋',
    resetBtn: '重置',
    exportPdf: '匯出 PDF',
    exportCsv: '匯出 CSV',
    results: '查詢結果',
    noResults: '無符合條件的結果',
    cveId: 'CVE 編號',
    cvss: 'CVSS 分數',
    published: '發佈日期',
    description: '說明',
    affected: '受影響版本',
    recommendation: '建議措施',
    source: '資料來源',
    deviceList: '設備清單',
    addDevice: '新增設備',
    deviceName: '設備名稱',
    model: '型號',
    firmwareVer: '韌體版本',
    status: '狀態',
    lastCheck: '最後檢查',
    actions: '操作',
    aiProvider: 'AI 分析引擎',
    aiModel: 'AI 模型',
    apiKey: 'API Key',
    notifications: '通知設定',
    emailNotif: 'Email 通知',
    webNotif: '網頁通知',
    notifThreshold: '通知門檻',
    language: '介面語言',
    save: '儲存',
    cancel: '取消',
    updateAvail: '有更新可用',
    upToDate: '已是最新',
    vulnerable: '存在弱點',
    all: '全部',
    from: '從',
    to: '至',
    searchPlaceholder: '輸入 CVE 編號或關鍵字...',
    viewDetail: '查看詳情',
    close: '關閉',
    riskScore: '風險評分',
    topVulns: '高風險弱點 Top 5',
    affectedProducts: '受影響產品',
    firmwareUpdate: '韌體更新',
    configChange: '設定調整',
    mitigations: '緩解措施',
    details: '詳細資訊',
    references: '參考連結',
    trend7d: '7日',
    trend30d: '30日',
    trend90d: '90日',
    newVulns: '新增弱點',
    resolved: '已處理',
    selectAll: '全選',
    deleteSelected: '刪除選取',
    edit: '編輯',
    delete: '刪除',
    check: '立即檢查',
    scanning: '掃描中...',
    aiAnalysis: 'AI 分析',
    analyzing: '分析中...',
    analyzeVuln: '使用 AI 分析此弱點',
    authMethod: '認證方式',
    webAuth: '網頁認證',
    apiKeyAuth: 'API Key',
  },
  en: {
    appTitle: 'SecVuln Tracker',
    appSubtitle: 'Security Vulnerability Tracking System',
    dashboard: 'Dashboard',
    search: 'Vuln Search',
    devices: 'Devices',
    settings: 'Settings',
    totalVulns: 'Total Vulns',
    criticalVulns: 'Critical',
    affectedDevices: 'Affected Devices',
    pendingActions: 'Pending Actions',
    recentVulns: 'Recent Vulnerabilities',
    vulnTrend: 'Vulnerability Trend (6 months)',
    severityDist: 'Severity Distribution',
    vendorDist: 'Vendor Distribution',
    searchTitle: 'Vulnerability Search',
    vendor: 'Vendor',
    product: 'Product',
    firmware: 'Firmware',
    dateRange: 'Date Range',
    severity: 'Severity',
    searchBtn: 'Search',
    resetBtn: 'Reset',
    exportPdf: 'Export PDF',
    exportCsv: 'Export CSV',
    results: 'Results',
    noResults: 'No matching results',
    cveId: 'CVE ID',
    cvss: 'CVSS Score',
    published: 'Published',
    description: 'Description',
    affected: 'Affected Versions',
    recommendation: 'Recommendation',
    source: 'Source',
    deviceList: 'Device List',
    addDevice: 'Add Device',
    deviceName: 'Device Name',
    model: 'Model',
    firmwareVer: 'Firmware Version',
    status: 'Status',
    lastCheck: 'Last Checked',
    actions: 'Actions',
    aiProvider: 'AI Analysis Engine',
    aiModel: 'AI Model',
    apiKey: 'API Key',
    notifications: 'Notifications',
    emailNotif: 'Email Notifications',
    webNotif: 'Web Notifications',
    notifThreshold: 'Alert Threshold',
    language: 'Language',
    save: 'Save',
    cancel: 'Cancel',
    updateAvail: 'Update Available',
    upToDate: 'Up to Date',
    vulnerable: 'Vulnerable',
    all: 'All',
    from: 'From',
    to: 'To',
    searchPlaceholder: 'Enter CVE ID or keyword...',
    viewDetail: 'View Details',
    close: 'Close',
    riskScore: 'Risk Score',
    topVulns: 'Top 5 High-Risk Vulns',
    affectedProducts: 'Affected Products',
    firmwareUpdate: 'Firmware Update',
    configChange: 'Config Change',
    mitigations: 'Mitigations',
    details: 'Details',
    references: 'References',
    trend7d: '7d',
    trend30d: '30d',
    trend90d: '90d',
    newVulns: 'New Vulns',
    resolved: 'Resolved',
    selectAll: 'Select All',
    deleteSelected: 'Delete Selected',
    edit: 'Edit',
    delete: 'Delete',
    check: 'Check Now',
    scanning: 'Scanning...',
    aiAnalysis: 'AI Analysis',
    analyzing: 'Analyzing...',
    analyzeVuln: 'Analyze with AI',
    authMethod: 'Auth Method',
    webAuth: 'Web Auth',
    apiKeyAuth: 'API Key',
  }
};

// Mock Data
const MOCK_VULNS = [
  { id: 'CVE-2026-21345', vendor: 'Fortinet', product: 'FortiGate 60F', firmware: ['7.0.0-7.0.14','7.2.0-7.2.7'], cvss: 9.8, severity: 'CRITICAL', published: '2026-04-25', title: 'FortiOS SSL-VPN 遠端代碼執行弱點', titleEn: 'FortiOS SSL-VPN Remote Code Execution', desc: '攻擊者可透過特製的 HTTP 請求在未認證情況下執行任意代碼，影響 FortiOS SSL-VPN 服務。', descEn: 'An attacker can execute arbitrary code via crafted HTTP requests to the SSL-VPN service without authentication.', source: 'NVD + Fortinet PSIRT', recommendation: '立即更新至 FortiOS 7.0.15 或 7.2.8', recommendationEn: 'Update to FortiOS 7.0.15 or 7.2.8 immediately', refs: ['https://nvd.nist.gov/vuln/detail/CVE-2026-21345','https://fortiguard.com/psirt/FG-IR-26-055'] },
  { id: 'CVE-2026-20198', vendor: 'Palo Alto', product: 'PA-850', firmware: ['10.1.0-10.1.11','10.2.0-10.2.6'], cvss: 8.8, severity: 'HIGH', published: '2026-04-22', title: 'PAN-OS GlobalProtect 權限提升弱點', titleEn: 'PAN-OS GlobalProtect Privilege Escalation', desc: '經認證的使用者可透過 GlobalProtect portal 介面提升至管理員權限。', descEn: 'Authenticated users can escalate to admin privileges via the GlobalProtect portal interface.', source: 'NVD + PAN Security Advisory', recommendation: '更新至 PAN-OS 10.1.12 或 10.2.7', recommendationEn: 'Update to PAN-OS 10.1.12 or 10.2.7', refs: ['https://nvd.nist.gov/vuln/detail/CVE-2026-20198','https://security.paloaltonetworks.com/PAN-SA-2026-0012'] },
  { id: 'CVE-2026-18877', vendor: 'Fortinet', product: 'FortiGate 100F', firmware: ['7.2.0-7.2.5'], cvss: 7.5, severity: 'HIGH', published: '2026-04-18', title: 'FortiOS 管理介面 XSS 弱點', titleEn: 'FortiOS Management Interface XSS Vulnerability', desc: '攻擊者可透過特製的管理介面請求注入惡意腳本，竊取管理員 session。', descEn: 'Attackers can inject malicious scripts via crafted management interface requests to steal admin sessions.', source: 'Fortinet PSIRT', recommendation: '更新至 FortiOS 7.2.6 或啟用 CSP headers', recommendationEn: 'Update to FortiOS 7.2.6 or enable CSP headers', refs: ['https://fortiguard.com/psirt/FG-IR-26-041'] },
  { id: 'CVE-2026-17654', vendor: 'Palo Alto', product: 'PA-3260', firmware: ['11.0.0-11.0.3'], cvss: 6.5, severity: 'MEDIUM', published: '2026-04-15', title: 'PAN-OS 日誌注入弱點', titleEn: 'PAN-OS Log Injection Vulnerability', desc: '攻擊者可透過特製封包在系統日誌中注入偽造記錄，影響日誌完整性。', descEn: 'Attackers can inject forged entries into system logs via crafted packets, affecting log integrity.', source: 'NVD', recommendation: '更新至 PAN-OS 11.0.4', recommendationEn: 'Update to PAN-OS 11.0.4', refs: ['https://nvd.nist.gov/vuln/detail/CVE-2026-17654'] },
  { id: 'CVE-2026-16432', vendor: 'Fortinet', product: 'FortiGate 200F', firmware: ['7.4.0-7.4.2'], cvss: 9.1, severity: 'CRITICAL', published: '2026-04-10', title: 'FortiOS IPSec VPN 緩衝區溢位弱點', titleEn: 'FortiOS IPSec VPN Buffer Overflow', desc: '遠端攻擊者可透過特製的 IKE 封包觸發緩衝區溢位，可能導致服務中斷或代碼執行。', descEn: 'Remote attackers can trigger a buffer overflow via crafted IKE packets, potentially causing DoS or code execution.', source: 'NVD + Fortinet PSIRT', recommendation: '立即更新至 FortiOS 7.4.3', recommendationEn: 'Update to FortiOS 7.4.3 immediately', refs: ['https://nvd.nist.gov/vuln/detail/CVE-2026-16432','https://fortiguard.com/psirt/FG-IR-26-033'] },
  { id: 'CVE-2026-15211', vendor: 'Palo Alto', product: 'PA-450', firmware: ['10.2.0-10.2.5'], cvss: 5.3, severity: 'MEDIUM', published: '2026-04-05', title: 'PAN-OS DNS Proxy 資訊洩漏弱點', titleEn: 'PAN-OS DNS Proxy Information Disclosure', desc: 'DNS proxy 功能可能在回應中洩漏內部網路架構資訊。', descEn: 'The DNS proxy feature may leak internal network architecture information in responses.', source: 'PAN Security Advisory', recommendation: '更新至 PAN-OS 10.2.6 或停用 DNS proxy', recommendationEn: 'Update to PAN-OS 10.2.6 or disable DNS proxy', refs: ['https://security.paloaltonetworks.com/PAN-SA-2026-0009'] },
  { id: 'CVE-2026-14088', vendor: 'Fortinet', product: 'FortiGate 60F', firmware: ['7.0.0-7.0.12'], cvss: 4.3, severity: 'MEDIUM', published: '2026-03-28', title: 'FortiOS SNMP 社群字串洩漏弱點', titleEn: 'FortiOS SNMP Community String Disclosure', desc: 'SNMP 設定在特定條件下可能洩漏社群字串明文。', descEn: 'SNMP configuration may disclose community strings in plaintext under specific conditions.', source: 'Fortinet PSIRT', recommendation: '更新至 FortiOS 7.0.13 或改用 SNMPv3', recommendationEn: 'Update to FortiOS 7.0.13 or switch to SNMPv3', refs: ['https://fortiguard.com/psirt/FG-IR-26-027'] },
  { id: 'CVE-2026-13900', vendor: 'Palo Alto', product: 'PA-850', firmware: ['10.1.0-10.1.10','11.0.0-11.0.2'], cvss: 3.5, severity: 'LOW', published: '2026-03-20', title: 'PAN-OS Web UI Session 固定弱點', titleEn: 'PAN-OS Web UI Session Fixation', desc: '在特定情境下 session ID 未在登入後更新，可能被利用進行 session fixation 攻擊。', descEn: 'Session ID is not updated after login in specific scenarios, potentially exploitable for session fixation.', source: 'NVD', recommendation: '更新至最新版本', recommendationEn: 'Update to the latest version', refs: ['https://nvd.nist.gov/vuln/detail/CVE-2026-13900'] },
];

const MOCK_DEVICES = [
  { id: 1, name: '總部防火牆-1', nameEn: 'HQ Firewall-1', vendor: 'Fortinet', model: 'FortiGate 200F', firmware: '7.4.1', status: 'vulnerable', lastCheck: '2026-04-28', vulnCount: 2 },
  { id: 2, name: '總部防火牆-2', nameEn: 'HQ Firewall-2', vendor: 'Palo Alto', model: 'PA-850', firmware: '10.1.11', status: 'vulnerable', lastCheck: '2026-04-28', vulnCount: 3 },
  { id: 3, name: '分部防火牆-A', nameEn: 'Branch Firewall-A', vendor: 'Fortinet', model: 'FortiGate 60F', firmware: '7.0.15', status: 'upToDate', lastCheck: '2026-04-27', vulnCount: 0 },
  { id: 4, name: '分部防火牆-B', nameEn: 'Branch Firewall-B', vendor: 'Palo Alto', model: 'PA-450', firmware: '10.2.4', status: 'updateAvail', lastCheck: '2026-04-26', vulnCount: 1 },
  { id: 5, name: 'DMZ 防火牆', nameEn: 'DMZ Firewall', vendor: 'Fortinet', model: 'FortiGate 100F', firmware: '7.2.5', status: 'vulnerable', lastCheck: '2026-04-28', vulnCount: 1 },
];

const TREND_DATA = [
  { month: 'Nov', critical: 2, high: 5, medium: 8, low: 3 },
  { month: 'Dec', critical: 1, high: 3, medium: 6, low: 4 },
  { month: 'Jan', critical: 3, high: 7, medium: 10, low: 5 },
  { month: 'Feb', critical: 2, high: 4, medium: 7, low: 2 },
  { month: 'Mar', critical: 1, high: 6, medium: 9, low: 6 },
  { month: 'Apr', critical: 2, high: 5, medium: 8, low: 4 },
];

// Vulnerability handling status
const VULN_STATUS = {
  pending:  { color: TOKENS.textSecondary, bg: 'rgba(120,128,160,0.12)', label: '待處理', labelEn: 'Pending', icon: '○' },
  fixed:    { color: TOKENS.low, bg: TOKENS.lowDim, label: '已修復', labelEn: 'Fixed', icon: '✓' },
  accepted: { color: '#b080e0', bg: 'rgba(176,128,224,0.12)', label: '風險接受', labelEn: 'Risk Accepted', icon: '◆' },
  deferred: { color: TOKENS.info, bg: TOKENS.infoDim, label: '暫不處理', labelEn: 'Deferred', icon: '◇' },
};

const ACCEPT_REASONS = {
  zh: [
    { value: 'internal_only', label: '僅內網存取，風險可控' },
    { value: 'compensating', label: '已有補償控制措施' },
    { value: 'low_impact', label: '實際影響範圍有限' },
    { value: 'vendor_pending', label: '等待廠商修補程式' },
    { value: 'scheduled', label: '已排入維護計畫' },
    { value: 'other', label: '其他' },
  ],
  en: [
    { value: 'internal_only', label: 'Internal access only, risk manageable' },
    { value: 'compensating', label: 'Compensating controls in place' },
    { value: 'low_impact', label: 'Limited actual impact scope' },
    { value: 'vendor_pending', label: 'Awaiting vendor patch' },
    { value: 'scheduled', label: 'Scheduled in maintenance plan' },
    { value: 'other', label: 'Other' },
  ],
};

// Add handling status + notes to mock data
MOCK_VULNS.forEach(v => {
  v.handleStatus = 'pending';
  v.riskAcceptance = null; // { reason, reasonDetail, mitigation, reviewDate, acceptedDate, note }
  v.notes = [];
});
// Simulate some already-handled vulns
MOCK_VULNS[3].handleStatus = 'accepted';
MOCK_VULNS[3].riskAcceptance = { reason: 'internal_only', reasonDetail: '', mitigation: '已設定 ACL 限制僅允許管理網段存取', mitigationEn: 'ACL configured to allow management subnet only', reviewDate: '2026-06-15', acceptedDate: '2026-04-16', note: '下次韌體更新時一併處理' };
MOCK_VULNS[3].notes = [{ text: '已確認此設備僅內網使用', date: '2026-04-16', author: 'Admin' }];

MOCK_VULNS[5].handleStatus = 'deferred';
MOCK_VULNS[5].notes = [{ text: '等待 PAN-OS 10.2.6 正式版釋出後再處理', date: '2026-04-06', author: 'Admin' }];

MOCK_VULNS[6].handleStatus = 'accepted';
MOCK_VULNS[6].riskAcceptance = { reason: 'compensating', reasonDetail: '', mitigation: '已改用 SNMPv3 作為替代方案', mitigationEn: 'Switched to SNMPv3 as alternative', reviewDate: '2026-07-01', acceptedDate: '2026-03-29', note: '' };

MOCK_VULNS[7].handleStatus = 'fixed';
MOCK_VULNS[7].notes = [{ text: '已更新至最新版本', date: '2026-04-01', author: 'Admin' }];

window.TOKENS = TOKENS;
window.SEVERITY_MAP = SEVERITY_MAP;
window.VULN_STATUS = VULN_STATUS;
window.ACCEPT_REASONS = ACCEPT_REASONS;
window.LANG = LANG;
window.MOCK_VULNS = MOCK_VULNS;
window.MOCK_DEVICES = MOCK_DEVICES;
window.TREND_DATA = TREND_DATA;
