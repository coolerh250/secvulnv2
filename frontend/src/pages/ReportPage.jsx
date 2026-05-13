import { useState, useEffect, useCallback } from 'react';
import { TOKENS, SEVERITY_MAP, VULN_STATUS } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { deviceApi, reportApi } from '../services/api';

const formatTs = ts => {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d) ? String(ts).slice(0, 16) : d.toLocaleString('zh-TW', { hour12: false }).slice(0, 16);
};

const FORMATS = [
  { id: 1, label: '設備修補狀態', labelEn: 'Device Patch Status' },
  { id: 2, label: '管理層總覽',   labelEn: 'Executive Summary' },
  { id: 3, label: '優先處理清單', labelEn: 'Priority Action List' },
];

const FREQ_OPTS = [
  { value: 'manual', label: '手動',       labelEn: 'Manual' },
  { value: '24h',    label: '每日',        labelEn: 'Daily' },
  { value: '168h',   label: '每週',        labelEn: 'Weekly' },
];

const PERIOD_OPTS = [
  { value: '30',    label: '近 30 天',  labelEn: 'Last 30 days' },
  { value: '90',    label: '近 90 天',  labelEn: 'Last 90 days' },
  { value: 'custom', label: '自訂區間', labelEn: 'Custom range' },
];

const STATUS_COLOR = { pending: TOKENS.warning, fixed: TOKENS.low, accepted: '#b080e0', deferred: TOKENS.info };

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }

function DonutPreview({ statusCounts }) {
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return (
    <svg width={80} height={80} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="28" fill="none" stroke={TOKENS.border} strokeWidth="10" />
      <text x="40" y="44" textAnchor="middle" fontSize="11" fill={TOKENS.textSecondary}>0</text>
    </svg>
  );

  const segs = [
    { key: 'pending', v: statusCounts.pending || 0 },
    { key: 'fixed', v: statusCounts.fixed || 0 },
    { key: 'accepted', v: statusCounts.accepted || 0 },
    { key: 'deferred', v: statusCounts.deferred || 0 },
  ].filter(s => s.v > 0);

  const cx = 40, cy = 40, r = 28, sw = 10;
  const { paths } = segs.reduce(({ paths, startAngle }, seg) => {
    const angle = (seg.v / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    return {
      paths: [...paths, <path key={seg.key} d={d} fill="none" stroke={STATUS_COLOR[seg.key]} strokeWidth={sw} strokeLinecap="round" />],
      startAngle: endAngle,
    };
  }, { paths: [], startAngle: -Math.PI / 2 });

  return (
    <svg width={80} height={80} viewBox="0 0 80 80">
      {paths}
      <text x="40" y="37" textAnchor="middle" fontSize="14" fontWeight="bold" fill={TOKENS.text} fontFamily={TOKENS.mono}>{total}</text>
      <text x="40" y="47" textAnchor="middle" fontSize="8" fill={TOKENS.textSecondary}>TOTAL</text>
    </svg>
  );
}

function ReportPreview({ data, format, lang }) {
  if (!data?.length) return (
    <div style={{ color: TOKENS.textSecondary, textAlign: 'center', padding: 60 }}>
      {lang === 'zh' ? '請選擇設備與期間，然後點「預覽」' : 'Select devices and period, then click Preview'}
    </div>
  );

  if (format === 2) return <Format2Preview data={data} lang={lang} />;
  if (format === 3) return <Format3Preview data={data} lang={lang} />;
  return <Format1Preview data={data} lang={lang} />;
}

function SevBadge({ severity }) {
  const m = SEVERITY_MAP[severity] || {};
  return (
    <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, background: m.bg, color: m.color }}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const m = VULN_STATUS[status] || {};
  return (
    <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: m.bg, color: m.color }}>
      {m.label || status}
    </span>
  );
}

