// ── Auth Context: roles, permissions, mock accounts ──

const ROLES = {
  superadmin: {
    label: '全域管理者',
    labelEn: 'Super Admin',
    color: TOKENS.danger,
    bg: TOKENS.dangerDim,
    icon: '★',
    permissions: {
      dashboard:     { view: true },
      search:        { view: true, modify: true },
      devices:       { view: true, modify: true },
      users:         { view: true, modify: true, assignRole: ['superadmin','admin','user'] },
      settings:      { view: true, modify: true },
      riskAccept:    { view: true, modify: true },
      aiAnalysis:    { view: true },
    },
  },
  admin: {
    label: '一般管理者',
    labelEn: 'Admin',
    color: TOKENS.warning,
    bg: TOKENS.warningDim,
    icon: '▲',
    permissions: {
      dashboard:     { view: true },
      search:        { view: true, modify: false },
      devices:       { view: true, modify: true },
      users:         { view: true, modify: true, assignRole: ['admin','user'] },
      settings:      { view: false, modify: false },
      riskAccept:    { view: true, modify: false },
      aiAnalysis:    { view: true },
    },
  },
  user: {
    label: '使用者',
    labelEn: 'User',
    color: TOKENS.info,
    bg: TOKENS.infoDim,
    icon: '●',
    permissions: {
      dashboard:     { view: true },
      search:        { view: true, modify: false },
      devices:       { view: true, modify: false },
      users:         { view: false, modify: false, assignRole: [] },
      settings:      { view: false, modify: false },
      riskAccept:    { view: true, modify: false },
      aiAnalysis:    { view: false },
    },
  },
};

const MOCK_USERS = [
  { id: 1, username: 'superadmin', password: 'admin1234', displayName: '系統管理員', displayNameEn: 'System Admin', email: 'superadmin@secvuln.local', role: 'superadmin', lastLogin: '2026-05-04 09:12', active: true, createdAt: '2026-01-01' },
  { id: 2, username: 'alice',      password: 'alice1234', displayName: '王小明',    displayNameEn: 'Alice Wang',  email: 'alice@secvuln.local',      role: 'admin',      lastLogin: '2026-05-03 14:30', active: true, createdAt: '2026-02-15' },
  { id: 3, username: 'bob',        password: 'bob12345',  displayName: '李大華',    displayNameEn: 'Bob Lee',     email: 'bob@secvuln.local',        role: 'user',       lastLogin: '2026-05-02 10:05', active: true, createdAt: '2026-03-01' },
  { id: 4, username: 'carol',      password: 'carol123',  displayName: '陳美玲',    displayNameEn: 'Carol Chen',  email: 'carol@secvuln.local',      role: 'user',       lastLogin: '2026-04-28 16:45', active: false, createdAt: '2026-03-10' },
];

// ── Auth Context ──
const AuthContext = React.createContext(null);

function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = React.useState(null);
  const [users, setUsers] = React.useState(MOCK_USERS);

  const login = (username, password) => {
    const u = users.find(u => u.username === username && u.password === password && u.active);
    if (!u) return false;
    setCurrentUser(u);
    return true;
  };

  const logout = () => setCurrentUser(null);

  const can = (module, action = 'view') => {
    if (!currentUser) return false;
    const role = ROLES[currentUser.role];
    return role?.permissions?.[module]?.[action] === true;
  };

  const canAssignRole = (targetRole) => {
    if (!currentUser) return false;
    const allowed = ROLES[currentUser.role]?.permissions?.users?.assignRole || [];
    return allowed.includes(targetRole);
  };

  const addUser = (userData) => {
    const newUser = { ...userData, id: Date.now(), lastLogin: '—', createdAt: new Date().toISOString().slice(0,10) };
    setUsers(prev => [...prev, newUser]);
    return newUser;
  };

  const updateUser = (id, updates) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
  };

  const deleteUser = (id) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  return (
    <AuthContext.Provider value={{ currentUser, users, login, logout, can, canAssignRole, addUser, updateUser, deleteUser, ROLES }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => React.useContext(AuthContext);

// ── Permission Gate: renders children only if allowed, else shows fallback ──
function PermGate({ module, action = 'view', fallback = null, children }) {
  const { can } = useAuth();
  return can(module, action) ? children : fallback;
}

// ── Read-only Overlay: wraps content with a disabled veil ──
function ReadOnlyVeil({ children, message }) {
  const lang = useLang();
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,14,26,0.55)', backdropFilter: 'blur(1px)', borderRadius: TOKENS.radius, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: 20, fontSize: 12, color: TOKENS.textSecondary }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>
          {message || (lang === 'zh' ? '您的權限不足，無法執行此操作' : 'Insufficient permissions')}
        </div>
      </div>
    </div>
  );
}

// ── Role Badge ──
function RoleBadge({ role }) {
  const lang = useLang();
  const r = ROLES[role];
  if (!r) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: r.color, background: r.bg }}>
      <span style={{ fontSize: 9 }}>{r.icon}</span>{lang === 'zh' ? r.label : r.labelEn}
    </span>
  );
}

Object.assign(window, { ROLES, MOCK_USERS, AuthContext, AuthProvider, useAuth, PermGate, ReadOnlyVeil, RoleBadge });
