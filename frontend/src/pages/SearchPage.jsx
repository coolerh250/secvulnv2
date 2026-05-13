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

  const today        = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [dateFrom,  setDateFrom]  = useState(ninetyDaysAgo);
  const [dateTo,    setDateTo]    = useState(today);
  const [keyword,   setKeyword]   = useState('');

  const [results,    setResults]    = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [limit,      setLimit]      = useState(50);
  const [sortBy,     setSortBy]     = useState('cvss');
  const [sortDir,    setSortDir]    = useState('desc');

  const [loading,      setLoading]      = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [presetToast,  setPresetToast]  = useState(null);

  // Build filter params from current state (or overrides)
  const buildParams = (overrides = {}) => {
    const _vendor  = 'vendor'       in overrides ? overrides.vendor       : vendor;
    const _sev     = 'severity'     in overrides ? overrides.severity     : severity;
    const _handle  = 'handleStatus' in overrides ? overrides.handleStatus : handleFilter;
    const _dt      = 'deviceType'   in overrides ? overrides.deviceType   : deviceType;
    const _product = 'product'      in overrides ? overrides.product      : product;
    const _fw      = 'firmware'     in overrides ? overrides.firmware     : firmware;
    const _from    = 'dateFrom'     in overrides ? overrides.dateFrom     : dateFrom;
    const _to      = 'dateTo'       in overrides ? overrides.dateTo       : dateTo;
    const _kw      = 'keyword'      in overrides ? overrides.keyword      : keyword;
    const _page    = 'page'         in overrides ? overrides.page         : page;
    const _limit   = 'limit'        in overrides ? overrides.limit        : limit;
    const _sortBy  = 'sortBy'       in overrides ? overrides.sortBy       : sortBy;
    const _sortDir = 'sortDir'      in overrides ? overrides.sortDir      : sortDir;

    const params = { page: _page, limit: _limit, sort_by: _sortBy, sort_dir: _sortDir };
    if (_vendor  && _vendor  !== 'all') params.vendor        = _vendor;
    if (_sev     && _sev     !== 'all') params.severity      = _sev;
    if (_handle  && _handle  !== 'all') params.handle_status = _handle;
    if (_dt      && _dt      !== 'all') params.device_type   = _dt;
    if (_product) params.product   = _product;
    if (_fw)      params.firmware  = _fw;
    if (_from)    params.date_from = _from;
    if (_to)      params.date_to   = _to;
    if (_kw)      params.keyword   = _kw;
    return params;
  };

  const doSearch = async (overrides = {}) => {
    setLoading(true);
    try {
      const params = buildParams(overrides);
      const res = await vulnApi.list(params);
      const body = res.data;
      setResults(body.data);
      setTotal(body.total);
      setTotalPages(body.pages);
      setPage(body.page);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { doSearch({ page: 1 }); }, []);

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
    doSearch({ vendor: preset.vendor, severity: preset.severity, handleStatus: preset.handleStatus, page: 1 });
  }, [preset]);

  const doReset = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const from90   = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    setVendor('all'); setDeviceType('all'); setProduct(''); setFirmware(''); setSeverity('all');
    setHandleFilter('all'); setDateFrom(from90); setDateTo(todayStr); setKeyword('');
    doSearch({ vendor: 'all', severity: 'all', handleStatus: 'all', deviceType: 'all',
               product: '', firmware: '', keyword: '', dateFrom: from90, dateTo: todayStr, page: 1 });
  };

  const updateLocal = (id, updates) => {
    setResults(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    if (selected?.id === id) setSelected(prev => ({ ...prev, ...updates }));
  };

  const handleDelete = (id) => {
    setResults(prev => prev.filter(v => v.id !== id));
    setSelected(null);
    setTotal(prev => prev - 1);
    // If we just deleted the last item on this page, go back one page
    const newTotal = total - 1;
    const newPages = Math.ceil(newTotal / limit) || 1;
    if (page > newPages) doSearch({ page: newPages });
    else doSearch({ page });
  };

  const exportCsv = async () => {
    try {
      const params = buildParams({ page: 1, limit: 9999 });
      const res = await vulnApi.list(params);
      const all = res.data.data;
      const header = 'CVE ID,Vendor,Product,CVSS,Severity,Status,Published,Title\n';
      const rows = all.map(v => {
        const s = VULN_STATUS[v.handle_status];
        return `${v.id},${v.vendor},${v.product},${v.cvss},${v.severity},${lang === 'zh' ? s?.label : s?.labelEn},${v.published},"${lang === 'zh' ? v.title : v.title_en}"`;
      }).join('\n');
      const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vuln-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch { /* silent */ }
  };

  const SortBtn = ({ field, label }) => (
    <button
      onClick={() => {
        const newDir = sortBy === field && sortDir === 'desc' ? 'asc' : 'desc';
        setSortBy(field); setSortDir(newDir);
        doSearch({ sortBy: field, sortDir: newDir, page: 1 });
      }}
      style={{ background: 'none', border: 'none', color: sortBy === field ? TOKENS.primary : TOKENS.textSecondary, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: TOKENS.font, display: 'flex', alignItems: 'center', gap: 2 }}>
      {label}{sortBy === field && <span style={{ fontSize: 10 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>}
    </button>
  );

  const epssColor = score => {
    if (score === null || score === undefined) return TOKENS.textMuted;
    if (score >= 0.5) return TOKENS.danger;
    if (score >= 0.1) return TOKENS.warning;
    return TOKENS.low;
  };
  const EpssCell = ({ score }) => (
    score !== null && score !== undefined
      ? <span style={{ fontSize: 12, fontFamily: TOKENS.mono, color: epssColor(score), fontWeight: 600 }}>{(score * 100).toFixed(1)}%</span>
      : <span style={{ fontSize: 12, color: TOKENS.textMuted }}>—</span>
  );

  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd   = Math.min(page * limit, total);

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
            <Btn variant="primary" icon={Icons.search} onClick={() => doSearch({ page: 1 })}>{t(lang, 'searchBtn')}</Btn>
            <Btn onClick={doReset}>{t(lang, 'resetBtn')}</Btn>
          </div>
        </div>
      </Card>

      {/* Results Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: TOKENS.textSecondary }}>
            {t(lang, 'results')}: <span style={{ fontWeight: 700, color: TOKENS.text, fontFamily: TOKENS.mono }}>{total}</span>
            {total > 0 && <span style={{ fontWeight: 400, color: TOKENS.textMuted }}> &nbsp;({pageStart}–{pageEnd})</span>}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(VULN_STATUS).map(([k, v]) => {
              const cnt = results.filter(vl => vl.handle_status === k).length;
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
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 100px 90px 80px 80px 90px 90px', padding: '10px 16px', borderBottom: `1px solid ${TOKENS.border}`, background: 'rgba(255,255,255,0.02)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'cveId')}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'description')}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'vendor')}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'severity')}</span>
          <SortBtn field="cvss"      label={t(lang, 'cvss')} />
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>EPSS</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{lang === 'zh' ? '處理狀態' : 'Status'}</span>
          <SortBtn field="published" label={t(lang, 'published')} />
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${TOKENS.border}`, borderTop: `2px solid ${TOKENS.primary}`, borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : results.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: TOKENS.textMuted }}>{t(lang, 'noResults')}</div>
        ) : results.map(v => (
          <div key={v.id} onClick={() => setSelected(v)}
            style={{ display: 'grid', gridTemplateColumns: '130px 1fr 100px 90px 80px 80px 90px 90px', padding: '12px 16px', borderBottom: `1px solid ${TOKENS.border}`, cursor: 'pointer', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: TOKENS.mono, fontSize: 13, fontWeight: 600, color: TOKENS.primary }}>{v.id}</span>
              {v.is_kev && <span style={{ fontSize: 10, fontWeight: 700, color: TOKENS.danger, background: TOKENS.dangerDim, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em', alignSelf: 'flex-start' }}>KEV</span>}
            </span>
            <span style={{ fontSize: 13, color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lang === 'zh' ? v.title : v.title_en}</span>
            <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{v.vendor}</span>
            <Badge severity={v.severity} />
            <CvssBar score={Number(v.cvss)} />
            <EpssCell score={v.epss_score} />
            <VulnStatusBadge status={v.handle_status} />
            <span style={{ fontSize: 12, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>{v.published}</span>
          </div>
        ))}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${TOKENS.border}`, background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => doSearch({ page: page - 1 })} disabled={page <= 1}
                style={{ padding: '5px 12px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: page <= 1 ? TOKENS.textMuted : TOKENS.text, cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: TOKENS.font }}>
                ← {lang === 'zh' ? '上一頁' : 'Prev'}
              </button>
              {/* Page number buttons — show up to 7 pages around current */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) => p === '…' ? (
                  <span key={`ellipsis-${idx}`} style={{ color: TOKENS.textMuted, fontSize: 13, padding: '0 4px' }}>…</span>
                ) : (
                  <button key={p} onClick={() => doSearch({ page: p })}
                    style={{ minWidth: 32, padding: '5px 8px', background: p === page ? TOKENS.primary : TOKENS.bgInput, border: `1px solid ${p === page ? TOKENS.primary : TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: p === page ? '#0a0e1a' : TOKENS.text, cursor: 'pointer', fontSize: 13, fontWeight: p === page ? 700 : 400, fontFamily: TOKENS.font }}>
                    {p}
                  </button>
                ))
              }
              <button onClick={() => doSearch({ page: page + 1 })} disabled={page >= totalPages}
                style={{ padding: '5px 12px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: page >= totalPages ? TOKENS.textMuted : TOKENS.text, cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: TOKENS.font }}>
                {lang === 'zh' ? '下一頁' : 'Next'} →
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: TOKENS.textMuted }}>
                {lang === 'zh' ? `第 ${page} / ${totalPages} 頁` : `Page ${page} of ${totalPages}`}
              </span>
              <select value={limit} onChange={e => { const l = Number(e.target.value); setLimit(l); doSearch({ limit: l, page: 1 }); }}
                style={{ padding: '4px 8px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 12, fontFamily: TOKENS.font, cursor: 'pointer' }}>
                {[25, 50, 100].map(n => <option key={n} value={n}>{lang === 'zh' ? `每頁 ${n}` : `${n} / page`}</option>)}
              </select>
            </div>
          </div>
        )}
      </Card>

      {selected && (
        <VulnDetailModal
          key={selected.id}
          vuln={selected}
          lang={lang}
          onClose={() => setSelected(null)}
          onUpdate={updateLocal}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
