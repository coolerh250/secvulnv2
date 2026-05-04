import { TOKENS } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import { Icons } from './Icons';
import { t } from '../styles/tokens';

export function Sidebar({ page, setPage }) {
  const { lang } = useLang();
  const { currentUser, logout, can, ROLES } = useAuth();

  const navItems = [
    { key: 'dashboard', icon: Icons.dashboard, label: t(lang, 'dashboard'), show: true },
    { key: 'search',    icon: Icons.search,    label: t(lang, 'search'),    show: true },
    { key: 'devices',   icon: Icons.devices,   label: t(lang, 'devices'),   show: true },
    { key: 'users',     icon: Icons.users,     label: lang === 'zh' ? '帳號管理' : 'Accounts', show: can('users', 'view') },
    { key: 'settings',  icon: Icons.settings,  label: t(lang, 'settings'),  show: can('settings', 'view') },
  ];

  const role = currentUser ? ROLES[currentUser.role] : null;

  return (
    <div style={{ width: 220, minHeight: '100vh', background: TOKENS.bgCard, borderRight: `1px solid ${TOKENS.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 20px 8px', cursor: 'pointer' }} onClick={() => setPage('dashboard')}>
        {Icons.shield}
        <span style={{ fontFamily: TOKENS.mono, fontSize: 15, fontWeight: 700, color: TOKENS.primary, letterSpacing: '0.03em' }}>{t(lang, 'appTitle')}</span>
      </div>
      <div style={{ fontSize: 11, color: TOKENS.textSecondary, padding: '0 20px 20px', borderBottom: `1px solid ${TOKENS.border}` }}>{t(lang, 'appSubtitle')}</div>

      <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {navItems.filter(i => i.show).map(item => {
          const active = page === item.key;
          return (
            <button key={item.key}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: TOKENS.radiusSm, cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 400, color: active ? TOKENS.primary : TOKENS.textSecondary, background: active ? TOKENS.primaryDim : 'transparent', transition: 'all 0.15s', border: 'none', fontFamily: TOKENS.font, width: '100%', textAlign: 'left' }}
              onClick={() => setPage(item.key)}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
              {item.icon}<span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {currentUser && (
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${TOKENS.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: role?.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: role?.color, flexShrink: 0 }}>
              {(lang === 'zh' ? (currentUser.display_name || currentUser.displayName) : (currentUser.display_name_en || currentUser.displayNameEn || currentUser.display_name || currentUser.displayName || ''))[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lang === 'zh' ? (currentUser.display_name || currentUser.displayName) : (currentUser.display_name_en || currentUser.displayNameEn || currentUser.display_name || currentUser.displayName)}
              </div>
              <div style={{ fontSize: 10, color: role?.color, fontWeight: 600 }}>{lang === 'zh' ? role?.label : role?.labelEn}</div>
            </div>
          </div>
          <button onClick={logout}
            style={{ width: '100%', padding: '6px 10px', background: 'transparent', border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: TOKENS.font, display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = TOKENS.danger; e.currentTarget.style.color = TOKENS.danger; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = TOKENS.border; e.currentTarget.style.color = TOKENS.textSecondary; }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 8H2M5 5l-3 3 3 3"/><path d="M6 3h6a1 1 0 011 1v8a1 1 0 01-1 1H6"/></svg>
            {lang === 'zh' ? '登出' : 'Sign out'}
          </button>
        </div>
      )}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${TOKENS.border}`, fontSize: 11, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>v1.0.0</div>
    </div>
  );
}
