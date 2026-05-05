import { useState, useEffect } from 'react';
import { TOKENS, t } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { settingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Card, Btn, InputField, SelectField } from '../components/ui';
import { Icons } from '../components/Icons';

export function SettingsPage({ onNavigate }) {
  const { lang } = useLang();
  const { can } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(false);

  const [aiProvider,   setAiProvider]   = useState('claude');
  const [aiModel,      setAiModel]      = useState('claude-sonnet-4');
  const [authMethod,   setAuthMethod]   = useState('webauth');
  const [apiKey,       setApiKey]       = useState('');
  const [emailNotif,   setEmailNotif]   = useState(true);
  const [webNotif,     setWebNotif]     = useState(true);
  const [notifThresh,  setNotifThresh]  = useState('HIGH');
  const [email,        setEmail]        = useState('admin@example.com');
  const [sources,      setSources]      = useState([]);
  const [expandedSrc,  setExpandedSrc]  = useState(null);
  const [testingId,    setTestingId]    = useState(null);
  const [testResult,   setTestResult]   = useState({});
  const [syncingId,    setSyncingId]    = useState(null);
  const [syncResult,   setSyncResult]   = useState({});
  const [showAddSrc,   setShowAddSrc]   = useState(false);
  const [newSrc,       setNewSrc]       = useState({ name: '', desc: '', url: '', apiKey: '', syncFreq: '24h' });

  useEffect(() => {
    settingsApi.get().then(res => {
      const d = res.data;
      if (d.ai_provider)     setAiProvider(d.ai_provider);
      if (d.ai_model)        setAiModel(d.ai_model);
      if (d.ai_auth_method)  setAuthMethod(d.ai_auth_method);
      if (d.ai_api_key)      setApiKey(d.ai_api_key || '');
      if (d.notif_email !== undefined) setEmailNotif(d.notif_email);
      if (d.notif_web   !== undefined) setWebNotif(d.notif_web);
      if (d.notif_threshold)   setNotifThresh(d.notif_threshold);
      if (d.notif_email_addr)  setEmail(d.notif_email_addr);
      if (d.data_sources)      setSources(d.data_sources);
    }).finally(() => setLoading(false));
  }, []);

  const providerModels = {
    claude:  [{ value: 'claude-sonnet-4', label: 'Claude Sonnet 4' }, { value: 'claude-opus-4', label: 'Claude Opus 4' }, { value: 'claude-haiku-3.5', label: 'Claude 3.5 Haiku' }],
    gemini:  [{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }, { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }],
    chatgpt: [{ value: 'gpt-4.1', label: 'GPT-4.1' }, { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' }, { value: 'o3', label: 'o3' }],
    openai:  [{ value: 'gpt-4.1', label: 'GPT-4.1' }, { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' }, { value: 'o3', label: 'o3' }],
  };

  const updateSource = (id, updates) => setSources(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

  const handleTest = async (src) => {
    setTestingId(src.id); setTestResult(prev => ({ ...prev, [src.id]: null }));
    try {
      await settingsApi.testSource(src.id);
      setTestResult(prev => ({ ...prev, [src.id]: 'ok' }));
    } catch {
      setTestResult(prev => ({ ...prev, [src.id]: 'fail' }));
    } finally {
      setTestingId(null);
    }
  };

  const handleSync = async (src) => {
    setSyncingId(src.id);
    setSyncResult(prev => ({ ...prev, [src.id]: null }));
    try {
      const res = await settingsApi.syncSource(src.id);
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      updateSource(src.id, { lastSync: now, syncStatus: 'ok' });
      setSyncResult(prev => ({ ...prev, [src.id]: { inserted: res.data.inserted, updated: res.data.updated } }));
    } catch (err) {
      updateSource(src.id, { syncStatus: 'fail' });
      const msg = err.response?.data?.error || (lang === 'zh' ? '同步失敗' : 'Sync failed');
      setSyncResult(prev => ({ ...prev, [src.id]: { error: msg } }));
    } finally {
      setSyncingId(null);
    }
  };

  const handleAddSrc = () => {
    if (!newSrc.name || !newSrc.url) return;
    setSources(prev => [...prev, { id: 'custom_' + Date.now(), name: newSrc.name, nameEn: newSrc.name, desc: newSrc.desc, descEn: newSrc.desc, type: 'custom', url: newSrc.url, apiKey: newSrc.apiKey, requiresKey: !!newSrc.apiKey, enabled: true, lastSync: '—', syncStatus: 'pending', syncFreq: newSrc.syncFreq }]);
    setNewSrc({ name: '', desc: '', url: '', apiKey: '', syncFreq: '24h' }); setShowAddSrc(false);
  };

  const handleSave = async () => {
    await settingsApi.update({ ai_provider: aiProvider, ai_model: aiModel, ai_auth_method: authMethod, ai_api_key: apiKey || null, notif_email: emailNotif, notif_web: webNotif, notif_threshold: notifThresh, notif_email_addr: email, data_sources: sources });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const toggleStyle = (on) => ({ width: 40, height: 22, borderRadius: 11, background: on ? TOKENS.primary : TOKENS.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', border: 'none', padding: 0, flexShrink: 0 });
  const toggleKnob  = (on) => ({ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' });

  const syncFreqOptions = [
    { value: '1h',     label: lang === 'zh' ? '每 1 小時'  : 'Every 1 hour' },
    { value: '3h',     label: lang === 'zh' ? '每 3 小時'  : 'Every 3 hours' },
    { value: '6h',     label: lang === 'zh' ? '每 6 小時'  : 'Every 6 hours' },
    { value: '12h',    label: lang === 'zh' ? '每 12 小時' : 'Every 12 hours' },
    { value: '24h',    label: lang === 'zh' ? '每天'        : 'Daily' },
    { value: '168h',   label: lang === 'zh' ? '每週'        : 'Weekly' },
    { value: 'manual', label: lang === 'zh' ? '手動同步'    : 'Manual only' },
  ];

  const statusInfo = (s) => {
    if (!s.enabled) return { color: TOKENS.textMuted, label: lang === 'zh' ? '已停用' : 'Disabled', dot: '○' };
    if (s.syncStatus === 'ok')      return { color: TOKENS.low,    label: lang === 'zh' ? '正常'     : 'OK',     dot: '●' };
    if (s.syncStatus === 'fail')    return { color: TOKENS.danger,  label: lang === 'zh' ? '連線失敗' : 'Failed', dot: '●' };
    if (s.syncStatus === 'pending') return { color: TOKENS.warning, label: lang === 'zh' ? '待同步'   : 'Pending',dot: '●' };
    return { color: TOKENS.textMuted, label: '—', dot: '○' };
  };

  if (loading) return (
    <div style={{ padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${TOKENS.border}`, borderTop: `3px solid ${TOKENS.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>
      {/* AI Provider */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>{Icons.ai}<span>{t(lang, 'aiProvider')}</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[{ value: 'claude', label: 'Claude (Anthropic)' }, { value: 'gemini', label: 'Gemini (Google)' }, { value: 'chatgpt', label: 'ChatGPT (OpenAI)' }, { value: 'openai', label: 'OpenAI API' }].map(p => (
              <button key={p.value} onClick={() => { setAiProvider(p.value); setAuthMethod(p.value === 'claude' ? 'webauth' : 'apikey'); const m = providerModels[p.value]; if (m) setAiModel(m[0].value); }}
                style={{ padding: '14px 12px', background: aiProvider === p.value ? TOKENS.primaryDim : TOKENS.bgInput, border: `1px solid ${aiProvider === p.value ? TOKENS.primary : TOKENS.border}`, borderRadius: TOKENS.radius, cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: aiProvider === p.value ? TOKENS.primary : TOKENS.text }}>{p.label}</div>
                {aiProvider === p.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: TOKENS.primary, margin: '6px auto 0' }} />}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SelectField label={t(lang, 'aiModel')} value={aiModel} onChange={setAiModel} options={providerModels[aiProvider] || []} />
            {aiProvider === 'claude' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{t(lang, 'authMethod')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['webauth', t(lang, 'webAuth')], ['apikey', t(lang, 'apiKeyAuth')]].map(([m, ml]) => (
                    <button key={m} onClick={() => setAuthMethod(m)} style={{ flex: 1, padding: '8px 12px', background: authMethod === m ? TOKENS.primaryDim : TOKENS.bgInput, border: `1px solid ${authMethod === m ? TOKENS.primary : TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: authMethod === m ? TOKENS.primary : TOKENS.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: TOKENS.font }}>
                      {ml}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <InputField label={t(lang, 'apiKey')} value={apiKey} onChange={setApiKey} type="password" placeholder="sk-..." />
            )}
          </div>
          {aiProvider === 'claude' && authMethod === 'apikey' && (
            <InputField label={t(lang, 'apiKey')} value={apiKey} onChange={setApiKey} type="password" placeholder="sk-ant-..." />
          )}
          {aiProvider === 'claude' && authMethod === 'webauth' && (
            <div style={{ padding: 12, background: TOKENS.primaryDim, borderRadius: TOKENS.radiusSm, border: `1px solid rgba(0,212,170,0.2)` }}>
              <div style={{ fontSize: 12, color: TOKENS.primary, marginBottom: 6, fontWeight: 600 }}>{lang === 'zh' ? '網頁認證模式' : 'Web Auth Mode'}</div>
              <div style={{ fontSize: 12, color: TOKENS.textSecondary }}>{lang === 'zh' ? '透過 OAuth 流程取得授權，無需 API Key。' : 'Authorize via OAuth — no API Key required.'}</div>
            </div>
          )}
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>{Icons.bell}<span>{t(lang, 'notifications')}</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[{ label: t(lang, 'emailNotif'), sub: lang === 'zh' ? '新弱點發佈時寄送 Email' : 'Send email on new vulnerability', val: emailNotif, set: setEmailNotif },
            { label: t(lang, 'webNotif'),   sub: lang === 'zh' ? '在網頁介面顯示通知' : 'Show alerts in the web interface',   val: webNotif,   set: setWebNotif }
          ].map((n, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ fontSize: 13, color: TOKENS.text, fontWeight: 500 }}>{n.label}</div><div style={{ fontSize: 12, color: TOKENS.textMuted }}>{n.sub}</div></div>
              <button style={toggleStyle(n.val)} onClick={() => n.set(!n.val)}><div style={toggleKnob(n.val)} /></button>
            </div>
          ))}
          {emailNotif && <InputField label="Email" value={email} onChange={setEmail} type="email" placeholder="admin@company.com" />}
          <SelectField label={t(lang, 'notifThreshold')} value={notifThresh} onChange={setNotifThresh} options={[
            { value: 'CRITICAL', label: lang === 'zh' ? '僅嚴重 (Critical)' : 'Critical only' },
            { value: 'HIGH',     label: lang === 'zh' ? '高以上 (High+)'    : 'High and above' },
            { value: 'MEDIUM',   label: lang === 'zh' ? '中以上 (Medium+)'  : 'Medium and above' },
            { value: 'LOW',      label: lang === 'zh' ? '全部 (All)'        : 'All severities' },
          ]} />
        </div>
      </Card>

      {/* Data Sources */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="10" cy="5" rx="8" ry="3"/><path d="M2 5v5c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M2 10v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5"/></svg>
            <span>{lang === 'zh' ? '資料來源管理' : 'Data Source Management'}</span>
            <span style={{ fontSize: 11, color: TOKENS.textMuted, fontWeight: 400 }}>({sources.filter(s => s.enabled).length}/{sources.length} {lang === 'zh' ? '啟用' : 'active'})</span>
          </div>
          <Btn icon={Icons.plus} onClick={() => setShowAddSrc(!showAddSrc)}>{lang === 'zh' ? '新增來源' : 'Add Source'}</Btn>
        </div>

        {showAddSrc && (
          <div style={{ padding: 16, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.borderFocus}`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.primary, marginBottom: 12 }}>{lang === 'zh' ? '新增自訂來源' : 'Add Custom Source'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <InputField label={lang === 'zh' ? '來源名稱 *' : 'Source Name *'} value={newSrc.name} onChange={v => setNewSrc({ ...newSrc, name: v })} placeholder="e.g. Internal SIEM" />
              <InputField label={lang === 'zh' ? '說明' : 'Description'} value={newSrc.desc} onChange={v => setNewSrc({ ...newSrc, desc: v })} placeholder={lang === 'zh' ? '簡短說明...' : 'Brief description...'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <InputField label="Endpoint URL *" value={newSrc.url} onChange={v => setNewSrc({ ...newSrc, url: v })} placeholder="https://api.example.com/vulns" />
              <InputField label="API Key" value={newSrc.apiKey} onChange={v => setNewSrc({ ...newSrc, apiKey: v })} type="password" placeholder={lang === 'zh' ? '選填' : 'Optional'} />
              <SelectField label={lang === 'zh' ? '同步頻率' : 'Sync Frequency'} value={newSrc.syncFreq} onChange={v => setNewSrc({ ...newSrc, syncFreq: v })} options={syncFreqOptions} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShowAddSrc(false)}>{lang === 'zh' ? '取消' : 'Cancel'}</Btn>
              <Btn variant="primary" onClick={handleAddSrc} disabled={!newSrc.name || !newSrc.url}>{lang === 'zh' ? '新增' : 'Add'}</Btn>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sources.map(src => {
            const isExp     = expandedSrc === src.id;
            const st        = statusInfo(src);
            const isTesting = testingId  === src.id;
            const isSyncing = syncingId  === src.id;
            const tr        = testResult[src.id];
            return (
              <div key={src.id} style={{ border: `1px solid ${isExp ? TOKENS.borderFocus : TOKENS.border}`, borderRadius: TOKENS.radius, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: TOKENS.bgInput, cursor: 'pointer' }} onClick={() => setExpandedSrc(isExp ? null : src.id)}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: src.type === 'builtin' ? TOKENS.primaryDim : 'rgba(176,128,224,0.15)', color: src.type === 'builtin' ? TOKENS.primary : '#b080e0', textTransform: 'uppercase', flexShrink: 0 }}>
                    {src.type === 'builtin' ? (lang === 'zh' ? '內建' : 'Built-in') : (lang === 'zh' ? '自訂' : 'Custom')}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: src.enabled ? TOKENS.text : TOKENS.textMuted }}>{lang === 'zh' ? src.name : src.nameEn}</span>
                      <span style={{ fontSize: 11, color: st.color }}>{st.dot} {st.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lang === 'zh' ? src.desc : src.descEn}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: TOKENS.textMuted }}>{lang === 'zh' ? '最後同步' : 'Last sync'}</div>
                    <div style={{ fontSize: 11, fontFamily: TOKENS.mono, color: TOKENS.text }}>{src.lastSync}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: TOKENS.border, color: TOKENS.textSecondary, flexShrink: 0 }}>
                    {syncFreqOptions.find(o => o.value === src.syncFreq)?.label || src.syncFreq}
                  </span>
                  <button onClick={e => { e.stopPropagation(); updateSource(src.id, { enabled: !src.enabled, syncStatus: src.enabled ? 'disabled' : 'pending' }); }} style={toggleStyle(src.enabled)}><div style={toggleKnob(src.enabled)} /></button>
                  <span style={{ color: TOKENS.textMuted, fontSize: 12, transform: isExp ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>▾</span>
                </div>
                {isExp && (
                  <div style={{ padding: 16, background: TOKENS.bg, borderTop: `1px solid ${TOKENS.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: src.requiresKey ? '2fr 1fr' : '1fr', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>Endpoint URL</label>
                        <input value={src.url} onChange={e => updateSource(src.id, { url: e.target.value })} readOnly={src.type === 'builtin'}
                          style={{ flex: 1, padding: '8px 12px', background: src.type === 'builtin' ? 'rgba(255,255,255,0.03)' : TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: src.type === 'builtin' ? TOKENS.textMuted : TOKENS.text, fontSize: 12, fontFamily: TOKENS.mono, outline: 'none' }} />
                      </div>
                      {src.requiresKey && <InputField label="API Key" value={src.apiKey} onChange={v => updateSource(src.id, { apiKey: v })} type="password" placeholder={src.keyPlaceholder} />}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
                      <SelectField label={lang === 'zh' ? '自動同步頻率' : 'Auto Sync Frequency'} value={src.syncFreq} onChange={v => updateSource(src.id, { syncFreq: v })} options={syncFreqOptions} />
                      <div />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleTest(src)} disabled={isTesting}
                          style={{ flex: 1, padding: '8px 10px', background: isTesting ? TOKENS.border : TOKENS.bgInput, border: `1px solid ${tr === 'ok' ? TOKENS.low : tr === 'fail' ? TOKENS.danger : TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: tr === 'ok' ? TOKENS.low : tr === 'fail' ? TOKENS.danger : TOKENS.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: TOKENS.font }}>
                          {isTesting ? (lang === 'zh' ? '測試中...' : 'Testing...') : tr === 'ok' ? (lang === 'zh' ? '✓ 連線正常' : '✓ Connected') : tr === 'fail' ? (lang === 'zh' ? '✗ 失敗' : '✗ Failed') : (lang === 'zh' ? '測試連線' : 'Test')}
                        </button>
                        <button onClick={() => handleSync(src)} disabled={isSyncing || !src.enabled}
                          style={{ flex: 1, padding: '8px 10px', background: TOKENS.primaryDim, border: `1px solid rgba(0,212,170,0.3)`, borderRadius: TOKENS.radiusSm, color: TOKENS.primary, fontSize: 12, cursor: src.enabled ? 'pointer' : 'not-allowed', fontFamily: TOKENS.font, opacity: src.enabled ? 1 : 0.5 }}>
                          {isSyncing ? (lang === 'zh' ? '同步中...' : 'Syncing...') : (lang === 'zh' ? '立即同步' : 'Sync Now')}
                        </button>
                      </div>
                    </div>
                    {syncResult[src.id] && (
                      <div style={{ padding: '10px 14px', borderRadius: TOKENS.radiusSm, background: syncResult[src.id].error ? TOKENS.dangerDim : TOKENS.primaryDim, border: `1px solid ${syncResult[src.id].error ? TOKENS.danger + '40' : 'rgba(0,212,170,0.25)'}`, fontSize: 12 }}>
                        {syncResult[src.id].error ? (
                          <span style={{ color: TOKENS.danger }}>✗ {syncResult[src.id].error}</span>
                        ) : (
                          <span style={{ color: TOKENS.primary }}>
                            ✓ {lang === 'zh'
                              ? `同步完成 — 新增 ${syncResult[src.id].inserted} 筆，更新 ${syncResult[src.id].updated} 筆`
                              : `Sync complete — ${syncResult[src.id].inserted} new, ${syncResult[src.id].updated} updated`}
                            {(syncResult[src.id].inserted > 0 || syncResult[src.id].updated > 0) && onNavigate && (
                              <button onClick={() => onNavigate('search')}
                                style={{ marginLeft: 12, background: 'none', border: 'none', color: TOKENS.primary, cursor: 'pointer', fontSize: 12, fontFamily: TOKENS.font, textDecoration: 'underline', padding: 0 }}>
                                {lang === 'zh' ? '前往查看 →' : 'View results →'}
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                    {src.type === 'custom' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Btn variant="danger" icon={Icons.trash} onClick={() => setSources(prev => prev.filter(s => s.id !== src.id))}>{lang === 'zh' ? '移除此來源' : 'Remove Source'}</Btn>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="primary" onClick={handleSave}>{saved ? (lang === 'zh' ? '✓ 已儲存' : '✓ Saved') : t(lang, 'save')}</Btn>
      </div>
    </div>
  );
}
