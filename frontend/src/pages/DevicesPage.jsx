import { useState, useEffect, Fragment } from 'react';
import { TOKENS, t } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import { deviceApi, deviceVulnApi } from '../services/api';
import { Card, Btn, InputField, SelectField, Badge, CvssBar, VulnStatusBadge } from '../components/ui';
import { Icons } from '../components/Icons';
import { VulnDetailModal } from '../components/VulnDetailModal';

// ---------------------------------------------------------------------------
// Firmware version matching (mirrors backend deviceController logic)
// ---------------------------------------------------------------------------
function parseVer(str) {
  return String(str).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
}
function cmpVer(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}
function affectsDevice(deviceFirmware, firmwareVersions) {
  if (!deviceFirmware) return true;
  if (!firmwareVersions || firmwareVersions.length === 0) return true;
  const dev = parseVer(deviceFirmware);
  for (const range of firmwareVersions) {
    const parts = range.split(/\s[–-]\s/); // en-dash or hyphen
    if (parts.length === 1) {
      if (cmpVer(dev, parseVer(parts[0].trim())) === 0) return true;
    } else {
      const start = parseVer(parts[0].trim());
      const endStr = parts[1].trim();
      const exclusive = endStr.startsWith('<');
      const end = parseVer(endStr.replace('<', '').trim());
      const inRange = cmpVer(dev, start) >= 0 &&
        (exclusive ? cmpVer(dev, end) < 0 : cmpVer(dev, end) <= 0);
      if (inRange) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Device type / product matching (mirrors backend deviceController logic)
// ---------------------------------------------------------------------------

const DEVICE_TYPE_PRODUCTS = {
  'FortiGate':     ['fortios', 'fortios ips engine'],
  'FortiWiFi':     ['fortios', 'fortiwifi'],
  'FortiAnalyzer': ['fortianalyzer'],
  'FortiManager':  ['fortimanager'],
  'FortiProxy':    ['fortiproxy'],
  'FortiADC':      ['fortiadc'],
  'FortiMail':     ['fortimail'],
  'FortiWeb':      ['fortiweb'],
  'PA-Series':     ['pan-os'],
  'Panorama':      ['panorama', 'pan-os'],
};

const DEVICE_TYPE_OPTIONS = {
  'Fortinet':  ['FortiGate', 'FortiWiFi', 'FortiAnalyzer', 'FortiManager', 'FortiProxy', 'FortiADC', 'FortiMail', 'FortiWeb'],
  'Palo Alto': ['PA-Series', 'Panorama'],
};

function isProductMatch(deviceType, affectedProducts, productText) {
  if (!deviceType) return true;
  const expected = DEVICE_TYPE_PRODUCTS[deviceType];
  if (!expected) return true;
  if (affectedProducts && affectedProducts.length > 0) {
    const ap = affectedProducts.map(p => String(p).toLowerCase());
    return expected.some(e => ap.some(p => p === e || p.startsWith(e)));
  }
  if (productText) {
    const lower = productText.toLowerCase();
    return expected.some(e => lower.includes(e));
  }
  return true;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DeviceForm({ form, setForm, lang, onSave, onCancel }) {
  const typeOpts = (DEVICE_TYPE_OPTIONS[form.vendor] || []).map(v => ({ value: v, label: v }));
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 12 }}>
        <InputField label={t(lang, 'deviceName')} value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder={lang === 'zh' ? '例：總部防火牆' : 'e.g. HQ Firewall'} />
        <SelectField label={t(lang, 'vendor')} value={form.vendor}
          onChange={v => setForm({ ...form, vendor: v, device_type: (DEVICE_TYPE_OPTIONS[v] || [])[0] || '' })}
          options={[{ value: 'Fortinet', label: 'Fortinet' }, { value: 'Palo Alto', label: 'Palo Alto' }]} />
        <SelectField label={lang === 'zh' ? '設備種類' : 'Device Type'} value={form.device_type}
          onChange={v => setForm({ ...form, device_type: v })}
          options={[{ value: '', label: lang === 'zh' ? '未指定' : 'Unspecified' }, ...typeOpts]} />
        <InputField label={t(lang, 'model')}       value={form.model}    onChange={v => setForm({ ...form, model: v })}    placeholder="e.g. 60F" />
        <InputField label={t(lang, 'firmwareVer')} value={form.firmware} onChange={v => setForm({ ...form, firmware: v })} placeholder="e.g. 7.0.14" />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onCancel}>{t(lang, 'cancel')}</Btn>
        <Btn variant="primary" onClick={onSave} disabled={!form.name || !form.model || !form.firmware}>{t(lang, 'save')}</Btn>
      </div>
    </Card>
  );
}

