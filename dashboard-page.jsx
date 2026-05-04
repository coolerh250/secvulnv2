// Dashboard Page — with expandable stat cards (Plan C) + jump-to-search (Plan A)
function DashboardPage({ onNavigate }) {
  const lang = useLang();

  const critCount   = MOCK_VULNS.filter(v => v.severity === 'CRITICAL').length;
  const highCount   = MOCK_VULNS.filter(v => v.severity === 'HIGH').length;
  const medCount    = MOCK_VULNS.filter(v => v.severity === 'MEDIUM').length;
  const lowCount    = MOCK_VULNS.filter(v => v.severity === 'LOW').length;
  const pendingCount   = MOCK_VULNS.filter(v => v.handleStatus === 'pending').length;
  const acceptedCount  = MOCK_VULNS.filter(v => v.handleStatus === 'accepted').length;
  const deferredCount  = MOCK_VULNS.filter(v => v.handleStatus === 'deferred').length;
  const fixedCount     = MOCK_VULNS.filter(v => v.handleStatus === 'fixed').length;

  const [expanded, setExpanded] = React.useState(null); // which card is open
  const [detailVuln, setDetailVuln] = React.useState(null); // mini-detail popover

  const today = '2026-05-04';
  const reviewItems = MOCK_VULNS
    .filter(v => v.handleStatus === 'accepted' && v.riskAcceptance?.reviewDate)
    .map(v => ({ ...v, daysLeft: Math.ceil((new Date(v.riskAcceptance.reviewDate) - new Date(today)) / 86400000) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Stat card definitions — filter tells search page what to pre-fill
  const stats = [
    {
      id: 'total',
      label: t(lang, 'totalVulns'),
      value: MOCK_VULNS.length,
      color: TOKENS.info,
      sub: lang === 'zh' ? `${pendingCount} 待處理` : `${pendingCount} pending`,
      filter: {},
      vulns: MOCK_VULNS,
    },
    {
      id: 'critical',
      label: t(lang, 'criticalVulns'),
      value: critCount,
      color: TOKENS.danger,
      sub: lang === 'zh' ? '需立即處理' : 'Immediate action',
      filter: { severity: 'CRITICAL' },
      vulns: MOCK_VULNS.filter(v => v.severity === 'CRITICAL'),
    },
    {
      id: 'accepted',
      label: lang === 'zh' ? '風險接受' : 'Risk Accepted',
      value: acceptedCount,
      color: '#b080e0',
      sub: lang === 'zh' ? `${deferredCount} 暫不處理` : `${deferredCount} deferred`,
      filter: { handleStatus: 'accepted' },
      vulns: MOCK_VULNS.filter(v => v.handleStatus === 'accepted'),
    },
    {
      id: 'fixed',
      label: lang === 'zh' ? '已修復' : 'Fixed',
      value: fixedCount,
      color: TOKENS.low,
      sub: lang === 'zh' ? `共 ${MOCK_VULNS.length} 筆` : `of ${MOCK_VULNS.length} total`,
      filter: { handleStatus: 'fixed' },
      vulns: MOCK_VULNS.filter(v => v.handleStatus === 'fixed'),
    },
  ];

  const handleCardClick = (id) => setExpanded(prev => prev === id ? null : id);

  const handleJumpSearch = (filter) => {
    if (onNavigate) onNavigate('search', filter);
  };

  // ── Expandable Vuln Row (inside card) ──
  const VulnRow = ({ v, isLast }) => {
    const [hovered, setHovered] = React.useState(false);
    return (
      <div
        onClick={e => { e.stopPropagation(); setDetailVuln(v); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'grid', gridTemplateColumns: '120px 1fr 90px 80px 90px',
          gap: 10, alignItems: 'center', padding: '9px 12px',
          borderBottom: isLast ? 'none' : `1px solid ${TOKENS.border}`,
          borderRadius: isLast ? `0 0 ${TOKENS.radiusSm} ${TOKENS.radiusSm}` : 0,
          cursor: 'pointer', transition: 'background 0.1s',
          background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        }}>
        <span style={{ fontFamily: TOKENS.mono, fontSize: 12, fontWeight: 700, color: TOKENS.primary }}>{v.id}</span>
        <span style={{ fontSize: 12, color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lang === 'zh' ? v.title : v.titleEn}</span>
        <Badge severity={v.severity} />
        <CvssBar score={v.cvss} />
        <VulnStatusBadge status={v.handleStatus} />
      </div>
    );
  };

  // ── Expanded Panel ──
  const ExpandedPanel = ({ stat }) => {
    const preview = stat.vulns.sort((a, b) => b.cvss - a.cvss).slice(0, 5);
    return (
      <div style={{
        border: `1px solid ${stat.color}40`,
        borderRadius: TOKENS.radius,
        marginTop: 0,
        overflow: 'hidden',
        animation: 'expandDown 0.2s ease',
        background: TOKENS.bgCard,
      }}>
        {/* Panel header */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px 80px 90px', gap: 10, padding: '7px 12px', background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${TOKENS.border}` }}>
          {[t(lang, 'cveId'), lang === 'zh' ? '標題' : 'Title', t(lang, 'severity'), t(lang, 'cvss'), lang === 'zh' ? '狀態' : 'Status'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
          ))}
        </div>
        {preview.length === 0 ? (
          <div style={{ padding: '16px 12px', fontSize: 13, color: TOKENS.textMuted }}>{lang === 'zh' ? '無符合項目' : 'No items'}</div>
        ) : preview.map((v, i) => (
          <VulnRow key={v.id} v={v} isLast={i === preview.length - 1} />
        ))}
        {/* Footer — jump to search */}
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
          <span style={{ fontSize: 12, color: TOKENS.textMuted }}>
            {lang === 'zh' ? `顯示前 ${preview.length} 筆，共 ${stat.vulns.length} 筆` : `Showing ${preview.length} of ${stat.vulns.length}`}
          </span>
          <button
            onClick={e => { e.stopPropagation(); handleJumpSearch(stat.filter); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: `${stat.color}18`, border: `1px solid ${stat.color}40`, borderRadius: TOKENS.radiusSm, color: stat.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: TOKENS.font, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = `${stat.color}28`}
            onMouseLeave={e => e.currentTarget.style.background = `${stat.color}18`}>
            {lang === 'zh' ? '查看全部 →' : 'View all →'}
          </button>
        </div>
      </div>
    );
  };

  // ── Mini Detail Popover ──
  const MiniDetail = ({ v, onClose }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ width: 520, background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusLg, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 14, fontWeight: 700, color: TOKENS.primary }}>{v.id}</span>
            <Badge severity={v.severity} />
            <VulnStatusBadge status={v.handleStatus} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TOKENS.textMuted, cursor: 'pointer' }}>{Icons.close}</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text }}>{lang === 'zh' ? v.title : v.titleEn}</div>
          <div style={{ fontSize: 13, color: TOKENS.textSecondary, lineHeight: 1.6 }}>{lang === 'zh' ? v.desc : v.descEn}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: 10, background: TOKENS.bg, borderRadius: TOKENS.radiusSm, border: `1px solid ${TOKENS.border}` }}>
              <div style={{ fontSize: 10, color: TOKENS.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CVSS</div>
              <CvssBar score={v.cvss} />
            </div>
            <div style={{ padding: 10, background: TOKENS.bg, borderRadius: TOKENS.radiusSm, border: `1px solid ${TOKENS.border}` }}>
              <div style={{ fontSize: 10, color: TOKENS.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lang === 'zh' ? '發佈日期' : 'Published'}</div>
              <div style={{ fontSize: 13, color: TOKENS.text, fontFamily: TOKENS.mono }}>{v.published}</div>
            </div>
          </div>
          <div style={{ padding: 10, background: TOKENS.primaryDim, borderRadius: TOKENS.radiusSm, border: `1px solid rgba(0,212,170,0.2)` }}>
            <div style={{ fontSize: 10, color: TOKENS.primary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{lang === 'zh' ? '建議措施' : 'Recommendation'}</div>
            <div style={{ fontSize: 13, color: TOKENS.text }}>{lang === 'zh' ? v.recommendation : v.recommendationEn}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => { onClose(); handleJumpSearch({}); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: TOKENS.primaryDim, border: `1px solid rgba(0,212,170,0.3)`, borderRadius: TOKENS.radiusSm, color: TOKENS.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: TOKENS.font }}>
              {lang === 'zh' ? '在搜尋頁查看完整資訊 →' : 'View full details in Search →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@keyframes expandDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* ── Stat Cards Row (clickable, expandable) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map(s => {
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div
                  onClick={() => handleCardClick(s.id)}
                  style={{
                    background: isOpen ? `${s.color}10` : TOKENS.bgCard,
                    border: `1px solid ${isOpen ? s.color + '60' : TOKENS.border}`,
                    borderRadius: isOpen ? `${TOKENS.radiusLg} ${TOKENS.radiusLg} 0 0` : TOKENS.radiusLg,
                    borderBottom: isOpen ? 'none' : undefined,
                    padding: 20,
                    cursor: 'pointer',
                    transition: 'all 0.18s',
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.borderColor = `${s.color}50`; }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.borderColor = TOKENS.border; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 12, color: TOKENS.textSecondary, marginBottom: 6 }}>{s.label}</div>
                    <span style={{ fontSize: 11, color: isOpen ? s.color : TOKENS.textMuted, transition: 'color 0.15s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s, color 0.15s' }}>▾</span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: s.color, fontFamily: TOKENS.mono }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 4 }}>{s.sub}</div>
                  {isOpen && <div style={{ fontSize: 11, color: s.color, marginTop: 8, fontWeight: 600 }}>{lang === 'zh' ? '點擊收合 ↑' : 'Click to collapse ↑'}</div>}
                  {!isOpen && <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 6 }}>{lang === 'zh' ? '點擊展開' : 'Click to expand'}</div>}
                </div>
                {isOpen && <ExpandedPanel stat={s} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status Overview Bar ── */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text, marginBottom: 16 }}>{lang === 'zh' ? '弱點處理狀態總覽' : 'Vulnerability Handling Overview'}</div>
        <div style={{ display: 'flex', gap: 0, height: 32, borderRadius: TOKENS.radiusSm, overflow: 'hidden', marginBottom: 12 }}>
          {Object.entries(VULN_STATUS).map(([k, v]) => {
            const cnt = MOCK_VULNS.filter(vl => vl.handleStatus === k).length;
            const pct = (cnt / MOCK_VULNS.length) * 100;
            if (pct === 0) return null;
            return (
              <div key={k} onClick={() => handleJumpSearch({ handleStatus: k })}
                style={{ width: `${pct}%`, background: v.color, opacity: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff', cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.75'}
                title={`${lang === 'zh' ? v.label : v.labelEn}: ${cnt} — ${lang === 'zh' ? '點擊搜尋' : 'Click to search'}`}>
                {pct > 10 ? cnt : ''}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {Object.entries(VULN_STATUS).map(([k, v]) => {
            const cnt = MOCK_VULNS.filter(vl => vl.handleStatus === k).length;
            return (
              <div key={k} onClick={() => handleJumpSearch({ handleStatus: k })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: TOKENS.textSecondary, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color = v.color} onMouseLeave={e => e.currentTarget.style.color = TOKENS.textSecondary}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: v.color, opacity: 0.75 }}></span>
                {lang === 'zh' ? v.label : v.labelEn}: <span style={{ fontWeight: 600, color: v.color, fontFamily: TOKENS.mono }}>{cnt}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Upcoming Reviews */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#b080e0" strokeWidth="1.5"><circle cx="10" cy="10" r="8"/><path d="M10 5v5l3 3"/></svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>{lang === 'zh' ? '風險接受到期提醒' : 'Risk Acceptance Reviews'}</span>
          </div>
          {reviewItems.length === 0 ? (
            <div style={{ fontSize: 13, color: TOKENS.textMuted, padding: '12px 0' }}>{lang === 'zh' ? '目前沒有待重新評估的項目' : 'No items pending review'}</div>
          ) : reviewItems.map((v, i) => (
            <div key={v.id} onClick={() => setDetailVuln(v)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < reviewItems.length - 1 ? `1px solid ${TOKENS.border}` : 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              <div style={{ width: 40, height: 40, borderRadius: TOKENS.radius, background: v.daysLeft <= 7 ? TOKENS.dangerDim : v.daysLeft <= 30 ? TOKENS.warningDim : 'rgba(176,128,224,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: TOKENS.mono, color: v.daysLeft <= 7 ? TOKENS.danger : v.daysLeft <= 30 ? TOKENS.warning : '#b080e0' }}>{v.daysLeft <= 0 ? '!' : v.daysLeft}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontFamily: TOKENS.mono, fontSize: 12, fontWeight: 700, color: TOKENS.primary }}>{v.id}</span>
                  <Badge severity={v.severity} />
                </div>
                <div style={{ fontSize: 12, color: TOKENS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lang === 'zh' ? v.riskAcceptance?.mitigation : (v.riskAcceptance?.mitigationEn || v.riskAcceptance?.mitigation)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontFamily: TOKENS.mono, color: TOKENS.text }}>{v.riskAcceptance?.reviewDate}</div>
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
              { value: medCount, color: TOKENS.medium },
              { value: lowCount, color: TOKENS.low },
            ]} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[{l:'Critical',lz:'嚴重',v:critCount,c:TOKENS.danger,sev:'CRITICAL'},{l:'High',lz:'高',v:highCount,c:TOKENS.warning,sev:'HIGH'},{l:'Medium',lz:'中',v:medCount,c:TOKENS.medium,sev:'MEDIUM'},{l:'Low',lz:'低',v:lowCount,c:TOKENS.low,sev:'LOW'}].map(i => (
              <div key={i.l} onClick={() => handleJumpSearch({ severity: i.sev })}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, cursor: 'pointer', padding: '3px 4px', borderRadius: 4, transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: TOKENS.textSecondary }}><span style={{ width: 8, height: 8, borderRadius: 2, background: i.c }}></span>{lang === 'zh' ? i.lz : i.l}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: TOKENS.mono, fontWeight: 600, color: i.c }}>{i.v}</span>
                  <span style={{ fontSize: 10, color: TOKENS.textMuted }}>→</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 10, textAlign: 'center' }}>{lang === 'zh' ? '點擊任一項目跳轉搜尋' : 'Click to filter in search'}</div>
        </Card>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text, marginBottom: 16 }}>{t(lang, 'vulnTrend')}</div>
          <MiniBarChart data={TREND_DATA} keys={['critical', 'high', 'medium', 'low']} colors={[TOKENS.danger, TOKENS.warning, TOKENS.medium, TOKENS.low]} height={140} />
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            {[{k:'critical',l:'Critical',lz:'嚴重',c:TOKENS.danger},{k:'high',l:'High',lz:'高',c:TOKENS.warning},{k:'medium',l:'Medium',lz:'中',c:TOKENS.medium},{k:'low',l:'Low',lz:'低',c:TOKENS.low}].map(i => (
              <div key={i.k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: TOKENS.textSecondary }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: i.c }}></span>{lang === 'zh' ? i.lz : i.l}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text, marginBottom: 16 }}>{t(lang, 'vendorDist')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {['Fortinet', 'Palo Alto'].map(v => {
              const cnt = MOCK_VULNS.filter(vl => vl.vendor === v).length;
              const pct = (cnt / MOCK_VULNS.length) * 100;
              return (
                <div key={v} onClick={() => handleJumpSearch({ vendor: v })} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TOKENS.textSecondary, marginBottom: 4 }}>
                    <span>{v}</span><div style={{ display: 'flex', gap: 6 }}><span style={{ fontFamily: TOKENS.mono }}>{cnt}</span><span style={{ color: TOKENS.textMuted }}>→</span></div>
                  </div>
                  <div style={{ height: 8, background: TOKENS.border, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: v === 'Fortinet' ? TOKENS.primary : TOKENS.info, borderRadius: 4, transition: 'width 0.6s ease' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 14, textAlign: 'center' }}>{lang === 'zh' ? '點擊廠商跳轉搜尋' : 'Click vendor to filter in search'}</div>
        </Card>
      </div>

      {/* Top 5 with status */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text, marginBottom: 16 }}>{t(lang, 'topVulns')}</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[...MOCK_VULNS].sort((a, b) => b.cvss - a.cvss).slice(0, 5).map((v, i) => (
            <div key={v.id} onClick={() => setDetailVuln(v)}
              style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px 80px 90px', gap: 12, alignItems: 'center', padding: '10px 8px', borderBottom: i < 4 ? `1px solid ${TOKENS.border}` : 'none', cursor: 'pointer', borderRadius: 6, transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontFamily: TOKENS.mono, fontSize: 13, fontWeight: 600, color: TOKENS.primary }}>{v.id}</span>
              <span style={{ fontSize: 13, color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lang === 'zh' ? v.title : v.titleEn}</span>
              <Badge severity={v.severity} />
              <CvssBar score={v.cvss} />
              <VulnStatusBadge status={v.handleStatus} />
            </div>
          ))}
        </div>
      </Card>

      {/* Mini Detail Popover */}
      {detailVuln && <MiniDetail v={detailVuln} onClose={() => setDetailVuln(null)} />}
    </div>
  );
}

window.DashboardPage = DashboardPage;
