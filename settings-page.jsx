// Settings Page — with full Data Source Management (Plan C)
function SettingsPage() {
  const lang = useLang();

  // ── AI Provider state ──
  const [aiProvider, setAiProvider] = React.useState('claude');
  const [aiModel, setAiModel] = React.useState('claude-sonnet-4');
  const [authMethod, setAuthMethod] = React.useState('webauth');
  const [apiKey, setApiKey] = React.useState('');

  // ── Notifications state ──
  const [emailNotif, setEmailNotif] = React.useState(true);
  const [webNotif, setWebNotif] = React.useState(true);
  const [notifThreshold, setNotifThreshold] = React.useState('HIGH');
  const [email, setEmail] = React.useState('admin@example.com');

  // ── Data Sources state ──
  const defaultSources = [
    {
      id: 'nvd', name: 'NVD (NIST)', nameEn: 'NVD (NIST)',
      desc: 'National Vulnerability Database — 公開 CVE 資料庫', descEn: 'National Vulnerability Database — public CVE repository',
      type: 'builtin', url: 'https://services.nvd.nist.gov/rest/json/cves/2.0',
      apiKey: '', requiresKey: true, keyPlaceholder: 'NVD API Key (選填，提高速率限制)',
      enabled: true, lastSync: '2026-05-04 08:00', syncStatus: 'ok',
      syncFreq: '6h', customUrl: '',
    },
    {
      id: 'fortinet', name: 'Fortinet PSIRT', nameEn: 'Fortinet PSIRT',
      desc: 'FortiGuard 安全公告 — FortiOS / FortiGate 系列', descEn: 'FortiGuard Security Advisories — FortiOS / FortiGate',
      type: 'builtin', url: 'https://fortiguard.com/psirt',
      apiKey: '', requiresKey: false, keyPlaceholder: '',
      enabled: true, lastSync: '2026-05-04 08:05', syncStatus: 'ok',
      syncFreq: '12h', customUrl: '',
    },
    {
      id: 'paloalto', name: 'Palo Alto Networks', nameEn: 'Palo Alto Networks',
      desc: 'PAN Security Advisories — PAN-OS / PA 系列', descEn: 'PAN Security Advisories — PAN-OS / PA Series',
      type: 'builtin', url: 'https://security.paloaltonetworks.com',
      apiKey: '', requiresKey: false, keyPlaceholder: '',
      enabled: true, lastSync: '2026-05-04 08:10', syncStatus: 'ok',
      syncFreq: '12h', customUrl: '',
    },
    {
      id: 'cisa_kev', name: 'CISA KEV', nameEn: 'CISA KEV',
      desc: 'CISA 已知被利用弱點目錄 — 高優先處理清單', descEn: 'CISA Known Exploited Vulnerabilities — high-priority list',
      type: 'builtin', url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      apiKey: '', requiresKey: false, keyPlaceholder: '',
      enabled: false, lastSync: '—', syncStatus: 'disabled',
      syncFreq: '24h', customUrl: '',
    },
  ];

  const [sources, setSources] = React.useState(defaultSources);
  const [expandedSource, setExpandedSource] = React.useState(null);
  const [testingId, setTestingId] = React.useState(null);
  const [testResult, setTestResult] = React.useState({});
  const [syncingId, setSyncingId] = React.useState(null);
  const [showAddSource, setShowAddSource] = React.useState(false);
  const [newSource, setNewSource] = React.useState({ name: '', desc: '', url: '', apiKey: '', syncFreq: '24h' });
  const [saved, setSaved] = React.useState(false);

  const providerModels = {
    claude: [{ value: 'claude-sonnet-4', label: 'Claude Sonnet 4' }, { value: 'claude-opus-4', label: 'Claude Opus 4' }, { value: 'claude-haiku-3.5', label: 'Claude 3.5 Haiku' }],
    gemini: [{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }, { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }],
    chatgpt: [{ value: 'gpt-4.1', label: 'GPT-4.1' }, { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' }, { value: 'o3', label: 'o3' }],
    openai: [{ value: 'gpt-4.1', label: 'GPT-4.1' }, { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' }, { value: 'o3', label: 'o3' }, { value: 'o4-mini', label: 'o4-mini' }],
  };
  const providers = [
    { value: 'claude', label: 'Claude (Anthropic)' }, { value: 'gemini', label: 'Gemini (Google)' },
    { value: 'chatgpt', label: 'ChatGPT (OpenAI)' }, { value: 'openai', label: 'OpenAI API' },
  ];

  React.useEffect(() => {
    const models = providerModels[aiProvider];
    if (models && !models.find(m => m.value === aiModel)) setAiModel(models[0].value);
    setAuthMethod(aiProvider === 'claude' ? 'webauth' : 'apikey');
  }, [aiProvider]);

  const updateSource = (id, updates) => setSources(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

  const handleTest = async (src) => {
    setTestingId(src.id);
    setTestResult(prev => ({ ...prev, [src.id]: null }));
    await new Promise(r => setTimeout(r, 1800));
    const ok = src.enabled && src.url.startsWith('http');
    setTestResult(prev => ({ ...prev, [src.id]: ok ? 'ok' : 'fail' }));
    setTestingId(null);
  };

  const handleSync = async (src) => {
    setSyncingId(src.id);
    await new Promise(r => setTimeout(r, 2200));
    const now = new Date().toISOString().slice(0,16).replace('T',' ');
    updateSource(src.id, { lastSync: now, syncStatus: 'ok' });
    setSyncingId(null);
  };

  const handleAddSource = () => {
    if (!newSource.name || !newSource.url) return;
    const s = {
      id: 'custom_' + Date.now(), name: newSource.name, nameEn: newSource.name,
      desc: newSource.desc, descEn: newSource.desc, type: 'custom',
      url: newSource.url, apiKey: newSource.apiKey, requiresKey: !!newSource.apiKey, keyPlaceholder: 'API Key',
      enabled: true, lastSync: '—', syncStatus: 'pending', syncFreq: newSource.syncFreq, customUrl: newSource.url,
    };
    setSources(prev => [...prev, s]);
    setNewSource({ name: '', desc: '', url: '', apiKey: '', syncFreq: '24h' });
    setShowAddSource(false);
  };

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const toggleStyle = (on) => ({ width: 40, height: 22, borderRadius: 11, background: on ? TOKENS.primary : TOKENS.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', border: 'none', padding: 0, flexShrink: 0 });
  const toggleKnob = (on) => ({ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' });

  const syncFreqOptions = [
    { value: '1h',  label: lang === 'zh' ? '每 1 小時' : 'Every 1 hour' },
    { value: '3h',  label: lang === 'zh' ? '每 3 小時' : 'Every 3 hours' },
    { value: '6h',  label: lang === 'zh' ? '每 6 小時' : 'Every 6 hours' },
    { value: '12h', label: lang === 'zh' ? '每 12 小時' : 'Every 12 hours' },
    { value: '24h', label: lang === 'zh' ? '每天' : 'Daily' },
    { value: '48h', label: lang === 'zh' ? '每 2 天' : 'Every 2 days' },
    { value: '168h',label: lang === 'zh' ? '每週' : 'Weekly' },
    { value: 'manual', label: lang === 'zh' ? '手動同步' : 'Manual only' },
  ];

  const statusInfo = (s) => {
    if (!s.enabled) return { color: TOKENS.textMuted, label: lang === 'zh' ? '已停用' : 'Disabled', dot: '○' };
    if (s.syncStatus === 'ok') return { color: TOKENS.low, label: lang === 'zh' ? '正常' : 'OK', dot: '●' };
    if (s.syncStatus === 'fail') return { color: TOKENS.danger, label: lang === 'zh' ? '連線失敗' : 'Failed', dot: '●' };
    if (s.syncStatus === 'pending') return { color: TOKENS.warning, label: lang === 'zh' ? '待同步' : 'Pending', dot: '●' };
    return { color: TOKENS.textMuted, label: '—', dot: '○' };
  };

  const DbIcon = <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="10" cy="5" rx="8" ry="3"/><path d="M2 5v5c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M2 10v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5"/></svg>;

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>

      {/* ── AI Provider ── */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>{Icons.ai}<span>{t(lang, 'aiProvider')}</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {providers.map(p => (
              <button key={p.value} onClick={() => setAiProvider(p.value)}
                style={{ padding: '14px 12px', background: aiProvider === p.value ? TOKENS.primaryDim : TOKENS.bgInput, border: `1px solid ${aiProvider === p.value ? TOKENS.primary : TOKENS.border}`, borderRadius: TOKENS.radius, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: aiProvider === p.value ? TOKENS.primary : TOKENS.text, fontFamily: TOKENS.font }}>{p.label}</div>
                {aiProvider === p.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: TOKENS.primary, margin: '6px auto 0' }}></div>}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SelectField label={t(lang, 'aiModel')} value={aiModel} onChange={setAiModel} options={providerModels[aiProvider] || []} />
            {aiProvider === 'claude' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{t(lang, 'authMethod')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['webauth','apikey'].map(m => (
                    <button key={m} onClick={() => setAuthMethod(m)} style={{ flex: 1, padding: '8px 12px', background: authMethod === m ? TOKENS.primaryDim : TOKENS.bgInput, border: `1px solid ${authMethod === m ? TOKENS.primary : TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: authMethod === m ? TOKENS.primary : TOKENS.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: TOKENS.font }}>
                      {m === 'webauth' ? t(lang, 'webAuth') : t(lang, 'apiKeyAuth')}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <InputField label={t(lang, 'apiKey')} value={apiKey} onChange={setApiKey} type="password" placeholder="sk-..." />
            )}
          </div>
          {aiProvider === 'claude' && authMethod === 'webauth' && (
            <div style={{ padding: 12, background: TOKENS.primaryDim, borderRadius: TOKENS.radiusSm, border: `1px solid rgba(0,212,170,0.2)` }}>
              <div style={{ fontSize: 12, color: TOKENS.primary, marginBottom: 6, fontWeight: 600 }}>{lang === 'zh' ? '網頁認證模式' : 'Web Auth Mode'}</div>
              <div style={{ fontSize: 12, color: TOKENS.textSecondary, lineHeight: 1.5 }}>{lang === 'zh' ? '透過 OAuth 流程取得授權，無需 API Key。' : 'Authorize via OAuth flow — no API Key required.'}</div>
              <Btn variant="primary" style={{ marginTop: 10 }} onClick={() => {}}>{lang === 'zh' ? '開始授權' : 'Authorize'}</Btn>
            </div>
          )}
          {aiProvider === 'claude' && authMethod === 'apikey' && (
            <InputField label={t(lang, 'apiKey')} value={apiKey} onChange={setApiKey} type="password" placeholder="sk-ant-..." />
          )}
        </div>
      </Card>

      {/* ── Notifications ── */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>{Icons.bell}<span>{t(lang, 'notifications')}</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[{ label: t(lang,'emailNotif'), sub: lang==='zh'?'新弱點發佈時寄送 Email 通知':'Send email on new vulnerability', val: emailNotif, set: setEmailNotif },
            { label: t(lang,'webNotif'),   sub: lang==='zh'?'在網頁介面顯示通知提醒':'Show alerts in the web interface', val: webNotif,   set: setWebNotif }
          ].map((n,i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ fontSize: 13, color: TOKENS.text, fontWeight: 500 }}>{n.label}</div><div style={{ fontSize: 12, color: TOKENS.textMuted }}>{n.sub}</div></div>
              <button style={toggleStyle(n.val)} onClick={() => n.set(!n.val)}><div style={toggleKnob(n.val)}></div></button>
            </div>
          ))}
          {emailNotif && <InputField label="Email" value={email} onChange={setEmail} type="email" placeholder="admin@company.com" />}
          <SelectField label={t(lang,'notifThreshold')} value={notifThreshold} onChange={setNotifThreshold} options={[
            { value:'CRITICAL', label: lang==='zh'?'僅嚴重 (Critical)':'Critical only' },
            { value:'HIGH',     label: lang==='zh'?'高以上 (High+)':'High and above' },
            { value:'MEDIUM',   label: lang==='zh'?'中以上 (Medium+)':'Medium and above' },
            { value:'LOW',      label: lang==='zh'?'全部 (All)':'All severities' },
          ]} />
        </div>
      </Card>

      {/* ── Data Sources ── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: TOKENS.text }}>
            {DbIcon}<span>{lang === 'zh' ? '資料來源管理' : 'Data Source Management'}</span>
            <span style={{ fontSize: 11, color: TOKENS.textMuted, fontWeight: 400 }}>({sources.filter(s=>s.enabled).length}/{sources.length} {lang==='zh'?'啟用':'active'})</span>
          </div>
          <Btn icon={Icons.plus} onClick={() => setShowAddSource(!showAddSource)}>{lang === 'zh' ? '新增來源' : 'Add Source'}</Btn>
        </div>

        {/* Add Custom Source Form */}
        {showAddSource && (
          <div style={{ padding: 16, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.borderFocus}`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.primary, marginBottom: 12 }}>{lang === 'zh' ? '新增自訂來源' : 'Add Custom Source'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <InputField label={lang==='zh'?'來源名稱 *':'Source Name *'} value={newSource.name} onChange={v=>setNewSource({...newSource,name:v})} placeholder="e.g. Internal SIEM" />
              <InputField label={lang==='zh'?'說明':'Description'} value={newSource.desc} onChange={v=>setNewSource({...newSource,desc:v})} placeholder={lang==='zh'?'簡短說明...':'Brief description...'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <InputField label="Endpoint URL *" value={newSource.url} onChange={v=>setNewSource({...newSource,url:v})} placeholder="https://api.example.com/vulns" />
              <InputField label="API Key" value={newSource.apiKey} onChange={v=>setNewSource({...newSource,apiKey:v})} type="password" placeholder="選填" />
              <SelectField label={lang==='zh'?'同步頻率':'Sync Frequency'} value={newSource.syncFreq} onChange={v=>setNewSource({...newSource,syncFreq:v})} options={syncFreqOptions} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={()=>setShowAddSource(false)}>{lang==='zh'?'取消':'Cancel'}</Btn>
              <Btn variant="primary" onClick={handleAddSource} disabled={!newSource.name||!newSource.url}>{lang==='zh'?'新增':'Add'}</Btn>
            </div>
          </div>
        )}

        {/* Source List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sources.map(src => {
            const isExpanded = expandedSource === src.id;
            const st = statusInfo(src);
            const isTesting = testingId === src.id;
            const isSyncing = syncingId === src.id;
            const tr = testResult[src.id];

            return (
              <div key={src.id} style={{ border: `1px solid ${isExpanded ? TOKENS.borderFocus : TOKENS.border}`, borderRadius: TOKENS.radius, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                {/* Source Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: TOKENS.bgInput, cursor: 'pointer' }} onClick={() => setExpandedSource(isExpanded ? null : src.id)}>
                  {/* Type badge */}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: src.type === 'builtin' ? TOKENS.primaryDim : 'rgba(176,128,224,0.15)', color: src.type === 'builtin' ? TOKENS.primary : '#b080e0', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {src.type === 'builtin' ? (lang==='zh'?'內建':'Built-in') : (lang==='zh'?'自訂':'Custom')}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: src.enabled ? TOKENS.text : TOKENS.textMuted }}>{lang==='zh'?src.name:src.nameEn}</span>
                      <span style={{ fontSize: 11, color: st.color }}>{st.dot} {st.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lang==='zh'?src.desc:src.descEn}
                    </div>
                  </div>
                  {/* Last sync */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: TOKENS.textMuted }}>{lang==='zh'?'最後同步':'Last sync'}</div>
                    <div style={{ fontSize: 11, fontFamily: TOKENS.mono, color: TOKENS.text }}>{src.lastSync}</div>
                  </div>
                  {/* Sync freq badge */}
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: TOKENS.border, color: TOKENS.textSecondary, flexShrink: 0 }}>
                    {syncFreqOptions.find(o=>o.value===src.syncFreq)?.label || src.syncFreq}
                  </span>
                  {/* Toggle */}
                  <button onClick={e=>{ e.stopPropagation(); updateSource(src.id,{enabled:!src.enabled,syncStatus:src.enabled?'disabled':'pending'}); }}
                    style={toggleStyle(src.enabled)}><div style={toggleKnob(src.enabled)}></div></button>
                  {/* Expand arrow */}
                  <span style={{ color: TOKENS.textMuted, fontSize: 12, transform: isExpanded?'rotate(180deg)':'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>▾</span>
                </div>

                {/* Expanded Settings */}
                {isExpanded && (
                  <div style={{ padding: 16, background: TOKENS.bg, borderTop: `1px solid ${TOKENS.border}`, display: 'flex', flexDirection: 'column', gap: 14, animation: 'expandDown 0.2s ease' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: src.requiresKey ? '2fr 1fr' : '1fr', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>Endpoint URL</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input value={src.url} onChange={e=>updateSource(src.id,{url:e.target.value})} readOnly={src.type==='builtin'}
                            style={{ flex: 1, padding:'8px 12px', background: src.type==='builtin'?'rgba(255,255,255,0.03)':TOKENS.bgInput, border:`1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: src.type==='builtin'?TOKENS.textMuted:TOKENS.text, fontSize:12, fontFamily:TOKENS.mono, outline:'none' }} />
                          {src.type === 'custom' && (
                            <button onClick={()=>{}} style={{ padding:'8px 10px', background:TOKENS.border, border:'none', borderRadius:TOKENS.radiusSm, color:TOKENS.textSecondary, cursor:'pointer', fontSize:11 }}>
                              {lang==='zh'?'驗證':'Validate'}
                            </button>
                          )}
                        </div>
                      </div>
                      {src.requiresKey && (
                        <InputField label="API Key" value={src.apiKey} onChange={v=>updateSource(src.id,{apiKey:v})} type="password" placeholder={src.keyPlaceholder} />
                      )}
                    </div>

                    {/* Sync Frequency — full row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
                      <SelectField label={lang==='zh'?'自動同步頻率':'Auto Sync Frequency'} value={src.syncFreq} onChange={v=>updateSource(src.id,{syncFreq:v})} options={syncFreqOptions} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{lang==='zh'?'下次同步時間':'Next Sync'}</label>
                        <div style={{ padding:'8px 12px', background:'rgba(255,255,255,0.03)', border:`1px solid ${TOKENS.border}`, borderRadius:TOKENS.radiusSm, fontSize:12, fontFamily:TOKENS.mono, color: src.syncFreq==='manual'?TOKENS.textMuted:TOKENS.text }}>
                          {src.syncFreq === 'manual' ? (lang==='zh'?'手動觸發':'Manual trigger') : (src.enabled ? (lang==='zh'?'計算中...':'Calculating...') : (lang==='zh'?'已停用':'Disabled'))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={()=>handleTest(src)} disabled={isTesting}
                          style={{ flex:1, padding:'8px 10px', background: isTesting?TOKENS.border:TOKENS.bgInput, border:`1px solid ${tr==='ok'?TOKENS.low:tr==='fail'?TOKENS.danger:TOKENS.border}`, borderRadius:TOKENS.radiusSm, color: tr==='ok'?TOKENS.low:tr==='fail'?TOKENS.danger:TOKENS.textSecondary, fontSize:12, cursor:'pointer', fontFamily:TOKENS.font, transition:'all 0.15s' }}>
                          {isTesting ? (lang==='zh'?'測試中...':'Testing...') : tr==='ok' ? (lang==='zh'?'✓ 連線正常':'✓ Connected') : tr==='fail' ? (lang==='zh'?'✗ 連線失敗':'✗ Failed') : (lang==='zh'?'測試連線':'Test')}
                        </button>
                        <button onClick={()=>handleSync(src)} disabled={isSyncing||!src.enabled}
                          style={{ flex:1, padding:'8px 10px', background:TOKENS.primaryDim, border:`1px solid rgba(0,212,170,0.3)`, borderRadius:TOKENS.radiusSm, color:TOKENS.primary, fontSize:12, cursor:src.enabled?'pointer':'not-allowed', fontFamily:TOKENS.font, opacity:src.enabled?1:0.5 }}>
                          {isSyncing ? (lang==='zh'?'同步中...':'Syncing...') : (lang==='zh'?'立即同步':'Sync Now')}
                        </button>
                      </div>
                    </div>

                    {/* Delete custom source */}
                    {src.type === 'custom' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Btn variant="danger" icon={Icons.trash} onClick={()=>setSources(prev=>prev.filter(s=>s.id!==src.id))}>{lang==='zh'?'移除此來源':'Remove Source'}</Btn>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Global sync info */}
        <div style={{ marginTop: 14, padding: '10px 14px', background: TOKENS.bgInput, borderRadius: TOKENS.radiusSm, border:`1px solid ${TOKENS.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize: 12, color: TOKENS.textMuted }}>
            {lang==='zh' ? `${sources.filter(s=>s.enabled).length} 個來源啟用中 · 最近同步：2026-05-04 08:10` : `${sources.filter(s=>s.enabled).length} sources active · Last synced: 2026-05-04 08:10`}
          </div>
          <button onClick={()=>sources.filter(s=>s.enabled).forEach(s=>handleSync(s))}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', background:TOKENS.primaryDim, border:`1px solid rgba(0,212,170,0.3)`, borderRadius:TOKENS.radiusSm, color:TOKENS.primary, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:TOKENS.font }}>
            {Icons.refresh}{lang==='zh'?'全部同步':'Sync All'}
          </button>
        </div>
      </Card>

      {/* Save */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="primary" onClick={handleSave}>{saved ? (lang==='zh'?'✓ 已儲存':'✓ Saved') : t(lang,'save')}</Btn>
      </div>
    </div>
  );
}

window.SettingsPage = SettingsPage;
