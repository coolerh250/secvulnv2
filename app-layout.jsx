// Layout Components: Sidebar, Header, shared UI primitives

const { useState, useEffect, useContext, createContext, useRef } = React;

const LangContext = createContext('zh');
const useLang = () => useContext(LangContext);
const t = (lang, key) => LANG[lang]?.[key] || key;

// ── SVG Icons ──
const Icons = {
  dashboard: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="7" height="8" rx="1.5"/><rect x="11" y="2" width="7" height="5" rx="1.5"/><rect x="2" y="12" width="7" height="6" rx="1.5"/><rect x="11" y="9" width="7" height="9" rx="1.5"/></svg>,
  search: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="9" r="6"/><line x1="13.5" y1="13.5" x2="17" y2="17"/></svg>,
  devices: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="16" height="11" rx="2"/><line x1="6" y1="17" x2="14" y2="17"/><line x1="10" y1="14" x2="10" y2="17"/></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="3"/><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.4 3.4l1.4 1.4M15.2 15.2l1.4 1.4M3.4 16.6l1.4-1.4M15.2 4.8l1.4-1.4"/></svg>,
  bell: <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2a5 5 0 015 5c0 4 2 6 2 6H3s2-2 2-6a5 5 0 015-5z"/><path d="M8.5 17a2 2 0 003 0"/></svg>,
  shield: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2"/></svg>,
  chevronDown: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4"/></svg>,
  export: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 10v3h12v-3"/><path d="M8 2v8M5 5l3-3 3 3"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M6 4V3h4v1M5 4v9h6V4"/></svg>,
  edit: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>,
  external: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v4H3V4h4M9 2h5v5M7 9L14 2"/></svg>,
  ai: <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8"/><circle cx="7" cy="8" r="1.5" fill="currentColor"/><circle cx="13" cy="8" r="1.5" fill="currentColor"/><path d="M6 13c1 2 3 3 4 3s3-1 4-3"/></svg>,
  refresh: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8a6 6 0 0111-3M14 8a6 6 0 01-11 3"/><path d="M13 2v3h-3M3 14v-3h3"/></svg>,
  close: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>,
  filter: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12l-4.5 5.5V14l-3-1.5V8.5L2 3z"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3.5 3.5L13 5"/></svg>,
};

