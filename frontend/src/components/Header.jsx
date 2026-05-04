import { useState } from 'react';
import { TOKENS, SEVERITY_MAP, t } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { Icons } from './Icons';

export function Header({ notifications = [] }) {
  const { lang, setLang } = useLang();
  const [showNotif, setShowNotif] = useState(false);
  const unread = notifications.filter(n => !n.read).length;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '12px 28px', borderBottom: `1px solid ${TOKENS.border}`, background: TOKENS.bgCard, minHeight: 52 }}>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowNotif(!showNotif)}
          style={{ background: 'none', border: 'none', color: TOKENS.textSecondary, cursor: 'pointer', padding: 6, borderRadius: TOKENS.radiusSm, display: 'flex', alignItems: 'center', position: 'relative' }}
          onMouseEnter={e => e.currentTarget.style.color = TOKENS.text}
          onMouseLeave={e => e.currentTarget.style.color = TOKENS.textSecondary}>
          {Icons.bell}
          {unread > 0 && <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: TOKENS.danger }} />}
        </button>
        {showNotif && (
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 340, background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, boxShadow: TOKENS.shadow, zIndex: 100, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>{t(lang, 'notifications')}</span>
              <button onClick={() => setShowNotif(false)} style={{ background: 'none', border: 'none', color: TOKENS.textMuted, cursor: 'pointer' }}>{Icons.close}</button>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '20px 16px', fontSize: 13, color: TOKENS.textMuted, textAlign: 'center' }}>
                  {lang === 'zh' ? '目前沒有通知' : 'No notifications'}
                </div>
              ) : notifications.map((n, i) => (
                <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid ${TOKENS.border}`, background: n.read ? 'transparent' : 'rgba(0,212,170,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERITY_MAP[n.severity]?.color || TOKENS.info, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text, fontFamily: TOKENS.mono }}>{n.cveId}</span>
                  </div>
                  <div style={{ fontSize: 12, color: TOKENS.textSecondary, lineHeight: 1.4 }}>{lang === 'zh' ? n.text : n.textEn}</div>
                  <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 4 }}>{n.time}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        style={{ background: TOKENS.primaryDim, border: `1px solid ${TOKENS.border}`, color: TOKENS.primary, cursor: 'pointer', padding: '4px 10px', borderRadius: TOKENS.radiusSm, fontSize: 12, fontWeight: 600, fontFamily: TOKENS.font }}>
        {lang === 'zh' ? 'EN' : '中'}
      </button>
    </div>
  );
}
