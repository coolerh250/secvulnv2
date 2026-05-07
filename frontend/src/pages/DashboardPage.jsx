import { useState, useEffect } from 'react';
import { TOKENS, SEVERITY_MAP, VULN_STATUS, t } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { dashboardApi, vulnApi } from '../services/api';
import { Card, Badge, CvssBar, VulnStatusBadge, MiniBarChart, DonutChart } from '../components/ui';
import { Icons } from '../components/Icons';

const MONTH_NUM = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };

const RANGE_OPTS = [
  { key: '1m', zh: '1個月', en: '1M' },
  { key: '6m', zh: '半年',  en: '6M' },
  { key: '1y', zh: '1年',   en: '1Y' },
  { key: 'custom', zh: '自訂', en: 'Custom' },
];

function toYM(year, monthStr) { return year * 100 + (MONTH_NUM[monthStr] || 0); }

export function DashboardPage({ onNavigate }) {
  const { lang } = useLang();
  const [stats,    setStats]    = useState(null);
  const [trend,    setTrend]    = useState([]);
  const [reviews,  setReviews]  = useState([]);
  const [topVulns, setTopVulns] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [expandVulns, setExpandVulns] = useState([]);
  const [detailVuln, setDetailVuln]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [trendRange,  setTrendRange]  = useState('1y');
  const nowD = new Date();
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(nowD.getFullYear(), nowD.getMonth() - 5, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [customTo, setCustomTo] = useState(() =>
    `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}`
  );

  const loadData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    return Promise.all([
      dashboardApi.stats(),
      dashboardApi.trend(),
      dashboardApi.reviews(),
      vulnApi.list({ date_from: `${new Date().getFullYear()}-01-01`, date_to: `${new Date().getFullYear()}-12-31` }),
    ]).then(([s, tr, rv, vl]) => {
      setStats(s.data);
      setTrend(tr.data);
      setReviews(rv.data.map(v => ({
        ...v,
        daysLeft: Math.ceil((new Date(v.review_date) - new Date()) / 86400000),
      })));
      setTopVulns([...vl.data.data].sort((a, b) => b.cvss - a.cvss).slice(0, 5));
    }).finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { loadData(); }, []);

  const loadExpanded = async (filter) => {
    const params = {};
    if (filter.severity)     params.severity      = filter.severity;
    if (filter.handleStatus) params.handle_status = filter.handleStatus;
    const res = await vulnApi.list(params);
    setExpandVulns(res.data);
  };

  const handleCardClick = (id, filter) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    loadExpanded(filter);
  };

  const handleJumpSearch = (filter) => {
    if (onNavigate) onNavigate('search', filter);
  };

  if (loading) return (
    <div style={{ padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${TOKENS.border}`, borderTop: `3px solid ${TOKENS.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13, color: TOKENS.textSecondary }}>{lang === 'zh' ? '載入中...' : 'Loading...'}</span>
      </div>
    </div>
  );

  const getFilteredTrend = () => {
    if (!trend.length) return [];
    let from, to;
    if (trendRange === 'custom') {
      from = customFrom ? parseInt(customFrom.replace('-', '')) : 0;
      to   = customTo   ? parseInt(customTo.replace('-', ''))   : 999999;
    } else {
      const months = { '1m': 0, '6m': 5, '1y': 11 }[trendRange] ?? 11;
      const cutoff = new Date(nowD.getFullYear(), nowD.getMonth() - months, 1);
      from = cutoff.getFullYear() * 100 + (cutoff.getMonth() + 1);
      to   = nowD.getFullYear() * 100 + (nowD.getMonth() + 1);
    }
    const filtered = trend.filter(d => { const ym = toYM(d.year, d.month); return ym >= from && ym <= to; });
    const years = new Set(filtered.map(d => d.year));
    return filtered.map(d => ({ ...d, month: years.size > 1 ? `${d.month}'${String(d.year).slice(2)}` : d.month }));
  };
  const filteredTrend = getFilteredTrend();

  const severity  = stats?.severity  || {};
  const status    = stats?.status    || {};
  const critCount = severity.CRITICAL || 0;
  const highCount = severity.HIGH     || 0;
  const medCount  = severity.MEDIUM   || 0;
  const lowCount  = severity.LOW      || 0;

  const statCards = [
    { id: 'total',    label: t(lang, 'totalVulns'),   value: stats?.total || 0,          color: TOKENS.info,    sub: `${status.pending || 0} ${lang === 'zh' ? '待處理' : 'pending'}`,       filter: {} },
    { id: 'critical', label: t(lang, 'criticalVulns'),value: critCount,                  color: TOKENS.danger,  sub: lang === 'zh' ? '需立即處理' : 'Immediate action',                        filter: { severity: 'CRITICAL' } },
    { id: 'accepted', label: lang === 'zh' ? '風險接受' : 'Risk Accepted', value: status.accepted || 0, color: '#b080e0', sub: `${status.deferred || 0} ${lang === 'zh' ? '暫不處理' : 'deferred'}`, filter: { handleStatus: 'accepted' } },
    { id: 'fixed',    label: lang === 'zh' ? '已修復' : 'Fixed',           value: status.fixed || 0,    color: TOKENS.low, sub: `${lang === 'zh' ? '共' : 'of'} ${stats?.total || 0} ${lang === 'zh' ? '筆' : 'total'}`, filter: { handleStatus: 'fixed' } },
  ];

  const VulnRow = ({ v, isLast }) => {
    const [hovered, setHovered] = useState(false);
    return (
      <div onClick={e => { e.stopPropagation(); setDetailVuln(v); }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px 80px 90px', gap: 10, alignItems: 'center', padding: '9px 12px', borderBottom: isLast ? 'none' : `1px solid ${TOKENS.border}`, cursor: 'pointer', background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
        <span style={{ fontFamily: TOKENS.mono, fontSize: 12, fontWeight: 700, color: TOKENS.primary }}>{v.id}</span>
        <span style={{ fontSize: 12, color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lang === 'zh' ? v.title : v.title_en}</span>
        <Badge severity={v.severity} />
        <CvssBar score={Number(v.cvss)} />
        <VulnStatusBadge status={v.handle_status} />
      </div>
    );
  };

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => loadData(true)} disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'none', border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: refreshing ? TOKENS.textMuted : TOKENS.textSecondary, cursor: refreshing ? 'default' : 'pointer', fontSize: 12, fontFamily: TOKENS.font }}
          onMouseEnter={e => { if (!refreshing) e.currentTarget.style.borderColor = TOKENS.primary; e.currentTarget.style.color = TOKENS.primary; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = TOKENS.border; e.currentTarget.style.color = TOKENS.textSecondary; }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
            style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>
            <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.86 4.4 2.2M13.5 2v3.5H10"/>
          </svg>
          {refreshing ? (lang === 'zh' ? '更新中...' : 'Refreshing...') : (lang === 'zh' ? '重新整理' : 'Refresh')}
        </button>
      </div>
      {/* Stat Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {statCards.map(s => {
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div onClick={() => handleCardClick(s.id, s.filter)}
                  style={{ background: isOpen ? `${s.color}10` : TOKENS.bgCard, border: `1px solid ${isOpen ? s.color + '60' : TOKENS.border}`, borderRadius: isOpen ? `${TOKENS.radiusLg} ${TOKENS.radiusLg} 0 0` : TOKENS.radiusLg, borderBottom: isOpen ? 'none' : undefined, padding: 20, cursor: 'pointer', transition: 'all 0.18s' }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.borderColor = `${s.color}50`; }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.borderColor = TOKENS.border; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, color: TOKENS.textSecondary, marginBottom: 6 }}>{s.label}</div>
                    <span style={{ fontSize: 11, color: isOpen ? s.color : TOKENS.textMuted, display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: s.color, fontFamily: TOKENS.mono }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 4 }}>{s.sub}</div>
                </div>
                {isOpen && (
                  <div style={{ border: `1px solid ${s.color}40`, borderRadius: `0 0 ${TOKENS.radius} ${TOKENS.radius}`, overflow: 'hidden', background: TOKENS.bgCard, animation: 'expandDown 0.2s ease' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px 80px 90px', gap: 10, padding: '7px 12px', borderBottom: `1px solid ${TOKENS.border}` }}>
                      {['CVE ID', lang === 'zh' ? '標題' : 'Title', t(lang, 'severity'), t(lang, 'cvss'), lang === 'zh' ? '狀態' : 'Status'].map(h => (
                        <span key={h} style={{ fontSize: 11, fontWeight: 600, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
                      ))}
                    </div>
                    {expandVulns.slice(0, 5).map((v, i) => <VulnRow key={v.id} v={v} isLast={i === Math.min(expandVulns.length, 5) - 1} />)}
                    <div style={{ padding: '10px 12px', borderTop: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: TOKENS.textMuted }}>{lang === 'zh' ? `共 ${expandVulns.length} 筆` : `${expandVulns.length} total`}</span>
                      <button onClick={e => { e.stopPropagation(); handleJumpSearch(s.filter); }}
                        style={{ padding: '5px 12px', background: `${s.color}18`, border: `1px solid ${s.color}40`, borderRadius: TOKENS.radiusSm, color: s.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: TOKENS.font }}>
                        {lang === 'zh' ? '查看全部 →' : 'View all →'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Overview */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text, marginBottom: 16 }}>{lang === 'zh' ? '弱點處理狀態總覽' : 'Vulnerability Handling Overview'}</div>
        <div style={{ display: 'flex', gap: 0, height: 32, borderRadius: TOKENS.radiusSm, overflow: 'hidden', marginBottom: 12 }}>
          {Object.entries(VULN_STATUS).map(([k, v]) => {
            const cnt = status[k] || 0;
            const pct = stats?.total ? (cnt / stats.total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div key={k} onClick={() => handleJumpSearch({ handleStatus: k })}
                style={{ width: `${pct}%`, background: v.color, opacity: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.75'}>
                {pct > 10 ? cnt : ''}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {Object.entries(VULN_STATUS).map(([k, v]) => (
            <div key={k} onClick={() => handleJumpSearch({ handleStatus: k })}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: TOKENS.textSecondary, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.color = v.color} onMouseLeave={e => e.currentTarget.style.color = TOKENS.textSecondary}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: v.color, opacity: 0.75 }} />
              {lang === 'zh' ? v.label : v.labelEn}: <span style={{ fontWeight: 600, color: v.color, fontFamily: TOKENS.mono }}>{status[k] || 0}</span>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Upcoming Reviews */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#b080e0" strokeWidth="1.5"><circle cx="10" cy="10" r="8"/><path d="M10 5v5l3 3"/></svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>{lang === 'zh' ? '風險接受到期提醒' : 'Risk Acceptance Reviews'}</span>
          </div>
          {reviews.length === 0 ? (
            <div style={{ fontSize: 13, color: TOKENS.textMuted, padding: '12px 0' }}>{lang === 'zh' ? '目前沒有待重新評估的項目' : 'No items pending review'}</div>
          ) : reviews.map((v, i) => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < reviews.length - 1 ? `1px solid ${TOKENS.border}` : 'none', cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: TOKENS.radius, background: v.daysLeft <= 7 ? TOKENS.dangerDim : v.daysLeft <= 30 ? TOKENS.warningDim : 'rgba(176,128,224,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: TOKENS.mono, color: v.daysLeft <= 7 ? TOKENS.danger : v.daysLeft <= 30 ? TOKENS.warning : '#b080e0' }}>{v.daysLeft <= 0 ? '!' : v.daysLeft}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontFamily: TOKENS.mono, fontSize: 12, fontWeight: 700, color: TOKENS.primary }}>{v.id}</span>
                  <Badge severity={v.severity} />
                </div>
                <div style={{ fontSize: 12, color: TOKENS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lang === 'zh' ? v.mitigation : (v.mitigation_en || v.mitigation)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontFamily: TOKENS.mono, color: TOKENS.text }}>{v.review_date}</div>
                <div style={{ fontSize: 11, color: v.daysLeft <= 7 ? TOKENS.danger : v.daysLeft <= 30 ? TOKENS.warning : TOKENS.textMuted }}>
                  {v.daysLeft <= 0 ? (lang === 'zh' ? '已逾期！' : 'Overdue!') : (lang === 'zh' ? `${v.daysLeft} 天後` : `${v.daysLeft}d`)}
                </div>
              </div>
            </div>
          ))}
        </Card>

        {/* Severity Distribution */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text, marginBottom: 16 }}>{t(lang, 'severityDist')}</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <DonutChart segments={[
              { value: critCount, color: TOKENS.danger },
              { value: highCount, color: TOKENS.warning },
              { value: medCount,  color: TOKENS.medium },
              { value: lowCount,  color: TOKENS.low },
            ]} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[{ l: 'Critical', lz: '嚴重', v: critCount, c: TOKENS.danger, sev: 'CRITICAL' }, { l: 'High', lz: '高', v: highCount, c: TOKENS.warning, sev: 'HIGH' }, { l: 'Medium', lz: '中', v: medCount, c: TOKENS.medium, sev: 'MEDIUM' }, { l: 'Low', lz: '低', v: lowCount, c: TOKENS.low, sev: 'LOW' }].map(i => (
              <div key={i.l} onClick={() => handleJumpSearch({ severity: i.sev })}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: TOKENS.textSecondary }}><span style={{ width: 8, height: 8, borderRadius: 2, background: i.c }} />{lang === 'zh' ? i.lz : i.l}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: TOKENS.mono, fontWeight: 600, color: i.c }}>{i.v}</span>
                  <span style={{ fontSize: 10, color: TOKENS.textMuted }}>→</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card>
          {/* Header + range selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>{t(lang, 'vulnTrend')}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {RANGE_OPTS.map(r => (
                <button key={r.key} onClick={() => setTrendRange(r.key)}
                  style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, border: `1px solid ${trendRange === r.key ? TOKENS.primary : TOKENS.border}`, borderRadius: 20, background: trendRange === r.key ? TOKENS.primaryDim : 'transparent', color: trendRange === r.key ? TOKENS.primary : TOKENS.textSecondary, cursor: 'pointer', fontFamily: TOKENS.font, transition: 'all 0.15s' }}>
                  {lang === 'zh' ? r.zh : r.en}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date pickers */}
          {trendRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <input type="month" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                max={customTo || undefined}
                style={{ padding: '5px 10px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 12, fontFamily: TOKENS.font, outline: 'none', colorScheme: 'dark' }} />
              <span style={{ fontSize: 13, color: TOKENS.textMuted }}>–</span>
              <input type="month" value={customTo} onChange={e => setCustomTo(e.target.value)}
                min={customFrom || undefined}
                style={{ padding: '5px 10px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 12, fontFamily: TOKENS.font, outline: 'none', colorScheme: 'dark' }} />
              <span style={{ fontSize: 11, color: TOKENS.textMuted, marginLeft: 4 }}>
                {filteredTrend.length > 0 ? (lang === 'zh' ? `${filteredTrend.length} 個月` : `${filteredTrend.length} months`) : (lang === 'zh' ? '無資料' : 'No data')}
              </span>
            </div>
          )}

          <MiniBarChart data={filteredTrend} keys={['critical','high','medium','low']} colors={[TOKENS.danger, TOKENS.warning, TOKENS.medium, TOKENS.low]} height={140} />
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            {[{ k: 'critical', l: 'Critical', lz: '嚴重', c: TOKENS.danger }, { k: 'high', l: 'High', lz: '高', c: TOKENS.warning }, { k: 'medium', l: 'Medium', lz: '中', c: TOKENS.medium }, { k: 'low', l: 'Low', lz: '低', c: TOKENS.low }].map(i => (
              <div key={i.k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: TOKENS.textSecondary }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: i.c }} />{lang === 'zh' ? i.lz : i.l}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text, marginBottom: 16 }}>{t(lang, 'vendorDist')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {['Fortinet','Palo Alto'].map(vendor => {
              const cnt = stats?.vendorCounts?.[vendor] || 0;
              const total = stats?.total || 0;
              const pct = total > 0 ? (cnt / total) * 100 : 0;
              return (
                <div key={vendor} onClick={() => handleJumpSearch({ vendor })} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TOKENS.textSecondary, marginBottom: 4 }}>
                    <span>{vendor}</span><span style={{ fontFamily: TOKENS.mono }}>{cnt}</span>
                  </div>
                  <div style={{ height: 8, background: TOKENS.border, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: vendor === 'Fortinet' ? TOKENS.primary : TOKENS.info, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Top 5 */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text, marginBottom: 16 }}>{t(lang, 'topVulns')}</div>
        {topVulns.map((v, i) => (
          <div key={v.id} onClick={() => setDetailVuln(v)}
            style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px 80px 90px', gap: 12, alignItems: 'center', padding: '10px 8px', borderBottom: i < 4 ? `1px solid ${TOKENS.border}` : 'none', cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 13, fontWeight: 600, color: TOKENS.primary }}>{v.id}</span>
            <span style={{ fontSize: 13, color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lang === 'zh' ? v.title : v.title_en}</span>
            <Badge severity={v.severity} />
            <CvssBar score={Number(v.cvss)} />
            <VulnStatusBadge status={v.handle_status} />
          </div>
        ))}
      </Card>

      {/* Mini Detail Modal */}
      {detailVuln && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={() => setDetailVuln(null)}>
          <div style={{ width: 520, background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusLg, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontFamily: TOKENS.mono, fontSize: 14, fontWeight: 700, color: TOKENS.primary }}>{detailVuln.id}</span>
                <Badge severity={detailVuln.severity} />
                <VulnStatusBadge status={detailVuln.handle_status} />
              </div>
              <button onClick={() => setDetailVuln(null)} style={{ background: 'none', border: 'none', color: TOKENS.textMuted, cursor: 'pointer' }}>{Icons.close}</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text }}>{lang === 'zh' ? detailVuln.title : detailVuln.title_en}</div>
              <div style={{ fontSize: 13, color: TOKENS.textSecondary, lineHeight: 1.6 }}>{lang === 'zh' ? detailVuln.description : detailVuln.description_en}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 10, background: TOKENS.bg, borderRadius: TOKENS.radiusSm, border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: 10, color: TOKENS.textMuted, marginBottom: 4 }}>CVSS</div>
                  <CvssBar score={Number(detailVuln.cvss)} />
                </div>
                <div style={{ padding: 10, background: TOKENS.bg, borderRadius: TOKENS.radiusSm, border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: 10, color: TOKENS.textMuted, marginBottom: 4 }}>{lang === 'zh' ? '發佈日期' : 'Published'}</div>
                  <div style={{ fontSize: 13, color: TOKENS.text, fontFamily: TOKENS.mono }}>{detailVuln.published}</div>
                </div>
              </div>
              <div style={{ padding: 10, background: TOKENS.primaryDim, borderRadius: TOKENS.radiusSm, border: `1px solid rgba(0,212,170,0.2)` }}>
                <div style={{ fontSize: 10, color: TOKENS.primary, marginBottom: 4, fontWeight: 600 }}>{lang === 'zh' ? '建議措施' : 'Recommendation'}</div>
                <div style={{ fontSize: 13, color: TOKENS.text }}>{lang === 'zh' ? detailVuln.recommendation : detailVuln.recommendation_en}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