const STATUS_MAP = {
  vulnerable:  { color: '#f04040', bg: 'rgba(240,64,64,0.12)',  labelZh: '存在弱點',    labelEn: 'Vulnerable' },
  upToDate:    { color: '#50b080', bg: 'rgba(80,176,128,0.12)', labelZh: '已是最新',    labelEn: 'Up to Date' },
  updateAvail: { color: '#f0a030', bg: 'rgba(240,160,48,0.12)', labelZh: '有更新可用',  labelEn: 'Update Available' },
};

function StatusBadge({ status, lang }) {
  const m = STATUS_MAP[status] || STATUS_MAP.upToDate;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: m.color, background: m.bg }}>
      ● {lang === 'zh' ? m.labelZh : m.labelEn}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function DevicesPage({ onNavigate }) {
  const { lang } = useLang();
  const { can } = useAuth();
  const canModify = can('devices', 'modify');

  const [devices,     setDevices]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showAdd,     setShowAdd]     = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [scanning,    setScanning]    = useState(null);
  const [scanningAll, setScanningAll] = useState(false);
  const [form, setForm] = useState({ name: '', vendor: 'Fortinet', device_type: 'FortiGate', model: '', firmware: '' });

  // Vuln expansion state
  const [expandedId,       setExpandedId]       = useState(null);
  const [deviceVulns,      setDeviceVulns]      = useState({});    // { deviceId: vulnArray }
  const [vulnsLoading,     setVulnsLoading]     = useState(false);
  const [deviceSelected,   setDeviceSelected]   = useState(null);  // selected vuln in expansion

  useEffect(() => {
    deviceApi.list().then(res => setDevices(res.data)).finally(() => setLoading(false));
  }, []);

  // ---- Device CRUD ----

  const handleAdd = async () => {
    const res = await deviceApi.create({ ...form, name_en: form.name });
    setDevices(prev => [...prev, res.data]);
    setShowAdd(false); setForm({ name: '', vendor: 'Fortinet', device_type: 'FortiGate', model: '', firmware: '' });
  };

  const handleEdit = (dev) => {
    setEditId(dev.id);
    setForm({ name: lang === 'zh' ? dev.name : (dev.name_en || dev.name), vendor: dev.vendor, device_type: dev.device_type || '', model: dev.model, firmware: dev.firmware });
  };

  const handleSaveEdit = async () => {
    const res = await deviceApi.update(editId, { ...form, name_en: form.name });
    setDevices(prev => prev.map(d => d.id === editId ? res.data : d));
    setEditId(null); setForm({ name: '', vendor: 'Fortinet', device_type: 'FortiGate', model: '', firmware: '' });
  };

  const handleDelete = async (id) => {
    await deviceApi.remove(id);
    setDevices(prev => prev.filter(d => d.id !== id));
  };

  const handleScanAll = async () => {
    setScanningAll(true);
    try {
      const res = await deviceApi.scanAll();
      setDevices(res.data.devices);
      setDeviceVulns({});  // invalidate cached vuln lists after rescan
    } finally {
      setScanningAll(false);
    }
  };

  const handleScan = async (id) => {
    setScanning(id);
    try {
      const res = await deviceApi.scan(id);
      setDevices(prev => prev.map(d => d.id === id ? res.data : d));
      setDeviceVulns(prev => { const n = { ...prev }; delete n[id]; return n; }); // invalidate cache
    } finally {
      setScanning(null);
    }
  };

  // ---- Vuln expansion ----

  const handleExpandVulns = async (device) => {
    if (expandedId === device.id) { setExpandedId(null); return; }
    setExpandedId(device.id);
    if (deviceVulns[device.id]) return; // already cached

    setVulnsLoading(true);
    try {
      const res = await deviceVulnApi.list(device.id);
      setDeviceVulns(prev => ({ ...prev, [device.id]: res.data }));
    } finally {
      setVulnsLoading(false);
    }
  };

  const handleVulnUpdate = (deviceId, vulnId, updates) => {
    setDeviceVulns(prev => ({
      ...prev,
      [deviceId]: (prev[deviceId] || []).map(v => v.id === vulnId ? { ...v, ...updates } : v),
    }));
    if (deviceSelected?.vuln.id === vulnId) {
      setDeviceSelected(prev => ({ ...prev, vuln: { ...prev.vuln, ...updates } }));
    }
    // Update device vuln_count when fixed status toggles
    if (updates.handle_status) {
      const oldStatus = (deviceVulns[deviceId] || []).find(v => v.id === vulnId)?.handle_status;
      const wasFixed = oldStatus === 'fixed';
      const isFixed  = updates.handle_status === 'fixed';
      if (wasFixed !== isFixed) {
        setDevices(prev => prev.map(d =>
          d.id === deviceId ? { ...d, vuln_count: Math.max(0, d.vuln_count + (isFixed ? -1 : 1)) } : d
        ));
      }
    }
  };

  const handleVulnDelete = (deviceId, vulnId) => {
    const wasFixed = (deviceVulns[deviceId] || []).find(v => v.id === vulnId)?.handle_status === 'fixed';
    setDeviceVulns(prev => ({
      ...prev,
      [deviceId]: (prev[deviceId] || []).filter(v => v.id !== vulnId),
    }));
    setDeviceSelected(null);
    if (!wasFixed) {
      setDevices(prev => prev.map(d =>
        d.id === deviceId ? { ...d, vuln_count: Math.max(0, d.vuln_count - 1) } : d
      ));
    }
  };

  if (loading) return (
    <div style={{ padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${TOKENS.border}`, borderTop: `3px solid ${TOKENS.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  const COLS = '1fr 90px 120px 130px 90px 100px 70px 90px 130px';

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: TOKENS.text }}>{t(lang, 'deviceList')} <span style={{ fontSize: 13, fontWeight: 400, color: TOKENS.textMuted }}>({devices.length})</span></div>
        {canModify && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn icon={Icons.refresh} onClick={handleScanAll} disabled={scanningAll}>
              {scanningAll ? (lang === 'zh' ? '掃描中...' : 'Scanning...') : (lang === 'zh' ? '重新比對所有設備' : 'Re-scan All')}
            </Btn>
            <Btn variant="primary" icon={Icons.plus} onClick={() => { setShowAdd(true); setEditId(null); setForm({ name: '', vendor: 'Fortinet', device_type: 'FortiGate', model: '', firmware: '' }); }}>
              {t(lang, 'addDevice')}
            </Btn>
          </div>
        )}
      </div>

      {showAdd && <DeviceForm form={form} setForm={setForm} lang={lang} onSave={handleAdd}      onCancel={() => setShowAdd(false)} />}
      {editId  && <DeviceForm form={form} setForm={setForm} lang={lang} onSave={handleSaveEdit} onCancel={() => setEditId(null)}  />}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[{ label: lang === 'zh' ? '存在弱點' : 'Vulnerable',       count: devices.filter(d => d.status === 'vulnerable').length,  color: TOKENS.danger },
          { label: lang === 'zh' ? '有更新可用' : 'Update Available', count: devices.filter(d => d.status === 'updateAvail').length, color: TOKENS.warning },
          { label: lang === 'zh' ? '已是最新' : 'Up to Date',        count: devices.filter(d => d.status === 'upToDate').length,    color: TOKENS.low },
        ].map((s, i) => (
          <Card key={i} style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{s.label}</span>
              <span style={{ fontSize: 24, fontWeight: 700, fontFamily: TOKENS.mono, color: s.color }}>{s.count}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Device table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '10px 16px', borderBottom: `1px solid ${TOKENS.border}`, background: 'rgba(255,255,255,0.02)' }}>
          {[t(lang, 'deviceName'), t(lang, 'vendor'), lang === 'zh' ? '設備種類' : 'Type', t(lang, 'model'), t(lang, 'firmwareVer'), t(lang, 'status'), lang === 'zh' ? '弱點數' : 'Vulns', t(lang, 'lastCheck'), t(lang, 'actions')].map(h => (
            <span key={h} style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{h}</span>
          ))}
        </div>

        {/* Rows with optional expansion */}
        {devices.map(d => {
          const isExpanded = expandedId === d.id;
          const vulns = deviceVulns[d.id] || [];
          const accentColor = d.vuln_count > 0 ? TOKENS.danger : TOKENS.low;

          return (
            <Fragment key={d.id}>
              {/* Device row */}
              <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '12px 16px', borderBottom: isExpanded ? 'none' : `1px solid ${TOKENS.border}`, alignItems: 'center', background: isExpanded ? `${accentColor}06` : 'transparent' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: TOKENS.text }}>{lang === 'zh' ? d.name : (d.name_en || d.name)}</span>
                <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{d.vendor}</span>
                <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{d.device_type || '—'}</span>
                <span style={{ fontSize: 12, color: TOKENS.text, fontFamily: TOKENS.mono }}>{d.model}</span>
                <span style={{ fontSize: 12, color: TOKENS.primary, fontFamily: TOKENS.mono }}>{d.firmware}</span>
                <StatusBadge status={d.status} lang={lang} />

                {/* Clickable vuln count */}
                <span
                  onClick={() => handleExpandVulns(d)}
                  title={lang === 'zh' ? '點選查看弱點清單' : 'Click to view vulnerability list'}
                  style={{ fontSize: 13, fontFamily: TOKENS.mono, fontWeight: 600, color: d.vuln_count > 0 ? TOKENS.danger : TOKENS.low, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, userSelect: 'none' }}>
                  {d.vuln_count}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.6 }}>
                    <path d="M2 3.5l3 3 3-3" />
                  </svg>
                </span>

                <span style={{ fontSize: 12, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>{d.last_check}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {canModify && (
                    <button onClick={() => handleScan(d.id)} disabled={scanning === d.id}
                      style={{ background: 'none', border: 'none', color: TOKENS.primary, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}
                      title={t(lang, 'check')}>
                      {scanning === d.id ? <span style={{ fontSize: 11 }}>{t(lang, 'scanning')}</span> : Icons.refresh}
                    </button>
                  )}
                  {canModify && (
                    <button onClick={() => handleEdit(d)} style={{ background: 'none', border: 'none', color: TOKENS.textSecondary, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }} title={t(lang, 'edit')}>{Icons.edit}</button>
                  )}
                  {canModify && (
                    <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: 'none', color: TOKENS.danger, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }} title={t(lang, 'delete')}>{Icons.trash}</button>
                  )}
                  {!canModify && <span style={{ fontSize: 11, color: TOKENS.textMuted }}>—</span>}
                </div>
              </div>

              {/* Vuln expansion panel */}
              {isExpanded && (
                <div style={{ borderBottom: `1px solid ${TOKENS.border}`, borderTop: `1px solid ${accentColor}30`, background: `${accentColor}05`, animation: 'expandDown 0.18s ease' }}>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 90px 80px 90px', gap: 10, padding: '7px 16px', borderBottom: `1px solid ${TOKENS.border}` }}>
                    {['CVE ID', lang === 'zh' ? '標題' : 'Title', lang === 'zh' ? '嚴重性' : 'Severity', 'CVSS', lang === 'zh' ? '狀態' : 'Status'].map(h => (
                      <span key={h} style={{ fontSize: 11, fontWeight: 600, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
                    ))}
                  </div>

                  {/* Vuln rows — sorted by published date desc, scrollable, shows ~5 rows */}
                  {vulnsLoading && expandedId === d.id ? (
                    <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 8, color: TOKENS.textMuted, fontSize: 13 }}>
                      <div style={{ width: 16, height: 16, border: `2px solid ${TOKENS.border}`, borderTop: `2px solid ${TOKENS.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      {lang === 'zh' ? '載入中...' : 'Loading...'}
                    </div>
                  ) : vulns.length === 0 ? (
                    <div style={{ padding: '16px', fontSize: 13, color: d.vuln_count > 0 ? TOKENS.warning : TOKENS.textMuted }}>
                      {d.vuln_count > 0
                        ? (lang === 'zh' ? '⚠ 弱點資料需更新，請點選「重新比對」進行掃描' : '⚠ Vulnerability data outdated — click Re-scan to refresh')
                        : (lang === 'zh' ? '此設備無匹配弱點' : 'No matching vulnerabilities for this device')}
                    </div>
                  ) : (
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {[...vulns]
                        .sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0))
                        .map((v, i, arr) => (
                          <div key={v.id} onClick={() => setDeviceSelected({ vuln: v, device: d })}
                            style={{ display: 'grid', gridTemplateColumns: '130px 1fr 90px 80px 90px', gap: 10, padding: '9px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${TOKENS.border}` : 'none', cursor: 'pointer', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <span style={{ fontFamily: TOKENS.mono, fontSize: 12, fontWeight: 700, color: TOKENS.primary }}>{v.id}</span>
                            <span style={{ fontSize: 12, color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lang === 'zh' ? v.title : v.title_en}</span>
                            <Badge severity={v.severity} />
                            <CvssBar score={Number(v.cvss)} />
                            <VulnStatusBadge status={v.handle_status} />
                          </div>
                        ))
                      }
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ padding: '10px 16px', borderTop: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: TOKENS.textMuted }}>
                      {lang === 'zh' ? `共 ${vulns.length} 筆匹配弱點，依發現時間排序` : `${vulns.length} vulnerabilities · newest first`}
                    </span>
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('search', { vendor: d.vendor })}
                        style={{ padding: '5px 12px', background: `${accentColor}18`, border: `1px solid ${accentColor}40`, borderRadius: TOKENS.radiusSm, color: accentColor, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: TOKENS.font }}>
                        {lang === 'zh' ? '前往弱點搜尋 →' : 'Go to Search →'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </Card>

      {/* Vuln detail modal */}
      {deviceSelected && (
        <VulnDetailModal
          key={deviceSelected.vuln.id}
          vuln={deviceSelected.vuln}
          device={deviceSelected.device}
          lang={lang}
          onClose={() => setDeviceSelected(null)}
          onUpdate={(id, updates) => handleVulnUpdate(deviceSelected.device.id, id, updates)}
          onDelete={(id) => handleVulnDelete(deviceSelected.device.id, id)}
        />
      )}
    </div>
  );
}
