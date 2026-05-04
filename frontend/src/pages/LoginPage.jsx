import { useState } from 'react';
import { TOKENS, ROLES } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import { RoleBadge } from '../components/ui';

export function LoginPage() {
  const { lang } = useLang();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError(lang === 'zh' ? '請輸入帳號與密碼' : 'Please enter username and password'); return; }
    setLoading(true); setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(lang === 'zh' ? '帳號或密碼錯誤，或帳號已停用' : 'Invalid credentials or account disabled');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: 'superadmin', username: 'superadmin', password: 'admin1234' },
    { role: 'admin',      username: 'alice',      password: 'alice1234' },
    { role: 'user',       username: 'bob',        password: 'bob12345'  },
  ];

  return (
    <div style={{ minHeight: '100vh', background: TOKENS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 20% 30%, rgba(0,212,170,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(64,144,240,0.06) 0%, transparent 50%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(30,37,64,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(30,37,64,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none', opacity: 0.5 }} />

      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: TOKENS.primaryDim, border: `1px solid rgba(0,212,170,0.3)`, marginBottom: 16 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={TOKENS.primary} strokeWidth="1.5"><path d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z"/><path d="M9 12l2 2 4-4" stroke={TOKENS.primary} strokeWidth="2"/></svg>
          </div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 22, fontWeight: 700, color: TOKENS.primary, letterSpacing: '0.03em' }}>SecVuln Tracker</div>
          <div style={{ fontSize: 13, color: TOKENS.textSecondary, marginTop: 4 }}>{lang === 'zh' ? '資訊安全弱點追蹤系統' : 'Security Vulnerability Tracking System'}</div>
        </div>

        <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusLg, padding: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: TOKENS.text, marginBottom: 24 }}>{lang === 'zh' ? '登入系統' : 'Sign In'}</div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{lang === 'zh' ? '帳號' : 'Username'}</label>
              <input value={username} onChange={e => { setUsername(e.target.value); setError(''); }} placeholder={lang === 'zh' ? '輸入帳號' : 'Enter username'} autoComplete="username"
                style={{ padding: '10px 12px', background: TOKENS.bgInput, border: `1px solid ${error ? TOKENS.danger : TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 14, fontFamily: TOKENS.font, outline: 'none' }}
                onFocus={e => e.target.style.borderColor = TOKENS.borderFocus} onBlur={e => e.target.style.borderColor = error ? TOKENS.danger : TOKENS.border} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{lang === 'zh' ? '密碼' : 'Password'}</label>
              <div style={{ position: 'relative' }}>
                <input value={password} onChange={e => { setPassword(e.target.value); setError(''); }} type={showPw ? 'text' : 'password'} placeholder={lang === 'zh' ? '輸入密碼' : 'Enter password'} autoComplete="current-password"
                  style={{ width: '100%', padding: '10px 40px 10px 12px', background: TOKENS.bgInput, border: `1px solid ${error ? TOKENS.danger : TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 14, fontFamily: TOKENS.font, outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = TOKENS.borderFocus} onBlur={e => e.target.style.borderColor = error ? TOKENS.danger : TOKENS.border} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: TOKENS.textMuted, cursor: 'pointer', fontSize: 13 }}>
                  {showPw ? '👁' : '👁‍🗨'}
                </button>
              </div>
            </div>
            {error && <div style={{ padding: '8px 12px', background: TOKENS.dangerDim, border: `1px solid rgba(240,64,64,0.2)`, borderRadius: TOKENS.radiusSm, fontSize: 12, color: TOKENS.danger }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ padding: '11px', background: loading ? TOKENS.border : TOKENS.primary, border: 'none', borderRadius: TOKENS.radiusSm, color: loading ? TOKENS.textMuted : '#0a0e1a', fontSize: 14, fontWeight: 700, fontFamily: TOKENS.font, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? (
                <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />{lang === 'zh' ? '登入中...' : 'Signing in...'}</>
              ) : (lang === 'zh' ? '登入' : 'Sign In')}
            </button>
          </form>
        </div>

        <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusLg, padding: 20 }}>
          <div style={{ fontSize: 12, color: TOKENS.textMuted, marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lang === 'zh' ? '測試帳號（點擊自動填入）' : 'Demo Accounts (click to fill)'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {demoAccounts.map(a => (
              <button key={a.username} onClick={() => { setUsername(a.username); setPassword(a.password); setError(''); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, cursor: 'pointer', fontFamily: TOKENS.font }}
                onMouseEnter={e => e.currentTarget.style.borderColor = TOKENS.borderFocus}
                onMouseLeave={e => e.currentTarget.style.borderColor = TOKENS.border}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RoleBadge role={a.role} />
                  <span style={{ fontSize: 13, color: TOKENS.text, fontFamily: TOKENS.mono }}>{a.username}</span>
                </div>
                <span style={{ fontSize: 11, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>{a.password}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
