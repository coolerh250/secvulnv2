// Search Page + Results + Detail Modal + Risk Acceptance
function SearchPage({ preset, onPresetConsumed }) {
  const lang = useLang();
  const [vendor, setVendor] = React.useState('all');
  const [product, setProduct] = React.useState('');
  const [firmware, setFirmware] = React.useState('');
  const [severity, setSeverity] = React.useState('all');
  const [handleFilter, setHandleFilter] = React.useState('all');
  const [dateFrom, setDateFrom] = React.useState('2026-03-01');
  const [dateTo, setDateTo] = React.useState('2026-04-29');
  const [keyword, setKeyword] = React.useState('');
  const [allVulns, setAllVulns] = React.useState(() => [...MOCK_VULNS]);
  const [results, setResults] = React.useState(() => [...MOCK_VULNS]);
  const [selected, setSelected] = React.useState(null);
  const [aiResult, setAiResult] = React.useState(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [sortBy, setSortBy] = React.useState('cvss');
  const [sortDir, setSortDir] = React.useState('desc');
  const [showAcceptModal, setShowAcceptModal] = React.useState(false);
  const [showNoteInput, setShowNoteInput] = React.useState(false);
  const [noteText, setNoteText] = React.useState('');
  const [presetToast, setPresetToast] = React.useState(null);

  // ── Apply preset from dashboard navigation ──
  React.useEffect(() => {
    if (!preset || Object.keys(preset).length === 0) return;
    // Apply filter fields
    let newVendor = 'all', newSeverity = 'all', newHandle = 'all';
    if (preset.severity)     { newSeverity = preset.severity; setSeverity(preset.severity); }
    if (preset.handleStatus) { newHandle   = preset.handleStatus; setHandleFilter(preset.handleStatus); }
    if (preset.vendor)       { newVendor   = preset.vendor;  setVendor(preset.vendor); }
    // Build toast label
    const parts = [];
    if (preset.severity)     parts.push(preset.severity);
    if (preset.handleStatus) parts.push(lang === 'zh' ? (VULN_STATUS[preset.handleStatus]?.label || preset.handleStatus) : (VULN_STATUS[preset.handleStatus]?.labelEn || preset.handleStatus));
    if (preset.vendor)       parts.push(preset.vendor);
    setPresetToast(parts.join(' · '));
    setTimeout(() => setPresetToast(null), 3000);
    if (onPresetConsumed) onPresetConsumed();
    // Run filtered search immediately using local values (state not yet settled)
    let r = [...MOCK_VULNS];
    if (newVendor !== 'all')   r = r.filter(v => v.vendor === newVendor);
    if (newSeverity !== 'all') r = r.filter(v => v.severity === newSeverity);
    if (newHandle !== 'all')   r = r.filter(v => v.handleStatus === newHandle);
    setResults(r);
  }, [preset]);

  const doSearch = () => {
    let r = [...allVulns];
    if (vendor !== 'all') r = r.filter(v => v.vendor === vendor);
    if (product) r = r.filter(v => v.product.toLowerCase().includes(product.toLowerCase()));
    if (firmware) r = r.filter(v => v.firmware.some(f => f.includes(firmware)));
    if (severity !== 'all') r = r.filter(v => v.severity === severity);
    if (handleFilter !== 'all') r = r.filter(v => v.handleStatus === handleFilter);
    if (dateFrom) r = r.filter(v => v.published >= dateFrom);
    if (dateTo) r = r.filter(v => v.published <= dateTo);
    if (keyword) r = r.filter(v => v.id.toLowerCase().includes(keyword.toLowerCase()) || v.title.toLowerCase().includes(keyword.toLowerCase()) || v.titleEn.toLowerCase().includes(keyword.toLowerCase()));
    setResults(r);
  };

  const doReset = () => { setVendor('all'); setProduct(''); setFirmware(''); setSeverity('all'); setHandleFilter('all'); setDateFrom('2026-03-01'); setDateTo('2026-04-29'); setKeyword(''); setResults([...allVulns]); };

  const sorted = [...results].sort((a, b) => {
    const m = sortDir === 'desc' ? -1 : 1;
    if (sortBy === 'cvss') return (a.cvss - b.cvss) * m;
    if (sortBy === 'published') return a.published.localeCompare(b.published) * m;
    return 0;
  });

  const updateVuln = (id, updates) => {
    const updater = list => list.map(v => v.id === id ? { ...v, ...updates } : v);
    setAllVulns(updater);
    setResults(updater);
    if (selected && selected.id === id) setSelected(prev => ({ ...prev, ...updates }));
  };

  const handleAddNote = () => {
    if (!noteText.trim() || !selected) return;
    const newNote = { text: noteText.trim(), date: new Date().toISOString().slice(0, 10), author: 'Admin' };
    updateVuln(selected.id, { notes: [...(selected.notes || []), newNote] });
    setNoteText('');
    setShowNoteInput(false);
  };

  const handleSetStatus = (vulnId, status) => {
    updateVuln(vulnId, { handleStatus: status });
  };

  const exportCsv = () => {
    const header = 'CVE ID,Vendor,Product,CVSS,Severity,Status,Published,Description\n';
    const statusLabel = (v) => { const s = VULN_STATUS[v.handleStatus]; return lang === 'zh' ? s?.label : s?.labelEn; };
    const rows = sorted.map(v => `${v.id},${v.vendor},${v.product},${v.cvss},${v.severity},${statusLabel(v)},${v.published},"${lang === 'zh' ? v.title : v.titleEn}"`).join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vuln-report-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const runAiAnalysis = async (vuln) => {
    setAiLoading(true); setAiResult(null);
    await new Promise(r => setTimeout(r, 2000));
    const analyses = {
      zh: `## AI 分析報告：${vuln.id}\n\n**風險評估：**此弱點的 CVSS 評分為 ${vuln.cvss}，屬於${SEVERITY_MAP[vuln.severity].label}等級。${vuln.cvss >= 9 ? '具有極高的被利用風險，建議立即採取行動。' : vuln.cvss >= 7 ? '被利用的可能性較高，建議在一週內完成修補。' : '風險相對可控，建議在下次維護窗口時處理。'}\n\n**影響範圍：**受影響韌體版本包括 ${vuln.firmware.join('、')}。\n\n**建議措施：**\n1. ${vuln.recommendation}\n2. 檢查是否有可用的 workaround 或 IPS 規則\n3. 更新後驗證服務正常運作`,
      en: `## AI Analysis: ${vuln.id}\n\n**Risk Assessment:** CVSS ${vuln.cvss}, rated ${SEVERITY_MAP[vuln.severity].labelEn}. ${vuln.cvss >= 9 ? 'Extremely high exploitation risk — immediate action recommended.' : vuln.cvss >= 7 ? 'Significant exploitation likelihood — remediate within one week.' : 'Risk is manageable — address during next maintenance window.'}\n\n**Scope:** Affected firmware: ${vuln.firmware.join(', ')}.\n\n**Recommendations:**\n1. ${vuln.recommendationEn}\n2. Check for available workarounds or IPS signatures\n3. Verify service post-update`
    };
    setAiResult(analyses[lang]); setAiLoading(false);
  };

  const SortBtn = ({ field, label }) => (
    <button onClick={() => { if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortBy(field); setSortDir('desc'); } }}
      style={{ background: 'none', border: 'none', color: sortBy === field ? TOKENS.primary : TOKENS.textSecondary, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: TOKENS.font, display: 'flex', alignItems: 'center', gap: 2, padding: 0 }}>
      {label}{sortBy === field && <span style={{ fontSize: 10 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>}
    </button>
  );

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search Filters */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {Icons.filter}<span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>{t(lang, 'searchTitle')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 12 }}>
          <SelectField label={t(lang, 'vendor')} value={vendor} onChange={setVendor} options={[
            { value: 'all', label: t(lang, 'all') }, { value: 'Fortinet', label: 'Fortinet' }, { value: 'Palo Alto', label: 'Palo Alto Networks' }
          ]} />
          <InputField label={t(lang, 'product')} value={product} onChange={setProduct} placeholder="e.g. FortiGate 60F" />
          <InputField label={t(lang, 'firmware')} value={firmware} onChange={setFirmware} placeholder="e.g. 7.0.14" />
          <SelectField label={t(lang, 'severity')} value={severity} onChange={setSeverity} options={[
            { value: 'all', label: t(lang, 'all') }, { value: 'CRITICAL', label: 'Critical' }, { value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }
          ]} />
          <SelectField label={lang === 'zh' ? '處理狀態' : 'Status'} value={handleFilter} onChange={setHandleFilter} options={[
            { value: 'all', label: t(lang, 'all') },
            ...Object.entries(VULN_STATUS).map(([k, v]) => ({ value: k, label: lang === 'zh' ? v.label : v.labelEn }))
          ]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 12, alignItems: 'end' }}>
          <InputField label={t(lang, 'from')} value={dateFrom} onChange={setDateFrom} type="date" />
          <InputField label={t(lang, 'to')} value={dateTo} onChange={setDateTo} type="date" />
          <InputField label={t(lang, 'searchPlaceholder')} value={keyword} onChange={setKeyword} placeholder={t(lang, 'searchPlaceholder')} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="primary" icon={Icons.search} onClick={doSearch}>{t(lang, 'searchBtn')}</Btn>
            <Btn onClick={doReset}>{t(lang, 'resetBtn')}</Btn>
          </div>
        </div>
      </Card>

      {/* Results Header */}
      {/* Preset Toast */}
      {presetToast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: TOKENS.primary, color: '#0a0e1a', padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,212,170,0.3)', animation: 'fadeIn 0.2s ease', display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icons.filter}
          {lang === 'zh' ? `已套用篩選：${presetToast}` : `Filter applied: ${presetToast}`}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: TOKENS.textSecondary }}>{t(lang, 'results')}: <span style={{ fontWeight: 700, color: TOKENS.text, fontFamily: TOKENS.mono }}>{sorted.length}</span></span>
          {/* Preset source badge */}
          {presetToast && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', background: TOKENS.primaryDim, border: `1px solid rgba(0,212,170,0.3)`, borderRadius: 10, fontSize: 11, color: TOKENS.primary, fontWeight: 600 }}>
              {lang === 'zh' ? '來自儀表板' : 'From dashboard'}: {presetToast}
              <span onClick={doReset} style={{ cursor: 'pointer', marginLeft: 2, opacity: 0.7 }}>✕</span>
            </span>
          )}
          {/* Quick status counts */}
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(VULN_STATUS).map(([k, v]) => {
              const cnt = sorted.filter(vl => vl.handleStatus === k).length;
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
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 100px 90px 80px 90px 90px', gap: 0, padding: '10px 16px', borderBottom: `1px solid ${TOKENS.border}`, background: 'rgba(255,255,255,0.02)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'cveId')}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'description')}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'vendor')}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{t(lang, 'severity')}</span>
          <SortBtn field="cvss" label={t(lang, 'cvss')} />
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{lang === 'zh' ? '處理狀態' : 'Status'}</span>
          <SortBtn field="published" label={t(lang, 'published')} />
        </div>
        {sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: TOKENS.textMuted }}>{t(lang, 'noResults')}</div>
        ) : sorted.map(v => (
          <div key={v.id} onClick={() => { setSelected(v); setAiResult(null); setShowAcceptModal(false); setShowNoteInput(false); }}
            style={{ display: 'grid', gridTemplateColumns: '130px 1fr 100px 90px 80px 90px 90px', gap: 0, padding: '12px 16px', borderBottom: `1px solid ${TOKENS.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 13, fontWeight: 600, color: TOKENS.primary }}>{v.id}</span>
            <span style={{ fontSize: 13, color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lang === 'zh' ? v.title : v.titleEn}</span>
            <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{v.vendor}</span>
            <Badge severity={v.severity} />
            <CvssBar score={v.cvss} />
            <VulnStatusBadge status={v.handleStatus} />
            <span style={{ fontSize: 12, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>{v.published}</span>
          </div>
        ))}
      </Card>

      {/* ── Detail Modal ── */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setSelected(null)}>
          <div style={{ width: 780, maxHeight: '90vh', overflowY: 'auto', background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusLg }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${TOKENS.border}`, position: 'sticky', top: 0, background: TOKENS.bgCard, zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: TOKENS.mono, fontSize: 16, fontWeight: 700, color: TOKENS.primary }}>{selected.id}</span>
                <Badge severity={selected.severity} />
                <VulnStatusBadge status={selected.handleStatus} />
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: TOKENS.textMuted, cursor: 'pointer' }}>{Icons.close}</button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Title + Desc */}
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: TOKENS.text, marginBottom: 8 }}>{lang === 'zh' ? selected.title : selected.titleEn}</div>
                <div style={{ fontSize: 14, color: TOKENS.textSecondary, lineHeight: 1.6 }}>{lang === 'zh' ? selected.desc : selected.descEn}</div>
              </div>

              {/* CVSS + Source */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 14, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t(lang, 'cvss')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, fontFamily: TOKENS.mono, color: selected.cvss >= 9 ? TOKENS.danger : selected.cvss >= 7 ? TOKENS.warning : TOKENS.medium }}>{selected.cvss.toFixed(1)}</span>
                    <div style={{ flex: 1, height: 8, background: TOKENS.border, borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${selected.cvss * 10}%`, height: '100%', background: selected.cvss >= 9 ? TOKENS.danger : selected.cvss >= 7 ? TOKENS.warning : TOKENS.medium, borderRadius: 4 }}></div></div>
                  </div>
                </div>
                <div style={{ padding: 14, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t(lang, 'source')}</div>
                  <div style={{ fontSize: 14, color: TOKENS.text }}>{selected.source}</div>
                  <div style={{ fontSize: 12, color: TOKENS.textMuted, marginTop: 4 }}>{selected.published}</div>
                </div>
              </div>

              {/* Affected Versions */}
              <div style={{ padding: 14, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
                <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t(lang, 'affected')}</div>
                <div style={{ fontSize: 13, color: TOKENS.text, fontFamily: TOKENS.mono }}>{selected.vendor} {selected.product}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {selected.firmware.map(f => <span key={f} style={{ padding: '2px 8px', background: TOKENS.warningDim, borderRadius: 4, fontSize: 12, fontFamily: TOKENS.mono, color: TOKENS.warning }}>{f}</span>)}
                </div>
              </div>

              {/* Recommendation */}
              <div style={{ padding: 14, background: TOKENS.primaryDim, borderRadius: TOKENS.radius, border: `1px solid rgba(0,212,170,0.2)` }}>
                <div style={{ fontSize: 11, color: TOKENS.primary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{t(lang, 'recommendation')}</div>
                <div style={{ fontSize: 14, color: TOKENS.text }}>{lang === 'zh' ? selected.recommendation : selected.recommendationEn}</div>
              </div>

              {/* ── Status Actions ── */}
              {(() => {
                const auth = typeof useAuth === 'function' ? useAuth() : null;
                const canModify = auth ? auth.can('search', 'modify') : true;
                if (!canModify) return (
                  <div style={{ padding: 12, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: TOKENS.textMuted }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>
                    {lang === 'zh' ? '您的角色僅能查看，無法執行處理動作' : 'Your role is read-only and cannot perform actions'}
                  </div>
                );
                return (
                <div style={{ padding: 16, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ fontSize: 12, color: TOKENS.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{lang === 'zh' ? '處理動作' : 'Actions'}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn variant={selected.handleStatus === 'fixed' ? 'primary' : 'default'} onClick={() => handleSetStatus(selected.id, 'fixed')} icon={Icons.check}>
                      {lang === 'zh' ? '標記已修復' : 'Mark Fixed'}
                    </Btn>
                    <Btn variant={selected.handleStatus === 'accepted' ? 'primary' : 'default'} onClick={() => setShowAcceptModal(true)}
                      style={{ background: selected.handleStatus === 'accepted' ? 'rgba(176,128,224,0.25)' : undefined, color: selected.handleStatus === 'accepted' ? '#b080e0' : undefined }}>
                      {lang === 'zh' ? '風險接受' : 'Accept Risk'}
                    </Btn>
                    <Btn variant={selected.handleStatus === 'deferred' ? 'primary' : 'default'} onClick={() => handleSetStatus(selected.id, 'deferred')}
                      style={{ background: selected.handleStatus === 'deferred' ? TOKENS.infoDim : undefined, color: selected.handleStatus === 'deferred' ? TOKENS.info : undefined }}>
                      {lang === 'zh' ? '暫不處理' : 'Defer'}
                    </Btn>
                    {selected.handleStatus !== 'pending' && (
                      <Btn variant="ghost" onClick={() => handleSetStatus(selected.id, 'pending')}>
                        {lang === 'zh' ? '重設為待處理' : 'Reset to Pending'}
                      </Btn>
                    )}
                  </div>
                </div>
                );
              })()}

              {/* ── Risk Acceptance Detail (if accepted) ── */}
              {selected.handleStatus === 'accepted' && selected.riskAcceptance && (
                <div style={{ padding: 16, background: 'rgba(176,128,224,0.06)', borderRadius: TOKENS.radius, border: `1px solid rgba(176,128,224,0.2)` }}>
                  <div style={{ fontSize: 12, color: '#b080e0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{lang === 'zh' ? '風險接受記錄' : 'Risk Acceptance Record'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                    <div>
                      <div style={{ color: TOKENS.textMuted, fontSize: 11, marginBottom: 2 }}>{lang === 'zh' ? '接受理由' : 'Reason'}</div>
                      <div style={{ color: TOKENS.text }}>{(ACCEPT_REASONS[lang] || ACCEPT_REASONS.en).find(r => r.value === selected.riskAcceptance.reason)?.label || selected.riskAcceptance.reason}</div>
                    </div>
                    <div>
                      <div style={{ color: TOKENS.textMuted, fontSize: 11, marginBottom: 2 }}>{lang === 'zh' ? '重新評估日期' : 'Review Date'}</div>
                      <div style={{ color: TOKENS.text, fontFamily: TOKENS.mono }}>{selected.riskAcceptance.reviewDate}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ color: TOKENS.textMuted, fontSize: 11, marginBottom: 2 }}>{lang === 'zh' ? '緩解措施' : 'Mitigation'}</div>
                      <div style={{ color: TOKENS.text }}>{lang === 'zh' ? selected.riskAcceptance.mitigation : (selected.riskAcceptance.mitigationEn || selected.riskAcceptance.mitigation)}</div>
                    </div>
                    {selected.riskAcceptance.note && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ color: TOKENS.textMuted, fontSize: 11, marginBottom: 2 }}>{lang === 'zh' ? '備註' : 'Note'}</div>
                        <div style={{ color: TOKENS.textSecondary }}>{selected.riskAcceptance.note}</div>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 10 }}>{lang === 'zh' ? '接受日期' : 'Accepted'}: {selected.riskAcceptance.acceptedDate}</div>
                </div>
              )}

              {/* ── Notes Section ── */}
              <div style={{ padding: 16, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{lang === 'zh' ? '處理備註' : 'Notes'} ({(selected.notes || []).length})</div>
                  <Btn variant="ghost" icon={Icons.plus} onClick={() => setShowNoteInput(!showNoteInput)} style={{ fontSize: 12 }}>{lang === 'zh' ? '新增備註' : 'Add Note'}</Btn>
                </div>
                {showNoteInput && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder={lang === 'zh' ? '輸入備註...' : 'Enter note...'} onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                      style={{ flex: 1, padding: '8px 12px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 13, fontFamily: TOKENS.font, outline: 'none' }} />
                    <Btn variant="primary" onClick={handleAddNote} disabled={!noteText.trim()}>{lang === 'zh' ? '儲存' : 'Save'}</Btn>
                  </div>
                )}
                {(selected.notes || []).length === 0 && !showNoteInput && (
                  <div style={{ fontSize: 13, color: TOKENS.textMuted, padding: '8px 0' }}>{lang === 'zh' ? '尚無備註' : 'No notes yet'}</div>
                )}
                {(selected.notes || []).map((n, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i > 0 ? `1px solid ${TOKENS.border}` : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: TOKENS.primaryDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: TOKENS.primary, fontWeight: 600, flexShrink: 0 }}>{n.author?.[0] || 'A'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.text }}>{n.author}</span>
                        <span style={{ fontSize: 11, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>{n.date}</span>
                      </div>
                      <div style={{ fontSize: 13, color: TOKENS.textSecondary, lineHeight: 1.5 }}>{n.text}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* References */}
              <div>
                <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t(lang, 'references')}</div>
                {selected.refs.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {Icons.external}
                    <a href={r} target="_blank" rel="noopener" style={{ fontSize: 12, color: TOKENS.primary, textDecoration: 'none', fontFamily: TOKENS.mono, wordBreak: 'break-all' }}>{r}</a>
                  </div>
                ))}
              </div>

              {/* AI Analysis */}
              <div style={{ borderTop: `1px solid ${TOKENS.border}`, paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{Icons.ai}<span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>{t(lang, 'aiAnalysis')}</span></div>
                  <Btn variant="primary" icon={Icons.ai} onClick={() => runAiAnalysis(selected)} disabled={aiLoading}>{aiLoading ? t(lang, 'analyzing') : t(lang, 'analyzeVuln')}</Btn>
                </div>
                {aiLoading && (
                  <div style={{ padding: 20, textAlign: 'center' }}>
                    <div style={{ width: 24, height: 24, border: `2px solid ${TOKENS.border}`, borderTop: `2px solid ${TOKENS.primary}`, borderRadius: '50%', margin: '0 auto 8px', animation: 'spin 0.8s linear infinite' }}></div>
                    <div style={{ fontSize: 13, color: TOKENS.textSecondary }}>{t(lang, 'analyzing')}</div>
                  </div>
                )}
                {aiResult && (
                  <div style={{ padding: 16, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}`, fontSize: 13, color: TOKENS.text, lineHeight: 1.7 }}>
                    {aiResult.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) return <div key={i} style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: TOKENS.primary }}>{line.replace('## ', '')}</div>;
                      if (line.startsWith('**') && line.includes('**')) return <div key={i} style={{ fontWeight: 600, marginTop: 8, color: TOKENS.text }}>{line.replace(/\*\*/g, '')}</div>;
                      if (line.match(/^\d\./)) return <div key={i} style={{ paddingLeft: 16, color: TOKENS.textSecondary }}>{line}</div>;
                      return <div key={i}>{line}</div>;
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Risk Acceptance Modal ── */}
      {showAcceptModal && selected && <RiskAcceptModal vuln={selected} lang={lang} onClose={() => setShowAcceptModal(false)}
        onSave={(data) => { updateVuln(selected.id, { handleStatus: 'accepted', riskAcceptance: { ...data, acceptedDate: new Date().toISOString().slice(0, 10) } }); setShowAcceptModal(false); }} />}
    </div>
  );
}

