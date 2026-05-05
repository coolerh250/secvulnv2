import { useState } from 'react';
import { TOKENS, SEVERITY_MAP, VULN_STATUS } from '../../styles/tokens';
import { useLang } from '../../contexts/LangContext';

export function Card({ children, style, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ background: TOKENS.bgCard, border: `1px solid ${hovered ? TOKENS.borderFocus : TOKENS.border}`, borderRadius: TOKENS.radiusLg, padding: 20, transition: 'border-color 0.15s', cursor: onClick ? 'pointer' : 'default', ...style }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={onClick}>
      {children}
    </div>
  );
}

export function Badge({ severity }) {
  const { lang } = useLang();
  const s = SEVERITY_MAP[severity];
  if (!s) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg }}>
      <span style={{ fontSize: 8 }}>{s.icon}</span>{lang === 'zh' ? s.label : s.labelEn}
    </span>
  );
}

export function VulnStatusBadge({ status }) {
  const { lang } = useLang();
  const s = VULN_STATUS[status];
  if (!s) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 9 }}>{s.icon}</span>{lang === 'zh' ? s.label : s.labelEn}
    </span>
  );
}

export function CvssBar({ score }) {
  const color = score >= 9 ? TOKENS.danger : score >= 7 ? TOKENS.warning : score >= 4 ? TOKENS.medium : TOKENS.low;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 60, height: 6, background: TOKENS.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score * 10}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontFamily: TOKENS.mono, fontSize: 13, fontWeight: 700, color }}>{Number(score).toFixed(1)}</span>
    </div>
  );
}

export function Btn({ children, variant = 'default', icon, onClick, style: extra, disabled }) {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: TOKENS.radiusSm, fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', fontFamily: TOKENS.font, transition: 'all 0.15s', opacity: disabled ? 0.5 : 1 };
  const variants = {
    default: { background: TOKENS.border, color: TOKENS.text },
    primary: { background: TOKENS.primary, color: '#0a0e1a' },
    danger:  { background: TOKENS.dangerDim, color: TOKENS.danger, border: '1px solid transparent' },
    ghost:   { background: 'transparent', color: TOKENS.textSecondary },
  };
  return <button style={{ ...base, ...variants[variant], ...extra }} onClick={onClick} disabled={disabled}>{icon}{children}</button>;
}

export function InputField({ label, value, onChange, placeholder, type = 'text', style: extra }) {
  const inputStyle = { width: '100%', padding: '8px 12px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 13, fontFamily: TOKENS.font, outline: 'none', transition: 'border-color 0.15s', ...extra };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle}
        onFocus={e => e.target.style.borderColor = TOKENS.borderFocus}
        onBlur={e  => e.target.style.borderColor = TOKENS.border} />
    </div>
  );
}

export function SelectField({ label, value, onChange, options, style: extra }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '8px 12px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 13, fontFamily: TOKENS.font, outline: 'none', cursor: 'pointer', ...extra }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function RoleBadge({ role }) {
  const { lang } = useLang();
  const roleMap = {
    superadmin: { label: '全域管理者', labelEn: 'Super Admin', color: TOKENS.danger,  bg: TOKENS.dangerDim,  icon: '★' },
    admin:      { label: '一般管理者', labelEn: 'Admin',       color: TOKENS.warning, bg: TOKENS.warningDim, icon: '▲' },
    user:       { label: '使用者',     labelEn: 'User',         color: TOKENS.info,    bg: TOKENS.infoDim,    icon: '●' },
  };
  const r = roleMap[role];
  if (!r) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: r.color, background: r.bg }}>
      <span style={{ fontSize: 9 }}>{r.icon}</span>{lang === 'zh' ? r.label : r.labelEn}
    </span>
  );
}

export function MiniBarChart({ data, keys, colors, height = 160 }) {
  if (!data || data.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TOKENS.textMuted, fontSize: 13 }}>—</div>;
  }
  const maxVal    = Math.max(1, ...data.map(d => keys.reduce((s, k) => s + (d[k] || 0), 0)));
  const gap       = 4;
  const barW      = Math.max(10, Math.floor((320 - (data.length - 1) * gap) / data.length));
  const vbW       = data.length * barW + (data.length - 1) * gap;
  // Rotate labels when bar is narrower than the label text (≈7 viewBox units per char)
  const labelLen  = Math.max(3, ...data.map(d => (d.month || '').length));
  const rotate    = barW < labelLen * 7;
  const labelArea = rotate ? 40 : 22;
  return (
    <svg width="100%" viewBox={`0 0 ${vbW} ${height + labelArea}`} style={{ display: 'block' }}>
      {data.map((d, i) => {
        let y = height;
        return (
          <g key={i} transform={`translate(${i * (barW + gap)}, 0)`}>
            {keys.map((k, ki) => {
              const h = ((d[k] || 0) / maxVal) * height;
              y -= h;
              return <rect key={k} x="0" y={y} width={barW} height={h} rx="2" fill={colors[ki]} opacity="0.85" />;
            })}
            {rotate ? (
              <text
                transform={`translate(${barW / 2 + 1}, ${height + 4}) rotate(-45)`}
                textAnchor="end" fontSize="9" fill={TOKENS.textMuted} fontFamily={TOKENS.font}>
                {d.month}
              </text>
            ) : (
              <text x={barW / 2} y={height + 16} textAnchor="middle" fontSize="10" fill={TOKENS.textMuted} fontFamily={TOKENS.font}>
                {d.month}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function DonutChart({ segments, size = 120 }) {
  const total = segments.reduce((s, sg) => s + sg.value, 0);
  const cx = size / 2, cy = size / 2, r = size * 0.38, sw = size * 0.14;
  let angle = -90;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((sg, i) => {
        const pct = total > 0 ? sg.value / total : 0;
        const a1  = angle * Math.PI / 180;
        angle += pct * 360;
        const a2  = angle * Math.PI / 180;
        const large = pct > 0.5 ? 1 : 0;
        const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
        return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={sg.color} strokeWidth={sw} strokeLinecap="round" />;
      })}
      <text x={cx} y={cy - 4}  textAnchor="middle" fontSize="20" fontWeight="700" fill={TOKENS.text}          fontFamily={TOKENS.mono}>{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9"  fill={TOKENS.textSecondary} fontFamily={TOKENS.font}>TOTAL</text>
    </svg>
  );
}