// ── Sidebar ──
function Sidebar({ page, setPage }) {
  const lang = useLang();
  const { currentUser, logout, can, ROLES } = useAuth ? useAuth() : { currentUser: null, logout: () => {}, can: () => true, ROLES: {} };

  const navItems = [
    { key: 'dashboard', icon: Icons.dashboard, label: t(lang, 'dashboard'),  show: true },
    { key: 'search',    icon: Icons.search,    label: t(lang, 'search'),     show: true },
    { key: 'devices',   icon: Icons.devices,   label: t(lang, 'devices'),    show: true },
    { key: 'users',     icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="6" r="3"/><path d="M2 17c0-3.3 2.7-6 6-6"/><circle cx="15" cy="13" r="3"/><path d="M12 17h6"/><path d="M15 14v6"/></svg>, label: lang === 'zh' ? '帳號管理' : 'Accounts', show: can('users', 'view') },
    { key: 'settings',  icon: Icons.settings,  label: t(lang, 'settings'),   show: can('settings', 'view') },
  ];

  const sidebarStyles = {
    container: { width: 220, minHeight: '100vh', background: TOKENS.bgCard, borderRight: `1px solid ${TOKENS.border}`, display: 'flex', flexDirection: 'column', padding: '0', flexShrink: 0 },
    logo: { display: 'flex', alignItems: 'center', gap: 10, padding: '20px 20px 8px', cursor: 'pointer' },
    logoText: { fontFamily: TOKENS.mono, fontSize: 15, fontWeight: 700, color: TOKENS.primary, letterSpacing: '0.03em' },
    subtitle: { fontSize: 11, color: TOKENS.textSecondary, padding: '0 20px 20px', borderBottom: `1px solid ${TOKENS.border}`, fontFamily: TOKENS.font },
    nav: { padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
    navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: TOKENS.radiusSm, cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 400, color: active ? TOKENS.primary : TOKENS.textSecondary, background: active ? TOKENS.primaryDim : 'transparent', transition: 'all 0.15s', border: 'none', fontFamily: TOKENS.font, width: '100%', textAlign: 'left' }),
    version: { padding: '12px 16px', borderTop: `1px solid ${TOKENS.border}`, fontSize: 11, color: TOKENS.textMuted, fontFamily: TOKENS.mono },
  };

  const role = currentUser ? ROLES[currentUser.role] : null;

  return (
    <div style={sidebarStyles.container}>
      <div style={sidebarStyles.logo} onClick={() => setPage('dashboard')}>
        {Icons.shield}
        <span style={{ ...sidebarStyles.logoText, color: TOKENS.primary }}>{t(lang, 'appTitle')}</span>
      </div>
      <div style={sidebarStyles.subtitle}>{t(lang, 'appSubtitle')}</div>
      <nav style={sidebarStyles.nav}>
        {navItems.filter(i => i.show).map(item => (
          <button key={item.key} style={sidebarStyles.navItem(page === item.key)} onClick={() => setPage(item.key)}
            onMouseEnter={e => { if (page !== item.key) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { if (page !== item.key) e.currentTarget.style.background = 'transparent'; }}>
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
      </nav>
      {/* Current user info + logout */}
      {currentUser && (
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${TOKENS.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: role?.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: role?.color, flexShrink: 0 }}>
              {(lang === 'zh' ? currentUser.displayName : (currentUser.displayNameEn || currentUser.displayName))[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lang === 'zh' ? currentUser.displayName : (currentUser.displayNameEn || currentUser.displayName)}
              </div>
              <div style={{ fontSize: 10, color: role?.color, fontWeight: 600 }}>{lang === 'zh' ? role?.label : role?.labelEn}</div>
            </div>
          </div>
          <button onClick={logout}
            style={{ width: '100%', padding: '6px 10px', background: 'transparent', border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: TOKENS.font, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = TOKENS.danger; e.currentTarget.style.color = TOKENS.danger; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = TOKENS.border; e.currentTarget.style.color = TOKENS.textSecondary; }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 8H2M5 5l-3 3 3 3"/><path d="M6 3h6a1 1 0 011 1v8a1 1 0 01-1 1H6"/></svg>
            {lang === 'zh' ? '登出' : 'Sign out'}
          </button>
        </div>
      )}
      <div style={sidebarStyles.version}>v1.0.0</div>
    </div>
  );
}

// ── Header ──
function Header({ lang, setLang, notifications }) {
  const l = useLang();
  const [showNotif, setShowNotif] = useState(false);
  const unread = notifications.filter(n => !n.read).length;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '12px 28px', borderBottom: `1px solid ${TOKENS.border}`, background: TOKENS.bgCard, minHeight: 52 }}>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowNotif(!showNotif)} style={{ background: 'none', border: 'none', color: TOKENS.textSecondary, cursor: 'pointer', padding: 6, borderRadius: TOKENS.radiusSm, display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => e.currentTarget.style.color = TOKENS.text} onMouseLeave={e => e.currentTarget.style.color = TOKENS.textSecondary}>
          {Icons.bell}
          {unread > 0 && <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: TOKENS.danger }}></span>}
        </button>
        {showNotif && <NotifDropdown notifications={notifications} onClose={() => setShowNotif(false)} />}
      </div>
      <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} style={{ background: TOKENS.primaryDim, border: `1px solid ${TOKENS.border}`, color: TOKENS.primary, cursor: 'pointer', padding: '4px 10px', borderRadius: TOKENS.radiusSm, fontSize: 12, fontWeight: 600, fontFamily: TOKENS.font }}>
        {lang === 'zh' ? 'EN' : '中'}
      </button>
    </div>
  );
}