function RiskAcceptModal({ vuln, lang, onClose, onSave }) {
  const [reason, setReason] = React.useState('');
  const [reasonDetail, setReasonDetail] = React.useState('');
  const [mitigation, setMitigation] = React.useState('');
  const [reviewDate, setReviewDate] = React.useState('');
  const [note, setNote] = React.useState('');

  const reasons = ACCEPT_REASONS[lang] || ACCEPT_REASONS.en;
  const canSave = reason && mitigation && reviewDate;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ width: 560, background: TOKENS.bgCard, border: `1px solid rgba(176,128,224,0.3)`, borderRadius: TOKENS.radiusLg, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text }}>{lang === 'zh' ? '風險接受' : 'Risk Acceptance'}</div>
            <div style={{ fontSize: 12, color: TOKENS.textMuted, marginTop: 2 }}>{vuln.id} — {lang === 'zh' ? vuln.title : vuln.titleEn}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TOKENS.textMuted, cursor: 'pointer' }}>{Icons.close}</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SelectField label={(lang === 'zh' ? '接受理由' : 'Reason') + ' *'} value={reason} onChange={setReason}
            options={[{ value: '', label: lang === 'zh' ? '請選擇...' : 'Select...' }, ...reasons]} />
          {reason === 'other' && (
            <InputField label={lang === 'zh' ? '詳細說明' : 'Details'} value={reasonDetail} onChange={setReasonDetail} placeholder={lang === 'zh' ? '請說明理由...' : 'Please specify...'} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{(lang === 'zh' ? '緩解措施' : 'Mitigation Measures') + ' *'}</label>
            <textarea value={mitigation} onChange={e => setMitigation(e.target.value)} rows={3}
              placeholder={lang === 'zh' ? '說明已採取的補償控制或緩解措施，例如：ACL 限制、IPS 規則、網段隔離...' : 'Describe compensating controls or mitigations in place, e.g. ACL rules, IPS signatures, network segmentation...'}
              style={{ width: '100%', padding: '8px 12px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 13, fontFamily: TOKENS.font, outline: 'none', resize: 'vertical' }} />
          </div>
          <InputField label={(lang === 'zh' ? '重新評估日期' : 'Review Date') + ' *'} value={reviewDate} onChange={setReviewDate} type="date" />
          <InputField label={lang === 'zh' ? '備註（選填）' : 'Note (optional)'} value={note} onChange={setNote} placeholder={lang === 'zh' ? '其他備註...' : 'Additional notes...'} />

          <div style={{ padding: 10, background: TOKENS.warningDim, borderRadius: TOKENS.radiusSm, border: `1px solid rgba(240,160,48,0.2)`, fontSize: 12, color: TOKENS.warning, lineHeight: 1.5 }}>
            {lang === 'zh' ? '⚠ 風險接受表示您已評估此弱點並決定暫不修復。系統將在重新評估日期到期時提醒您重新檢視。' : '⚠ Risk acceptance means you have evaluated this vulnerability and decided not to remediate. The system will remind you to re-evaluate on the review date.'}
          </div>
        </div>
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn onClick={onClose}>{lang === 'zh' ? '取消' : 'Cancel'}</Btn>
          <Btn variant="primary" onClick={() => onSave({ reason, reasonDetail, mitigation, reviewDate, note })} disabled={!canSave}
            style={{ background: canSave ? '#b080e0' : undefined }}>{lang === 'zh' ? '確認接受風險' : 'Confirm Risk Acceptance'}</Btn>
        </div>
      </div>
    </div>
  );
}

window.SearchPage = SearchPage;
