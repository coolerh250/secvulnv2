import { useState, useEffect } from 'react';
import { TOKENS, t } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { settingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Card, Btn, InputField, SelectField } from '../components/ui';
import { Icons } from '../components/Icons';

function formatSync(ts) {
  if (!ts || ts === '—') return '—';
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  return d.toLocaleString('zh-TW', { hour12: false }).slice(0, 16);
}

export function SettingsPage({ onNavigate }) {
  const { lang } = useLang();
  const { can } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(false);

  const [aiProvider,   setAiProvider]   = useState('claude');
  const [aiModel,      setAiModel]      = useState('claude-sonnet-4-6');
  const [authMethod,   setAuthMethod]   = useState('webauth');
  const [apiKey,       setApiKey]       = useState('');
  const [aiBaseUrl,    setAiBaseUrl]    = useState('');
  const [emailNotif,   setEmailNotif]   = useState(true);
  const [webNotif,     setWebNotif]     = useState(true);
  const [notifThresh,  setNotifThresh]  = useState('HIGH');
  const [email,        setEmail]        = useState('admin@example.com');
  const [smtpHost,     setSmtpHost]     = useState('');
  const [smtpPort,     setSmtpPort]     = useState(587);
  const [smtpUser,     setSmtpUser]     = useState('');
  const [smtpPass,     setSmtpPass]     = useState('');
  const [smtpFrom,     setSmtpFrom]     = useState('');
  const [webhookUrl,   setWebhookUrl]   = useState('');
  const [webhookType,  setWebhookType]  = useState('teams');
  const [webhookToken, setWebhookToken] = useState('');
  const [testingEmail,   setTestingEmail]   = useState(false);
  const [testEmailRes,   setTestEmailRes]   = useState(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testWebhookRes, setTestWebhookRes] = useState(null);
  const [sources,      setSources]      = useState([]);
  const [expandedSrc,  setExpandedSrc]  = useState(null);
  const [testingId,    setTestingId]    = useState(null);
  const [testResult,   setTestResult]   = useState({});
  const [syncingId,    setSyncingId]    = useState(null);
  const [syncResult,   setSyncResult]   = useState({});
  const [showAddSrc,   setShowAddSrc]   = useState(false);
  const [newSrc,       setNewSrc]       = useState({ name: '', desc: '', url: '', apiKey: '', syncFreq: '24h' });
  const [logRetentionDays, setLogRetentionDays] = useState(90);
  const [slaPolicy, setSlaPolicy] = useState({ CRITICAL: 7, HIGH: 30, MEDIUM: 90, LOW: 180 });

  useEffect(() => {
    settingsApi.get().then(res => {
      const d = res.data;
      if (d.ai_provider)     setAiProvider(d.ai_provider);
      if (d.ai_model)        setAiModel(d.ai_model);
      if (d.ai_auth_method)  setAuthMethod(d.ai_auth_method);
      if (d.ai_api_key)      setApiKey(d.ai_api_key || '');
      if (d.ai_base_url)     setAiBaseUrl(d.ai_base_url || '');
      if (d.notif_email !== undefined) setEmailNotif(d.notif_email);
      if (d.notif_web   !== undefined) setWebNotif(d.notif_web);
      if (d.notif_threshold)    setNotifThresh(d.notif_threshold);
      if (d.notif_email_addr)   setEmail(d.notif_email_addr);
      if (d.notif_smtp_host)    setSmtpHost(d.notif_smtp_host);
      if (d.notif_smtp_port)    setSmtpPort(d.notif_smtp_port);
      if (d.notif_smtp_user)    setSmtpUser(d.notif_smtp_user);
      if (d.notif_smtp_pass)    setSmtpPass(d.notif_smtp_pass);
      if (d.notif_smtp_from)    setSmtpFrom(d.notif_smtp_from);
      if (d.notif_webhook_url)  setWebhookUrl(d.notif_webhook_url);
      if (d.notif_webhook_type) setWebhookType(d.notif_webhook_type);
      if (d.notif_webhook_token) setWebhookToken(d.notif_webhook_token);
      if (d.data_sources)       setSources(d.data_sources);
      if (d.log_retention_days) setLogRetentionDays(d.log_retention_days);
      if (d.sla_policy)         setSlaPolicy(d.sla_policy);
    }).finally(() => setLoading(false));
  }, []);

  const providerModels = {
    claude:  [{ value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' }, { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' }, { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' }],
    gemini:  [{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }, { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }],
    chatgpt: [{ value: 'gpt-4.1', label: 'GPT-4.1' }, { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' }, { value: 'o3', label: 'o3' }],
    local:   [],
  };

  const LOCAL_PLATFORMS = [
    { label: 'Ollama', url: 'http://localhost:11434/v1', model: 'llama3.2', hint: 'ollama run llama3.2' },
    { label: 'vLLM',   url: 'http://localhost:8000/v1',  model: 'meta-llama/Llama-3.2-3B-Instruct', hint: 'vllm serve <model>' },
  ];

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
      updateSource(src.id, { lastSync: new Date().toISOString(), syncStatus: 'ok' });
      setSyncResult(prev => ({ ...prev, [src.id]: { inserted: res.data.inserted, updated: res.data.updated, removed: res.data.removed } }));
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

  const makeTestHandler = (apiFn, setTesting, setResult) => async () => {
    setTesting(true); setResult(null);
    try {
      const res = await apiFn();
      setResult(res.data.ok ? 'ok' : res.data.error || 'fail');
    } catch (err) {
      setResult(err.response?.data?.error || 'fail');
    } finally {
      setTesting(false);
    }
  };
  const handleTestEmail   = makeTestHandler(settingsApi.testEmail,   setTestingEmail,   setTestEmailRes);
  const handleTestWebhook = makeTestHandler(settingsApi.testWebhook, setTestingWebhook, setTestWebhookRes);

  const handleSave = async () => {
    await settingsApi.update({
      ai_provider: aiProvider, ai_model: aiModel, ai_auth_method: authMethod,
      ai_api_key: apiKey || null, ai_base_url: aiBaseUrl || null,
      notif_email: emailNotif, notif_web: webNotif, notif_threshold: notifThresh,
      notif_email_addr: email,
      notif_smtp_host: smtpHost || null, notif_smtp_port: smtpPort || null,
      notif_smtp_user: smtpUser || null, notif_smtp_pass: smtpPass || null,
      notif_smtp_from: smtpFrom || null,
      notif_webhook_url: webhookUrl || null, notif_webhook_type: webhookType || null,
      notif_webhook_token: webhookToken || null,
      data_sources: sources,
      log_retention_days: logRetentionDays,
      sla_policy: slaPolicy,
    });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const toggleStyle   = (on) => ({ width: 40, height: 22, borderRadius: 11, background: on ? TOKENS.primary : TOKENS.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', border: 'none', padding: 0, flexShrink: 0 });
  const toggleKnob    = (on) => ({ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' });
  const testBtnStyle  = (testing, result) => ({ padding: '7px 16px', background: testing ? TOKENS.border : TOKENS.bgInput, border: `1px solid ${result === 'ok' ? TOKENS.low : result ? TOKENS.danger : TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: result === 'ok' ? TOKENS.low : result ? TOKENS.danger : TOKENS.textSecondary, fontSize: 12, cursor: testing ? 'not-allowed' : 'pointer', fontFamily: TOKENS.font });

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
            {[
              { value: 'claude',  label: 'Claude',  sub: 'Anthropic' },
              { value: 'gemini',  label: 'Gemini',  sub: 'Google' },
              { value: 'chatgpt', label: 'ChatGPT', sub: 'OpenAI' },
              { value: 'local',   label: lang === 'zh' ? '本地模型' : 'Local Model', sub: 'Ollama / vLLM' },
            ].map(p => (
              <button key={p.value} onClick={() => {
                setAiProvider(p.value);
                setAuthMethod(p.value === 'claude' ? 'webauth' : 'apikey');
                const m = providerModels[p.value];
                if (m?.length) setAiModel(m[0].value);
                else if (p.value === 'local') setAiModel('llama3.2');
              }}
                style={{ padding: '14px 12px', background: aiProvider === p.value ? TOKENS.primaryDim : TOKENS.bgInput, border: `1px solid ${aiProvider === p.value ? TOKENS.primary : TOKENS.border}`, borderRadius: TOKENS.radius, cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: aiProvider === p.value ? TOKENS.primary : TOKENS.text }}>{p.label}</div>
                <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 3 }}>{p.sub}</div>
                {aiProvider === p.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: TOKENS.primary, margin: '6px auto 0' }} />}
              </button>
            ))}
          </div>

          {/* Cloud provider model + auth */}
          {aiProvider !== 'local' && (
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
          )}
          {aiProvider === 'claude' && authMethod === 'apikey' && (
            <InputField label={t(lang, 'apiKey')} value={apiKey} onChange={setApiKey} type="password" placeholder="sk-ant-..." />
          )}
          {aiProvider === 'claude' && authMethod === 'webauth' && (
            <div style={{ padding: 12, background: TOKENS.primaryDim, borderRadius: TOKENS.radiusSm, border: `1px solid rgba(0,212,170,0.2)` }}>
              <div style={{ fontSize: 12, color: TOKENS.primary, marginBottom: 6, fontWeight: 600 }}>{lang === 'zh' ? '網頁認證模式' : 'Web Auth Mode'}</div>
              <div style={{ fontSize: 12, color: TOKENS.textSecondary }}>{lang === 'zh' ? '透過 OAuth 流程取得授權，無需 API Key。' : 'Authorize via OAuth — no API Key required.'}</div>
            </div>
          )}

          {/* Local model configuration */}
          {aiProvider === 'local' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500, marginBottom: 8 }}>{lang === 'zh' ? '快速設定平台' : 'Quick Setup'}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {LOCAL_PLATFORMS.map(p => (
                    <button key={p.label} onClick={() => { setAiBaseUrl(p.url); setAiModel(p.model); }}
                      style={{ padding: '8px 18px', background: aiBaseUrl === p.url ? TOKENS.primaryDim : TOKENS.bgInput, border: `1px solid ${aiBaseUrl === p.url ? TOKENS.primary : TOKENS.border}`, borderRadius: TOKENS.radiusSm, cursor: 'pointer', color: aiBaseUrl === p.url ? TOKENS.primary : TOKENS.text, fontSize: 13, fontWeight: 600, fontFamily: TOKENS.font }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <InputField label="API Base URL *" value={aiBaseUrl} onChange={setAiBaseUrl} placeholder="http://localhost:11434/v1" />
                <InputField label={lang === 'zh' ? '模型名稱 *' : 'Model Name *'} value={aiModel} onChange={setAiModel} placeholder="llama3.2" />
              </div>
              <InputField label={lang === 'zh' ? 'API Key（vLLM 需要，Ollama 留空）' : 'API Key (required for vLLM, leave blank for Ollama)'} value={apiKey} onChange={setApiKey} type="password" placeholder={lang === 'zh' ? '選填' : 'optional'} />
              <div style={{ padding: 12, background: TOKENS.bg, borderRadius: TOKENS.radiusSm, border: `1px solid ${TOKENS.border}` }}>
                <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>{lang === 'zh' ? '啟動指令參考' : 'Startup Commands'}</div>
                {LOCAL_PLATFORMS.map(p => (
                  <div key={p.label} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: TOKENS.primary, fontWeight: 600, minWidth: 36 }}>{p.label}</span>
                    <code style={{ fontSize: 11, fontFamily: TOKENS.mono, color: TOKENS.textSecondary, background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 3 }}>{p.hint}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>{Icons.bell}<span>{t(lang, 'notifications')}</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Email */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: emailNotif ? 14 : 0 }}>
              <div>
                <div style={{ fontSize: 13, color: TOKENS.text, fontWeight: 500 }}>{t(lang, 'emailNotif')}</div>
                <div style={{ fontSize: 12, color: TOKENS.textMuted }}>{lang === 'zh' ? '每次同步偵測到新弱點時寄送摘要 Email' : 'Send digest email when new vulnerabilities are found'}</div>
              </div>
              <button style={toggleStyle(emailNotif)} onClick={() => setEmailNotif(!emailNotif)}><div style={toggleKnob(emailNotif)} /></button>
            </div>
            {emailNotif && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
                <InputField label={lang === 'zh' ? '收件 Email *' : 'Recipient Email *'} value={email} onChange={setEmail} type="email" placeholder="admin@company.com" />
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <InputField label={lang === 'zh' ? 'SMTP 主機 *' : 'SMTP Host *'} value={smtpHost} onChange={setSmtpHost} placeholder="smtp.gmail.com" />
                  <InputField label="Port" value={String(smtpPort)} onChange={v => setSmtpPort(Number(v) || 587)} placeholder="587" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InputField label={lang === 'zh' ? 'SMTP 帳號 *' : 'SMTP Username *'} value={smtpUser} onChange={setSmtpUser} placeholder="you@example.com" />
                  <InputField label={lang === 'zh' ? 'SMTP 密碼 *' : 'SMTP Password *'} value={smtpPass} onChange={setSmtpPass} type="password" />
                </div>
                <InputField label={lang === 'zh' ? '寄件人（選填）' : 'From Address (optional)'} value={smtpFrom} onChange={setSmtpFrom} placeholder='SecVuln <no-reply@example.com>' />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={handleTestEmail} disabled={testingEmail}
                    style={testBtnStyle(testingEmail, testEmailRes)}>
                    {testingEmail ? (lang === 'zh' ? '傳送中...' : 'Sending...') : (lang === 'zh' ? '測試寄送' : 'Send Test')}
                  </button>
                  {testEmailRes === 'ok' && <span style={{ fontSize: 12, color: TOKENS.low }}>✓ {lang === 'zh' ? '測試郵件已寄出' : 'Test email sent'}</span>}
                  {testEmailRes && testEmailRes !== 'ok' && <span style={{ fontSize: 12, color: TOKENS.danger }}>✗ {testEmailRes}</span>}
                </div>
              </div>
            )}
          </div>

          {/* Webhook */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: webNotif ? 14 : 0 }}>
              <div>
                <div style={{ fontSize: 13, color: TOKENS.text, fontWeight: 500 }}>{lang === 'zh' ? 'Webhook 通知' : 'Webhook Notification'}</div>
                <div style={{ fontSize: 12, color: TOKENS.textMuted }}>{lang === 'zh' ? '傳送通知至 Teams、Slack、Line Notify 等' : 'Send alerts to Teams, Slack, Line Notify, etc.'}</div>
              </div>
              <button style={toggleStyle(webNotif)} onClick={() => setWebNotif(!webNotif)}><div style={toggleKnob(webNotif)} /></button>
            </div>
            {webNotif && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
                <SelectField label={lang === 'zh' ? '平台' : 'Platform'} value={webhookType} onChange={v => { setWebhookType(v); if (v === 'line') setWebhookUrl('https://notify-api.line.me/api/notify'); }} options={[
                  { value: 'teams',   label: 'Microsoft Teams' },
                  { value: 'slack',   label: 'Slack' },
                  { value: 'line',    label: 'Line Notify' },
                  { value: 'generic', label: 'Generic JSON' },
                ]} />
                <InputField label="Webhook URL *" value={webhookUrl} onChange={setWebhookUrl}
                  placeholder={webhookType === 'teams' ? 'https://outlook.office.com/webhook/...' : webhookType === 'slack' ? 'https://hooks.slack.com/services/...' : webhookType === 'line' ? 'https://notify-api.line.me/api/notify' : 'https://...'} />
                {webhookType === 'line' && (
                  <InputField label="Line Notify Token *" value={webhookToken} onChange={setWebhookToken} type="password" placeholder="your-line-notify-token" />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={handleTestWebhook} disabled={testingWebhook}
                    style={testBtnStyle(testingWebhook, testWebhookRes)}>
                    {testingWebhook ? (lang === 'zh' ? '傳送中...' : 'Sending...') : (lang === 'zh' ? '測試傳送' : 'Send Test')}
                  </button>
                  {testWebhookRes === 'ok' && <span style={{ fontSize: 12, color: TOKENS.low }}>✓ {lang === 'zh' ? 'Webhook 傳送成功' : 'Webhook delivered'}</span>}
                  {testWebhookRes && testWebhookRes !== 'ok' && <span style={{ fontSize: 12, color: TOKENS.danger }}>✗ {testWebhookRes}</span>}
                </div>
              </div>
            )}
          </div>

          {/* Threshold (shared) */}
          <SelectField label={t(lang, 'notifThreshold')} value={notifThresh} onChange={setNotifThresh} options={[
            { value: 'CRITICAL', label: lang === 'zh' ? '僅嚴重 (Critical)' : 'Critical only' },
            { value: 'HIGH',     label: lang === 'zh' ? '高以上 (High+)'    : 'High and above' },
            { value: 'MEDIUM',   label: lang === 'zh' ? '中以上 (Medium+)'  : 'Medium and above' },
            { value: 'LOW',      label: lang === 'zh' ? '全部 (All)'        : 'All severities' },
          ]} />
        </div>
      </Card>

      {/* SLA Policy */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8"/><polyline points="10 6 10 10 13 13"/></svg>
          <span>{lang === 'zh' ? 'SLA 修補期限政策' : 'SLA Remediation Policy'}</span>
        </div>
        <div style={{ fontSize: 12, color: TOKENS.textMuted, marginBottom: 16 }}>
          {lang === 'zh'
            ? '系統會依此政策自動為新漏洞設定修補期限（due_date）。已手動設定期限的漏洞不受影響。'
            : 'The system will auto-set due dates for new vulnerabilities based on this policy. Manually set due dates are not overwritten.'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          {[
            { key: 'CRITICAL', label: lang === 'zh' ? '嚴重 (Critical)' : 'Critical',  color: TOKENS.danger },
            { key: 'HIGH',     label: lang === 'zh' ? '高危 (High)'     : 'High',      color: TOKENS.warning },
            { key: 'MEDIUM',   label: lang === 'zh' ? '中危 (Medium)'   : 'Medium',    color: TOKENS.medium },
            { key: 'LOW',      label: lang === 'zh' ? '低危 (Low)'      : 'Low',       color: TOKENS.low },
          ].map(({ key, label, color }) => (
            <div key={key} style={{ padding: 12, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number" min="1" max="365"
                  value={slaPolicy[key] ?? ''}
                  onChange={e => setSlaPolicy(prev => ({ ...prev, [key]: parseInt(e.target.value) || prev[key] }))}
                  style={{ width: '60px', padding: '6px 8px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 14, fontFamily: TOKENS.mono, textAlign: 'right', outline: 'none' }}
                />
                <span style={{ fontSize: 12, color: TOKENS.textMuted }}>{lang === 'zh' ? '天' : 'days'}</span>
              </div>
            </div>
          ))}
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
                    <div style={{ fontSize: 11, fontFamily: TOKENS.mono, color: TOKENS.text }}>{formatSync(src.lastSync)}</div>
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
                              ? `同步完成 — 新增 ${syncResult[src.id].inserted} 筆，更新 ${syncResult[src.id].updated} 筆${syncResult[src.id].removed > 0 ? `，移除 ${syncResult[src.id].removed} 筆過期資料` : ''}`
                              : `Sync complete — ${syncResult[src.id].inserted} new, ${syncResult[src.id].updated} updated${syncResult[src.id].removed > 0 ? `, ${syncResult[src.id].removed} expired removed` : ''}`}
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

      <Card title={lang === 'zh' ? '稽核日誌保留設定' : 'Audit Log Retention'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: TOKENS.textSecondary }}>
            {lang === 'zh' ? '超過設定保留期的日誌將於下次排程時自動刪除。' : 'Logs older than the retention period will be automatically deleted on the next scheduled run.'}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { value: 90,  label: lang === 'zh' ? '90 天（3 個月）' : '90 days (3 months)' },
              { value: 180, label: lang === 'zh' ? '180 天（6 個月）' : '180 days (6 months)' },
              { value: 365, label: lang === 'zh' ? '365 天（1 年）'   : '365 days (1 year)' },
            ].map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: TOKENS.text }}>
                <input
                  type="radio"
                  name="log_retention_days"
                  value={opt.value}
                  checked={logRetentionDays === opt.value}
                  onChange={() => setLogRetentionDays(opt.value)}
                  style={{ accentColor: TOKENS.primary }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="primary" onClick={handleSave}>{saved ? (lang === 'zh' ? '✓ 已儲存' : '✓ Saved') : t(lang, 'save')}</Btn>
      </div>
    </div>
  );
}
