import { useState, useEffect } from 'react';
import { TOKENS, VULN_STATUS, t } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import { vulnApi } from '../services/api';
import { Card, Badge, CvssBar, VulnStatusBadge, Btn, InputField, SelectField } from '../components/ui';
import { Icons } from '../components/Icons';
import { VulnDetailModal } from '../components/VulnDetailModal';

export function SearchPage({ preset, onPresetConsumed }) {
  const { lang } = useLang();
  const { can } = useAuth();
  const [vendor,       setVendor]       = useState('all');
  const [deviceType,   setDeviceType]   = useState('all');
  const [product,      setProduct]      = useState('');
  const [firmware,     setFirmware]     = useState('');
  const [severity,     setSeverity]     = useState('all');
  const [handleFilter, setHandleFilter] = useState('all');

  const DEVICE_TYPE_OPTIONS = {
    'Fortinet':  ['FortiGate', 'FortiWiFi', 'FortiAnalyzer', 'FortiManager', 'FortiProxy', 'FortiADC', 'FortiMail', 'FortiWeb'],
    'Palo Alto': ['PA-Series', 'Panorama'],
  };
  const deviceTypeOpts = vendor !== 'all'
    ? [{ value: 'all', label: t(lang, 'all') }, ...(DEVICE_TYPE_OPTIONS[vendor] || []).map(v => ({ value: v, label: v }))]
    : [{ value: 'all', label: t(lang, 'all') }, ...Object.values(DEVICE_TYPE_OPTIONS).flat().map(v => ({ value: v, label: v }))];
  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [dateFrom,  setDateFrom]  = useState(ninetyDaysAgo);
  const [dateTo,    setDateTo]    = useState(today);
  const [keyword,   setKeyword]   = useState('');
  const [results,   setResults]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [sortBy,    setSortBy]    = useState('cvss');
  const [sortDir,   setSortDir]   = useState('desc');
  const [presetToast, setPresetToast] = useState(null);

  const doSearch = async (overrides = {}) => {
    setLoading(true);
    try {
      const params = {};
      const v  = overrides.vendor       ?? (vendor       !== 'all' ? vendor       : undefined);
      const s  = overrides.severity     ?? (severity     !== 'all' ? severity     : undefined);
      const h  = overrides.handleStatus ?? (handleFilter !== 'all' ? handleFilter : undefined);
      const dt = overrides.deviceType   ?? (deviceType   !== 'all' ? deviceType   : undefined);
      if (v)  params.vendor        = v;
      if (s)  params.severity      = s;
      if (h)  params.handle_status = h;
      if (dt) params.device_type   = dt;
      if (product)  params.product   = product;
      if (firmware) params.firmware  = firmware;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      if (keyword)  params.keyword   = keyword;
      const res = await vulnApi.list(params);
      setResults(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { doSearch(); }, []);

  useEffect(() => {
    if (!preset || Object.keys(preset).length === 0) return;
    if (preset.severity)     setSeverity(preset.severity);
    if (preset.handleStatus) setHandleFilter(preset.handleStatus);
    if (preset.vendor)       setVendor(preset.vendor);
    const parts = [];
    if (preset.severity)     parts.push(preset.severity);
    if (preset.handleStatus) { const s = VULN_STATUS[preset.handleStatus]; parts.push(lang === 'zh' ? s?.label : s?.labelEn); }
    if (preset.vendor)       parts.push(preset.vendor);
    setPresetToast(parts.join(' · '));
    setTimeout(() => setPresetToast(null), 3000);
    if (onPresetConsumed) onPresetConsumed();
    doSearch({ vendor: preset.vendor, severity: preset.severity, handleStatus: preset.handleStatus });
  }, [preset]);

  const doReset = () => {
    setVendor('all'); setDeviceType('all'); setProduct(''); setFirmware(''); setSeverity('all');
    setHandleFilter('all');
    setDateFrom(new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
    setDateTo(new Date().toISOString().slice(0, 10));
    setKeyword('');
    doSearch({});
  };

  const sorted = [...results].sort((a, b) => {
    const m = sortDir === 'desc' ? -1 : 1;
    if (sortBy === 'cvss')      return (Number(a.cvss) - Number(b.cvss)) * m;
    if (sortBy === 'published') return a.published.localeCompare(b.published) * m;
    return 0;
  });

  const updateLocal = (id, updates) => {
    setResults(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    if (selected?.id === id) setSelected(prev => ({ ...prev, ...updates }));
  };

  const exportCsv = () => {
    const header = 'CVE ID,Vendor,Product,CVSS,Severity,Status,Published,Title\n';
    const rows = sorted.map(v => {
      const s = VULN_STATUS[v.handle_status];
      return `${v.id},${v.vendor},${v.product},${v.cvss},${v.severity},${lang === 'zh' ? s?.label : s?.labelEn},${v.published},"${lang === 'zh' ? v.title : v.title_en}"`;
    }).join('\n');
    const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vuln-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const SortBtn = ({ field, label }) => (
    <button onClick={() => { if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortBy(field); setSortDir('desc'); } }}
      style={{ background: 'none', border: 'none', color: sortBy === field ? TOKENS.primary : TOKENS.textSecondary, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: TOKENS.font, display: 'flex', alignItems: 'center', gap: 2 }}>
      {label}{sortBy === field && <span style={{ fontSize: 10 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>}
    </button>
  );

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Preset Toast */}
      {presetToast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: TOKENS.primary, color: '#0a0e1a', padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,212,170,0.3)', animation: 'fadeIn 0.2s ease', display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icons.filter}{lang === 'zh' ? `已套用篩選：${presetToast}` : `Filter applied: ${presetToast}`}
        </div>
      )}

      {/* Search Filters */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {Icons.filter}<span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>{t(lang, 'searchTitle')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
          <SelectField label={t(lang, 'vendor')} value={vendor}
            onChange={v => { setVendor(v); setDeviceType('all'); }}
            options={[{ value: 'all', label: t(lang, 'all') }, { value: 'Fortinet', label: 'Fortinet' }, { value: 'Palo Alto', label: 'Palo Alto Networks' }]} />
          <SelectField label={lang === 'zh' ? '設備種類' : 'Device Type'} value={deviceType} onChange={setDeviceType} options={deviceTypeOpts} />
          <SelectField label={t(lang, 'severity')} value={severity} onChange={setSeverity} options={[
            { value: 'all', label: t(lang, 'all') }, { value: 'CRITICAL', label: 'Critical' }, { value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }
          ]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
          <InputField label={t(lang, 'product')}  value={product}  onChange={setProduct}  placeholder="e.g. FortiGate 60F" />
          <InputField label={t(lang, 'firmware')} value={firmware} onChange={setFirmware} placeholder="e.g. 7.0.14" />
          <SelectField label={lang === 'zh' ? '處理狀態' : 'Status'} value={handleFilter} onChange={setHandleFilter} options={[
            { value: 'all', label: t(lang, 'all') },
            ...Object.entries(VULN_STATUS).map(([k, v]) => ({ value: k, label: lang === 'zh' ? v.label : v.labelEn }))
          ]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 12, alignItems: 'end' }}>
          <InputField label={t(lang, 'from')} value={dateFrom} onChange={setDateFrom} type="date" />
          <InputField label={t(lang, 'to')}   value={dateTo}   onChange={setDateTo}   type="date" />
          <InputField label="" value={keyword} onChange={setKeyword} placeholder={t(lang, 'searchPlaceholder')} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="primary" icon={Icons.search} onClick={() => doSearch()}>{t(lang, 'searchBtn')}</Btn>
            <Btn onClick={doReset}>{t(lang, 'resetBtn')}</Btn>
          </div>
        </div>
      </Card>

      {/* Results Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: TOKENS.textSecondary }}>{t(lang, 'results')}: <span style={{ fontWeight: 700, color: TOKENS.text, fontFamily: TOKENS.mono }}>{sorted.length}</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(VULN_STATUS).map(([k, v]) => {
              const cnt = sorted.filter(vl => vl.handle_status === k).length;
              if (cnt === 0) return null;
              return <span key={k} style={{ fontSize: 11, color: v.color, background: v.bg, padding: '2px 8px', borderRadius: 10 }}>{lang === 'zh' ? v.label : v.labelEn}: {cnt}</span>;
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn icon={Icons.export} onClick={exportCsv}>{t(lang, 'exportCsv')}</Btn>
          <Btn icon={Icons.export} onClick={() => window.print()}>{t(lang, 'exportPdf')}</Btn>
        </div>
      </div>

      {/* Results Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 100px 90px 80px 90px 90px', padding: '10px 16px', borderBottom: `1px solid ${TOKENS.border}`, background: 'rgba(255,255,255,0.02)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'cveId')}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'description')}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'vendor')}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'severity')}</span>
          <SortBtn field="cvss"      label={t(lang, 'cvss')} />
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{lang === 'zh' ? '處理狀態' : 'Status'}</span>
          <SortBtn field="published" label={t(lang, 'published')} />
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${TOKENS.border}`, borderTop: `2px solid ${TOKENS.primary}`, borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: TOKENS.textMuted }}>{t(lang, 'noResults')}</div>
        ) : sorted.map(v => (
          <div key={v.id} onClick={() => setSelected(v)}
            style={{ display: 'grid', gridTemplateColumns: '130px 1fr 100px 90px 80px 90px 90px', padding: '12px 16px', borderBottom: `1px solid ${TOKENS.border}`, cursor: 'pointer', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 13, fontWeight: 600, color: TOKENS.primary }}>{v.id}</span>
            <span style={{ fontSize: 13, color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lang === 'zh' ? v.title : v.title_en}</span>
            <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{v.vendor}</span>
            <Badge severity={v.severity} />
            <CvssBar score={Number(v.cvss)} />
            <VulnStatusBadge status={v.handle_status} />
            <span style={{ fontSize: 12, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>{v.published}</span>
          </div>
        ))}
      </Card>

      {selected && (
        <VulnDetailModal
          key={selected.id}
          vuln={selected}
          lang={lang}
          onClose={() => setSelected(null)}
          onUpdate={updateLocal}
          onDelete={(id) => { setResults(prev => prev.filter(v => v.id !== id)); setSelected(null); }}
        />
      )}
    </div>
  );
}