function Format1Preview({ data, lang }) {
  const isZh = lang === 'zh';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {data.map(d => {
        const pct = d.vulns.length > 0 ? Math.round((d.statusCounts.fixed / d.vulns.length) * 100) : 0;
        return (
          <div key={d.id} style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TOKENS.text, marginBottom: 6 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: TOKENS.textSecondary, display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 16px' }}>
                  <span>{isZh ? '廠商' : 'Vendor'}:</span><span style={{ color: TOKENS.text }}>{d.vendor}</span>
                  <span>{isZh ? '型號' : 'Model'}:</span><span style={{ color: TOKENS.text }}>{d.model || '—'}</span>
                  <span>{isZh ? '韌體' : 'FW'}:</span><span style={{ color: TOKENS.text }}>{d.firmware || '—'}</span>
                  <span>{isZh ? '修補率' : 'Patch Rate'}:</span>
                  <span style={{ color: pct >= 80 ? TOKENS.low : pct >= 50 ? TOKENS.warning : TOKENS.danger, fontWeight: 700 }}>{pct}%</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <DonutPreview statusCounts={d.statusCounts} />
                <div style={{ fontSize: 10, color: TOKENS.textSecondary, lineHeight: 2.2 }}>
                  {Object.entries(d.statusCounts).filter(([, v]) => v > 0).map(([k, v]) => (
                    <div key={k}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: STATUS_COLOR[k], marginRight: 4 }} />{VULN_STATUS[k]?.label} <strong style={{ color: TOKENS.text }}>{v}</strong></div>
                  ))}
                </div>
              </div>
            </div>

            {d.vulns.length === 0
              ? <div style={{ color: TOKENS.textSecondary, fontSize: 12, fontStyle: 'italic' }}>{isZh ? '此期間無相關弱點' : 'No vulnerabilities in this period'}</div>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                        {['CVE ID', isZh ? '嚴重度' : 'Severity', 'CVSS', isZh ? '發布日期' : 'Published', isZh ? '狀態' : 'Status', isZh ? '標題' : 'Title'].map(h => (
                          <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: TOKENS.textSecondary, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.vulns.map(v => (
                        <tr key={v.id} style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                          <td style={{ padding: '5px 8px', fontFamily: TOKENS.mono, fontSize: 11, color: TOKENS.primary, whiteSpace: 'nowrap' }}>{v.id}</td>
                          <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}><SevBadge severity={v.severity} /></td>
                          <td style={{ padding: '5px 8px', textAlign: 'center' }}>{v.cvss || '—'}</td>
                          <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', color: TOKENS.textSecondary }}>{String(v.published || '').slice(0, 10)}</td>
                          <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}><StatusBadge status={v.handle_status} /></td>
                          <td style={{ padding: '5px 8px', color: TOKENS.textSecondary, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isZh ? (v.title || v.title_en) : (v.title_en || v.title)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        );
      })}
    </div>
  );
}

function Format2Preview({ data, lang }) {
  const isZh = lang === 'zh';
  const totalVulns = data.reduce((a, d) => a + d.vulns.length, 0);
  const totalFixed = data.reduce((a, d) => a + d.statusCounts.fixed, 0);
  const overallRate = totalVulns > 0 ? Math.round((totalFixed / totalVulns) * 100) : 0;
  const critCount = data.reduce((a, d) => a + d.vulns.filter(v => v.severity === 'CRITICAL').length, 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { l: isZh ? '涵蓋設備' : 'Devices', v: data.length, c: TOKENS.primary },
          { l: isZh ? '總弱點數' : 'Total Vulns', v: totalVulns, c: TOKENS.text },
          { l: isZh ? '嚴重弱點' : 'Critical', v: critCount, c: TOKENS.danger },
          { l: isZh ? '整體修補率' : 'Patch Rate', v: `${overallRate}%`, c: overallRate >= 80 ? TOKENS.low : TOKENS.warning },
        ].map(i => (
          <div key={i.l} style={{ textAlign: 'center', padding: '12px 20px', background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, minWidth: 100 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: i.c, fontFamily: TOKENS.mono }}>{i.v}</div>
            <div style={{ fontSize: 10, color: TOKENS.textSecondary, marginTop: 4 }}>{i.l}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
              {[isZh ? '設備名稱' : 'Device', isZh ? '廠商 / 種類' : 'Vendor / Type', isZh ? '型號 / 韌體' : 'Model / FW',
                isZh ? '弱點總數' : 'Total', 'CRIT', 'HIGH', isZh ? '待處理' : 'Pending', isZh ? '修補率' : 'Patch Rate'].map(h => (
                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: TOKENS.textSecondary, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(d => {
              const pct = d.vulns.length > 0 ? Math.round((d.statusCounts.fixed / d.vulns.length) * 100) : 0;
              const crit = d.vulns.filter(v => v.severity === 'CRITICAL').length;
              const high = d.vulns.filter(v => v.severity === 'HIGH').length;
              const rateColor = pct >= 80 ? TOKENS.low : pct >= 50 ? TOKENS.warning : TOKENS.danger;
              return (
                <tr key={d.id} style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                  <td style={{ padding: '6px 10px', fontWeight: 600, color: TOKENS.text }}>{d.name}</td>
                  <td style={{ padding: '6px 10px', color: TOKENS.textSecondary, fontSize: 11 }}>{d.vendor}<br />{d.device_type || '—'}</td>
                  <td style={{ padding: '6px 10px', color: TOKENS.textSecondary, fontSize: 11 }}>{d.model || '—'}<br />{d.firmware || '—'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: TOKENS.text }}>{d.vulns.length}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: TOKENS.danger, fontWeight: 700 }}>{crit || '—'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: TOKENS.warning, fontWeight: 700 }}>{high || '—'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>{d.statusCounts.pending}</td>
                  <td style={{ padding: '6px 10px', minWidth: 80 }}>
                    <div style={{ fontWeight: 700, color: rateColor, marginBottom: 3 }}>{pct}%</div>
                    <div style={{ height: 6, background: TOKENS.border, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: rateColor, borderRadius: 3 }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Format3Preview({ data, lang }) {
  const isZh = lang === 'zh';
  const vulnMap = {};
  for (const d of data) {
    for (const v of d.vulns) {
      if (!vulnMap[v.id]) vulnMap[v.id] = { ...v, affectedDevices: [] };
      vulnMap[v.id].affectedDevices.push({ name: d.name, status: v.handle_status });
    }
  }

  const sevOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const vulns = Object.values(vulnMap).sort((a, b) => {
    const sd = (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
    return sd !== 0 ? sd : (b.cvss || 0) - (a.cvss || 0);
  });

  const notFixed = vulns.filter(v => v.affectedDevices.some(d => d.status !== 'fixed'));

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 12, color: TOKENS.textSecondary }}>
        {isZh
          ? `共 ${vulns.length} 個弱點，其中 ${notFixed.length} 個尚未修復，依嚴重度與 CVSS 降序排列`
          : `${vulns.length} vulnerabilities total, ${notFixed.length} not yet fixed — sorted by severity and CVSS`}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
              {['CVE ID', isZh ? '嚴重度' : 'Severity', 'CVSS', isZh ? '影響設備' : 'Affected Devices', isZh ? '最差狀態' : 'Worst Status', isZh ? '標題' : 'Title'].map(h => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: TOKENS.textSecondary, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vulns.map(v => {
              const statuses = v.affectedDevices.map(d => d.status);
              const worst = statuses.includes('pending') ? 'pending'
                : statuses.includes('accepted') ? 'accepted'
                : statuses.includes('deferred') ? 'deferred' : 'fixed';
              return (
                <tr key={v.id} style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                  <td style={{ padding: '5px 8px', fontFamily: TOKENS.mono, color: TOKENS.primary, whiteSpace: 'nowrap' }}>{v.id}</td>
                  <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}><SevBadge severity={v.severity} /></td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>{v.cvss || '—'}</td>
                  <td style={{ padding: '5px 8px', fontSize: 10, color: TOKENS.textSecondary }}>{v.affectedDevices.map(d => d.name).join(', ')}</td>
                  <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}><StatusBadge status={worst} /></td>
                  <td style={{ padding: '5px 8px', color: TOKENS.textSecondary, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isZh ? (v.title || v.title_en) : (v.title_en || v.title)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportPage() {
  const { lang } = useLang();
  const isZh = lang === 'zh';

  const [devices, setDevices]             = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [periodType, setPeriodType]       = useState('30');
  const [fromDate, setFromDate]           = useState(daysAgo(30));
  const [toDate, setToDate]               = useState(today());
  const [format, setFormat]               = useState(1);
  const [previewData, setPreviewData]     = useState(null);
  const [previewMissing, setPreviewMissing] = useState(0);
  const [loading, setLoading]             = useState(false);
  const [pdfLoading, setPdfLoading]       = useState(false);
  const [emailLoading, setEmailLoading]   = useState(false);
  const [emailResult, setEmailResult]     = useState(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [schedules, setSchedules]         = useState([]);
  const [scheduleOpen, setScheduleOpen]   = useState(false);
  const [schedSaving, setSchedSaving]     = useState(false);

  useEffect(() => {
    deviceApi.list().then(r => setDevices(r.data.data || r.data || [])).catch(() => {});
    reportApi.getSchedule().then(r => setSchedules(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (periodType !== 'custom') {
      const days = parseInt(periodType);
      setFromDate(daysAgo(days));
      setToDate(today());
    }
  }, [periodType]);

  const toggleDevice = (id) => setSelectedDevices(prev =>
    prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
  );

  const resolvedFrom = periodType === 'custom' ? fromDate : daysAgo(parseInt(periodType));
  const resolvedTo   = periodType === 'custom' ? toDate : today();

  const handlePreview = useCallback(async () => {
    if (!selectedDevices.length) return;
    setLoading(true);
    const requestedCount = selectedDevices.length;
    try {
      const res = await reportApi.getData({ devices: selectedDevices.join(','), from: resolvedFrom, to: resolvedTo });
      setPreviewData(res.data);
      setPreviewMissing(requestedCount - res.data.length);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [selectedDevices, resolvedFrom, resolvedTo]);

  const handleDownloadPdf = async () => {
    if (!selectedDevices.length) return;
    setPdfLoading(true);
    try {
      const res = await reportApi.downloadPdf({ devices: selectedDevices.join(','), from: resolvedFrom, to: resolvedTo, format, lang });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SecVuln_Report_${resolvedFrom}_${resolvedTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ } finally {
      setPdfLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedDevices.length || !emailRecipient) return;
    setEmailLoading(true);
    setEmailResult(null);
    try {
      const res = await reportApi.sendEmail({ devices: selectedDevices, from: resolvedFrom, to: resolvedTo, format, lang, recipient: emailRecipient });
      setEmailResult(res.data.ok ? 'ok' : (res.data.error || 'fail'));
    } catch (err) {
      setEmailResult(err.response?.data?.error || 'fail');
    } finally {
      setEmailLoading(false);
    }
  };

  const addSchedule = () => {
    const id = Date.now().toString();
    setSchedules(prev => [...prev, {
      id, name: '', devices: selectedDevices, periodType: '30',
      freq: 'manual', format: 1, recipient: '', enabled: true, lastRun: null,
    }]);
  };

  const updateSchedule = (id, patch) => setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  const removeSchedule = (id) => setSchedules(prev => prev.filter(s => s.id !== id));

  const handleSaveSchedules = async () => {
    setSchedSaving(true);
    try {
      await reportApi.saveSchedule(schedules);
    } catch { /* ignore */ } finally {
      setSchedSaving(false);
    }
  };

  const inputStyle = { padding: '6px 10px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 12, fontFamily: TOKENS.font };
  const btnStyle = (color = TOKENS.primary, disabled = false) => ({
    padding: '8px 16px', background: disabled ? TOKENS.border : 'transparent', border: `1px solid ${disabled ? TOKENS.border : color}`,
    borderRadius: TOKENS.radiusSm, color: disabled ? TOKENS.textSecondary : color, fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: TOKENS.font, fontWeight: 600, opacity: disabled ? 0.6 : 1,
  });

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: TOKENS.text, marginBottom: 4 }}>{isZh ? '報表' : 'Reports'}</h1>
        <div style={{ fontSize: 12, color: TOKENS.textSecondary }}>{isZh ? '依設備與期間產出弱點修補狀態報告' : 'Generate vulnerability patch status reports by device and period'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Device selector */}
          <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isZh ? '選擇設備' : 'Devices'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button style={{ ...inputStyle, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}
                onClick={() => setSelectedDevices(devices.map(d => d.id))}>
                {isZh ? '全選' : 'All'}
              </button>
              <button style={{ ...inputStyle, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}
                onClick={() => setSelectedDevices([])}>
                {isZh ? '清除' : 'Clear'}
              </button>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {devices.map(d => (
                <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: TOKENS.radiusSm, cursor: 'pointer', fontSize: 12, color: selectedDevices.includes(d.id) ? TOKENS.text : TOKENS.textSecondary }}>
                  <input type="checkbox" checked={selectedDevices.includes(d.id)} onChange={() => toggleDevice(d.id)} style={{ accentColor: TOKENS.primary }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                </label>
              ))}
              {devices.length === 0 && <div style={{ fontSize: 11, color: TOKENS.textMuted }}>{isZh ? '無設備資料' : 'No devices'}</div>}
            </div>
          </div>

          {/* Period */}
          <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isZh ? '報告期間' : 'Period'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PERIOD_OPTS.map(o => (
                <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: periodType === o.value ? TOKENS.text : TOKENS.textSecondary }}>
                  <input type="radio" name="period" value={o.value} checked={periodType === o.value} onChange={() => setPeriodType(o.value)} style={{ accentColor: TOKENS.primary }} />
                  {isZh ? o.label : o.labelEn}
                </label>
              ))}
              {periodType === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputStyle} />
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inputStyle} />
                </div>
              )}
            </div>
          </div>

          {/* Format */}
          <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isZh ? '呈現方案' : 'Format'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FORMATS.map(f => (
                <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: format === f.id ? TOKENS.text : TOKENS.textSecondary }}>
                  <input type="radio" name="format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} style={{ accentColor: TOKENS.primary }} />
                  {f.id}. {isZh ? f.label : f.labelEn}
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button style={btnStyle(TOKENS.primary, !selectedDevices.length || loading)} onClick={handlePreview} disabled={!selectedDevices.length || loading}>
              {loading ? (isZh ? '載入中…' : 'Loading…') : (isZh ? '預覽報告' : 'Preview')}
            </button>
            <button style={btnStyle(TOKENS.info, !selectedDevices.length || pdfLoading)} onClick={handleDownloadPdf} disabled={!selectedDevices.length || pdfLoading}>
              {pdfLoading ? (isZh ? '產生 PDF…' : 'Generating…') : (isZh ? '下載 PDF' : 'Download PDF')}
            </button>
          </div>

          {/* Email */}
          <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isZh ? '寄送 Email' : 'Send Email'}
            </div>
            <input
              type="email" placeholder={isZh ? '收件地址' : 'Recipient email'}
              value={emailRecipient} onChange={e => setEmailRecipient(e.target.value)}
              style={{ ...inputStyle, width: '100%', marginBottom: 8 }}
            />
            <button style={btnStyle(TOKENS.warning, !selectedDevices.length || !emailRecipient || emailLoading)}
              onClick={handleSendEmail} disabled={!selectedDevices.length || !emailRecipient || emailLoading}>
              {emailLoading ? (isZh ? '寄送中…' : 'Sending…') : (isZh ? '寄送 PDF 報告' : 'Send PDF Report')}
            </button>
            {emailResult && (
              <div style={{ marginTop: 8, fontSize: 11, color: emailResult === 'ok' ? TOKENS.low : TOKENS.danger }}>
                {emailResult === 'ok' ? (isZh ? '已寄出' : 'Sent!') : emailResult}
              </div>
            )}
          </div>

          {/* Schedule toggle */}
          <button style={{ ...inputStyle, cursor: 'pointer', textAlign: 'center', fontWeight: 600, color: TOKENS.textSecondary }}
            onClick={() => setScheduleOpen(o => !o)}>
            {scheduleOpen ? '▲' : '▼'} {isZh ? '排程設定' : 'Schedule Settings'}
          </button>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Schedule panel */}
          {scheduleOpen && (
            <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>{isZh ? '自動排程' : 'Auto Schedule'}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btnStyle(TOKENS.primary)} onClick={addSchedule}>{isZh ? '+ 新增排程' : '+ Add'}</button>
                  <button style={btnStyle(TOKENS.low, schedSaving)} onClick={handleSaveSchedules} disabled={schedSaving}>
                    {schedSaving ? (isZh ? '儲存中…' : 'Saving…') : (isZh ? '儲存' : 'Save')}
                  </button>
                </div>
              </div>

              {schedules.length === 0
                ? <div style={{ color: TOKENS.textSecondary, fontSize: 12 }}>{isZh ? '尚無排程。點「+ 新增排程」建立。' : 'No schedules. Click "+ Add" to create one.'}</div>
                : schedules.map(s => (
                  <div key={s.id} style={{ border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input placeholder={isZh ? '排程名稱' : 'Schedule name'} value={s.name}
                        onChange={e => updateSchedule(s.id, { name: e.target.value })}
                        style={{ ...inputStyle, flex: '1 1 120px' }} />
                      <select value={s.freq} onChange={e => updateSchedule(s.id, { freq: e.target.value })} style={{ ...inputStyle }}>
                        {FREQ_OPTS.map(o => <option key={o.value} value={o.value}>{isZh ? o.label : o.labelEn}</option>)}
                      </select>
                      <select value={s.periodType} onChange={e => updateSchedule(s.id, { periodType: e.target.value })} style={{ ...inputStyle }}>
                        {PERIOD_OPTS.filter(o => o.value !== 'custom').map(o => <option key={o.value} value={o.value}>{isZh ? o.label : o.labelEn}</option>)}
                      </select>
                      <select value={s.format} onChange={e => updateSchedule(s.id, { format: parseInt(e.target.value) })} style={{ ...inputStyle }}>
                        {FORMATS.map(f => <option key={f.id} value={f.id}>{isZh ? f.label : f.labelEn}</option>)}
                      </select>
                      <input type="email" placeholder={isZh ? '收件地址' : 'Recipient'} value={s.recipient}
                        onChange={e => updateSchedule(s.id, { recipient: e.target.value })}
                        style={{ ...inputStyle, flex: '1 1 160px' }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: TOKENS.textSecondary, cursor: 'pointer' }}>
                        <input type="checkbox" checked={s.enabled} onChange={e => updateSchedule(s.id, { enabled: e.target.checked })} style={{ accentColor: TOKENS.primary }} />
                        {isZh ? '啟用' : 'Enable'}
                      </label>
                      <button style={{ ...btnStyle(TOKENS.danger), padding: '6px 10px' }} onClick={() => removeSchedule(s.id)}>✕</button>
                    </div>
                    {s.lastRun && <div style={{ fontSize: 10, color: TOKENS.textMuted, marginTop: 6 }}>{isZh ? '上次執行' : 'Last run'}: {formatTs(s.lastRun)}</div>}
                  </div>
                ))
              }
            </div>
          )}

          {/* Preview area */}
          <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, padding: 20, minHeight: 300 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text, marginBottom: previewMissing > 0 ? 8 : 16 }}>
              {isZh ? '報告預覽' : 'Report Preview'}
              {previewData && <span style={{ fontSize: 11, color: TOKENS.textSecondary, fontWeight: 400, marginLeft: 10 }}>{resolvedFrom} ～ {resolvedTo}</span>}
            </div>
            {previewMissing > 0 && (
              <div style={{ fontSize: 11, color: TOKENS.warning, marginBottom: 14, padding: '6px 10px', background: TOKENS.warningDim, borderRadius: TOKENS.radiusSm }}>
                {isZh ? `${previewMissing} 台設備在此期間無相關弱點，已從報告中略過` : `${previewMissing} device(s) have no vulnerabilities in this period and were omitted`}
              </div>
            )}
            <ReportPreview data={previewData} format={format} lang={lang} />
          </div>
        </div>
      </div>
    </div>
  );
}