function NotifDropdown({ notifications, onClose }) {
  const lang = useLang();
  return (
    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 340, background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, boxShadow: TOKENS.shadow, zIndex: 100, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>{t(lang, 'notifications')}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: TOKENS.textMuted, cursor: 'pointer' }}>{Icons.close}</button>
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {notifications.map((n, i) => (
          <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid ${TOKENS.border}`, background: n.read ? 'transparent' : 'rgba(0,212,170,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERITY_MAP[n.severity]?.color || TOKENS.info, flexShrink: 0 }}></span>
              <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text, fontFamily: TOKENS.mono }}>{n.cveId}</span>
            </div>
            <div style={{ fontSize: 12, color: TOKENS.textSecondary, lineHeight: 1.4 }}>{lang === 'zh' ? n.text : n.textEn}</div>
            <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 4 }}>{n.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared UI ──
function Card({ children, style, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ background: TOKENS.bgCard, border: `1px solid ${hovered ? TOKENS.borderFocus : TOKENS.border}`, borderRadius: TOKENS.radiusLg, padding: 20, transition: 'border-color 0.15s', cursor: onClick ? 'pointer' : 'default', ...style }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={onClick}>
      {children}
    </div>
  );
}

function Badge({ severity }) {
  const s = SEVERITY_MAP[severity];
  const lang = useLang();
  if (!s) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, fontFamily: TOKENS.font }}>
      <span style={{ fontSize: 8 }}>{s.icon}</span>{lang === 'zh' ? s.label : s.labelEn}
    </span>
  );
}

function CvssBar({ score }) {
  const color = score >= 9 ? TOKENS.danger : score >= 7 ? TOKENS.warning : score >= 4 ? TOKENS.medium : TOKENS.low;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 60, height: 6, background: TOKENS.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score * 10}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }}></div>
      </div>
      <span style={{ fontFamily: TOKENS.mono, fontSize: 13, fontWeight: 700, color }}>{score.toFixed(1)}</span>
    </div>
  );
}

function Btn({ children, variant = 'default', icon, onClick, style: extraStyle, disabled }) {
  const baseStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: TOKENS.radiusSm, fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', fontFamily: TOKENS.font, transition: 'all 0.15s', opacity: disabled ? 0.5 : 1 };
  const variants = {
    default: { background: TOKENS.border, color: TOKENS.text },
    primary: { background: TOKENS.primary, color: '#0a0e1a' },
    danger: { background: TOKENS.dangerDim, color: TOKENS.danger, border: `1px solid transparent` },
    ghost: { background: 'transparent', color: TOKENS.textSecondary },
  };
  return <button style={{ ...baseStyle, ...variants[variant], ...extraStyle }} onClick={onClick} disabled={disabled}>{icon}{children}</button>;
}

function InputField({ label, value, onChange, placeholder, type = 'text', style: extraStyle }) {
  const inputStyle = { width: '100%', padding: '8px 12px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 13, fontFamily: TOKENS.font, outline: 'none', transition: 'border-color 0.15s', ...extraStyle };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle}
        onFocus={e => e.target.style.borderColor = TOKENS.borderFocus} onBlur={e => e.target.style.borderColor = TOKENS.border} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, style: extraStyle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '8px 12px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 13, fontFamily: TOKENS.font, outline: 'none', cursor: 'pointer', ...extraStyle }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Mini Chart (SVG) ──
function MiniBarChart({ data, keys, colors, height = 160 }) {
  const maxVal = Math.max(...data.map(d => keys.reduce((s, k) => s + d[k], 0)));
  const barW = Math.floor((320 - (data.length - 1) * 6) / data.length);
  return (
    <svg width="100%" viewBox={`0 0 320 ${height + 24}`} style={{ display: 'block' }}>
      {data.map((d, i) => {
        let y = height;
        return (
          <g key={i} transform={`translate(${i * (barW + 6)}, 0)`}>
            {keys.map((k, ki) => {
              const h = maxVal > 0 ? (d[k] / maxVal) * height : 0;
              y -= h;
              return <rect key={k} x="0" y={y} width={barW} height={h} rx="2" fill={colors[ki]} opacity="0.85" />;
            })}
            <text x={barW / 2} y={height + 16} textAnchor="middle" fontSize="10" fill={TOKENS.textMuted} fontFamily={TOKENS.font}>{d.month}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ segments, size = 120 }) {
  const total = segments.reduce((s, sg) => s + sg.value, 0);
  const cx = size / 2, cy = size / 2, r = size * 0.38, sw = size * 0.14;
  let angle = -90;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((sg, i) => {
        const pct = total > 0 ? sg.value / total : 0;
        const a1 = angle * Math.PI / 180;
        angle += pct * 360;
        const a2 = angle * Math.PI / 180;
        const large = pct > 0.5 ? 1 : 0;
        const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
        return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={sg.color} strokeWidth={sw} strokeLinecap="round" />;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="20" fontWeight="700" fill={TOKENS.text} fontFamily={TOKENS.mono}>{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill={TOKENS.textSecondary} fontFamily={TOKENS.font}>TOTAL</text>
    </svg>
  );
}

function VulnStatusBadge({ status }) {
  const lang = useLang();
  const s = VULN_STATUS[status];
  if (!s) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, fontFamily: TOKENS.font, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 9 }}>{s.icon}</span>{lang === 'zh' ? s.label : s.labelEn}
    </span>
  );
}

Object.assign(window, { LangContext, useLang, t, Icons, Sidebar, Header, Card, Badge, CvssBar, Btn, InputField, SelectField, MiniBarChart, DonutChart, VulnStatusBadge });
