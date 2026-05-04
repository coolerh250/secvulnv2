import { useState, useEffect } from 'react';
import { TOKENS, ROLES } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../services/api';
import { Card, Btn, InputField, RoleBadge } from '../components/ui';
import { Icons } from '../components/Icons';

export function UsersPage() {
  const { lang } = useLang();
  const { currentUser, can, canAssignRole } = useAuth();
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [confirmDel,  setConfirmDel]  = useState(null);
  const [searchQ,     setSearchQ]     = useState('');
  const [form,        setForm]        = useState({ username: '', display_name: '', display_name_en: '', email: '', role: 'user', password: '', active: true });
  const [formError,   setFormError]   = useState('');

  useEffect(() => {
    userApi.list().then(res => setUsers(res.data)).finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(searchQ.toLowerCase()) ||
    (u.display_name || '').toLowerCase().includes(searchQ.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQ.toLowerCase())
  );

  const resetForm = () => { setForm({ username: '', display_name: '', display_name_en: '', email: '', role: 'user', password: '', active: true }); setFormError(''); };

  const openAdd  = () => { resetForm(); setEditTarget(null); setShowForm(true); };
  const openEdit = (u) => {
    setForm({ username: u.username, display_name: u.display_name, display_name_en: u.display_name_en || '', email: u.email, role: u.role, password: '', active: u.active });
    setEditTarget(u); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.username || !form.display_name || !form.email) { setFormError(lang === 'zh' ? '帳號、姓名、Email 為必填' : 'Username, name and email are required'); return; }
    if (!editTarget && !form.password) { setFormError(lang === 'zh' ? '新增帳號需設定密碼' : 'Password required for new account'); return; }
    if (!canAssignRole(form.role)) { setFormError(lang === 'zh' ? '您無權指派此角色' : 'You cannot assign this role'); return; }
    try {
      if (editTarget) {
        const updates = { ...form };
        if (!form.password) delete updates.password;
        const res = await userApi.update(editTarget.id, updates);
        setUsers(prev => prev.map(u => u.id === editTarget.id ? res.data : u));
      } else {
        const res = await userApi.create(form);
        setUsers(prev => [...prev, res.data]);
      }
      setShowForm(false); resetForm();
    } catch (err) {
      setFormError(err.response?.data?.error || (lang === 'zh' ? '操作失敗' : 'Operation failed'));
    }
  };

  const handleDelete = async (id) => {
    await userApi.remove(id);
    setUsers(prev => prev.filter(u => u.id !== id));
    setConfirmDel(null);
  };

  const handleToggleActive = async (u) => {
    if (u.id === currentUser?.id) return;
    const res = await userApi.update(u.id, { active: !u.active });
    setUsers(prev => prev.map(x => x.id === u.id ? res.data : x));
  };

  if (loading) return (
    <div style={{ padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${TOKENS.border}`, borderTop: `3px solid ${TOKENS.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: TOKENS.text }}>{lang === 'zh' ? '帳號管理' : 'Account Management'}</div>
          <div style={{ fontSize: 12, color: TOKENS.textMuted, marginTop: 2 }}>{lang === 'zh' ? `共 ${users.length} 個帳號` : `${users.length} accounts total`}</div>
        </div>
        {can('users', 'modify') && <Btn variant="primary" icon={Icons.plus} onClick={openAdd}>{lang === 'zh' ? '新增帳號' : 'Add Account'}</Btn>}
      </div>

      {/* Role Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {Object.entries(ROLES).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, flex: 1, minWidth: 180 }}>
            <span style={{ fontSize: 18, color: v.color, marginTop: 1 }}>{v.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: v.color }}>{lang === 'zh' ? v.label : v.labelEn}</div>
              <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 2, lineHeight: 1.4 }}>
                {k === 'superadmin' && (lang === 'zh' ? '全系統存取，含設定與角色管理' : 'Full system access incl. settings & roles')}
                {k === 'admin'      && (lang === 'zh' ? '設備與帳號管理，無系統設定' : 'Device & account mgmt, no system settings')}
                {k === 'user'       && (lang === 'zh' ? '唯讀：儀表板、搜尋、設備清單' : 'Read-only: dashboard, search, devices')}
              </div>
            </div>
            <span style={{ marginLeft: 'auto', fontFamily: TOKENS.mono, fontSize: 18, fontWeight: 700, color: v.color }}>{users.filter(u => u.role === k).length}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ maxWidth: 360 }}>
        <InputField label="" value={searchQ} onChange={setSearchQ} placeholder={lang === 'zh' ? '搜尋帳號、姓名、Email...' : 'Search username, name, email...'} />
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 200px 100px 120px 140px', padding: '10px 16px', borderBottom: `1px solid ${TOKENS.border}`, background: 'rgba(255,255,255,0.02)' }}>
          {[lang === 'zh' ? '帳號 / 姓名' : 'Account / Name', lang === 'zh' ? '角色' : 'Role', 'Email', lang === 'zh' ? '狀態' : 'Status', lang === 'zh' ? '最後登入' : 'Last Login', lang === 'zh' ? '操作' : 'Actions'].map(h => (
            <span key={h} style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{h}</span>
          ))}
        </div>
        {filtered.map((u, i) => {
          const isSelf  = u.id === currentUser?.id;
          const canEdit = can('users', 'modify') && canAssignRole(u.role);
          const role    = ROLES[u.role];
          const displayName = lang === 'zh' ? u.display_name : (u.display_name_en || u.display_name || '');
          return (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 200px 100px 120px 140px', padding: '12px 16px', borderBottom: i < filtered.length - 1 ? `1px solid ${TOKENS.border}` : 'none', alignItems: 'center', opacity: u.active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: role?.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: role?.color, flexShrink: 0 }}>
                  {(displayName || u.username)[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: TOKENS.text }}>
                    {displayName || u.username}
                    {isSelf && <span style={{ fontSize: 10, color: TOKENS.primary, background: TOKENS.primaryDim, padding: '1px 5px', borderRadius: 6, marginLeft: 6 }}>{lang === 'zh' ? '本人' : 'You'}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>{u.username}</div>
                </div>
              </div>
              <RoleBadge role={u.role} />
              <span style={{ fontSize: 12, color: TOKENS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: u.active ? TOKENS.low : TOKENS.textMuted }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.active ? TOKENS.low : TOKENS.textMuted }} />
                {u.active ? (lang === 'zh' ? '啟用' : 'Active') : (lang === 'zh' ? '停用' : 'Disabled')}
              </span>
              <span style={{ fontSize: 11, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>
                {u.last_login ? new Date(u.last_login).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {canEdit && <button onClick={() => openEdit(u)} style={{ background: 'none', border: 'none', color: TOKENS.textSecondary, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}>{Icons.edit}</button>}
                {canEdit && !isSelf && (
                  <button onClick={() => handleToggleActive(u)} style={{ background: 'none', border: 'none', color: u.active ? TOKENS.warning : TOKENS.low, cursor: 'pointer', padding: 4, borderRadius: 4, fontSize: 13 }}>
                    {u.active ? '⏸' : '▶'}
                  </button>
                )}
                {canEdit && !isSelf && <button onClick={() => setConfirmDel(u)} style={{ background: 'none', border: 'none', color: TOKENS.danger, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}>{Icons.trash}</button>}
                {!canEdit && <span style={{ fontSize: 11, color: TOKENS.textMuted }}>—</span>}
              </div>
            </div>
          );
        })}
      </Card>

      {/* User Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={() => { setShowForm(false); resetForm(); }}>
          <div style={{ width: 520, background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusLg, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text }}>{editTarget ? (lang === 'zh' ? '編輯帳號' : 'Edit Account') : (lang === 'zh' ? '新增帳號' : 'Add Account')}</div>
              <button onClick={() => { setShowForm(false); resetForm(); }} style={{ background: 'none', border: 'none', color: TOKENS.textMuted, cursor: 'pointer' }}>{Icons.close}</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InputField label={`${lang === 'zh' ? '帳號名稱' : 'Username'} *`} value={form.username} onChange={v => setForm({ ...form, username: v })} placeholder="username" />
                <InputField label={`${lang === 'zh' ? '密碼' : 'Password'}${editTarget ? ` (${lang === 'zh' ? '留空不變' : 'blank = keep'})` : ' *'}`} value={form.password} onChange={v => setForm({ ...form, password: v })} type="password" placeholder={editTarget ? '••••••••' : (lang === 'zh' ? '設定密碼' : 'Set password')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InputField label={`${lang === 'zh' ? '顯示名稱（中）' : 'Display Name'} *`} value={form.display_name} onChange={v => setForm({ ...form, display_name: v })} placeholder={lang === 'zh' ? '王小明' : 'Display name'} />
                <InputField label={lang === 'zh' ? '顯示名稱（英）' : 'Display Name (EN)'} value={form.display_name_en} onChange={v => setForm({ ...form, display_name_en: v })} placeholder="John Doe" />
              </div>
              <InputField label="Email *" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" placeholder="user@company.com" />
              {/* Role Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{lang === 'zh' ? '角色' : 'Role'} *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.entries(ROLES).map(([k, v]) => {
                    const allowed = canAssignRole(k);
                    return (
                      <button key={k} onClick={() => allowed && setForm({ ...form, role: k })} disabled={!allowed}
                        style={{ flex: 1, padding: '10px 8px', background: form.role === k ? v.bg : TOKENS.bgInput, border: `1px solid ${form.role === k ? v.color : TOKENS.border}`, borderRadius: TOKENS.radiusSm, cursor: allowed ? 'pointer' : 'not-allowed', opacity: allowed ? 1 : 0.4, transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 16 }}>{v.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: form.role === k ? v.color : TOKENS.textSecondary }}>{lang === 'zh' ? v.label : v.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Active Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: TOKENS.bg, borderRadius: TOKENS.radiusSm, border: `1px solid ${TOKENS.border}` }}>
                <div>
                  <div style={{ fontSize: 13, color: TOKENS.text, fontWeight: 500 }}>{lang === 'zh' ? '帳號狀態' : 'Account Status'}</div>
                  <div style={{ fontSize: 11, color: TOKENS.textMuted }}>{form.active ? (lang === 'zh' ? '帳號啟用中，可正常登入' : 'Active, can log in') : (lang === 'zh' ? '帳號已停用' : 'Disabled')}</div>
                </div>
                <button onClick={() => setForm({ ...form, active: !form.active })}
                  style={{ width: 44, height: 24, borderRadius: 12, background: form.active ? TOKENS.primary : TOKENS.border, cursor: 'pointer', position: 'relative', border: 'none', padding: 0, flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, left: form.active ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
              {formError && <div style={{ padding: '8px 12px', background: TOKENS.dangerDim, borderRadius: TOKENS.radiusSm, fontSize: 12, color: TOKENS.danger }}>{formError}</div>}
            </div>
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn onClick={() => { setShowForm(false); resetForm(); }}>{lang === 'zh' ? '取消' : 'Cancel'}</Btn>
              <Btn variant="primary" onClick={handleSave}>{editTarget ? (lang === 'zh' ? '儲存變更' : 'Save Changes') : (lang === 'zh' ? '建立帳號' : 'Create Account')}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={() => setConfirmDel(null)}>
          <div style={{ width: 400, background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusLg, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text }}>{lang === 'zh' ? '確認刪除帳號' : 'Confirm Delete Account'}</div>
            <div style={{ fontSize: 13, color: TOKENS.textSecondary, lineHeight: 1.5 }}>
              {lang === 'zh' ? `確定要刪除帳號 "${confirmDel.username}" 嗎？此操作無法復原。` : `Delete account "${confirmDel.username}"? This cannot be undone.`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn onClick={() => setConfirmDel(null)}>{lang === 'zh' ? '取消' : 'Cancel'}</Btn>
              <Btn variant="danger" onClick={() => handleDelete(confirmDel.id)}>{lang === 'zh' ? '確認刪除' : 'Delete'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
