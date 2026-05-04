// Devices Page
function DevicesPage() {
  const lang = useLang();
  const auth = typeof useAuth === 'function' ? useAuth() : null;
  const canModify = auth ? auth.can('devices', 'modify') : true;
  const [devices, setDevices] = React.useState(MOCK_DEVICES);
  const [showAdd, setShowAdd] = React.useState(false);
  const [editId, setEditId] = React.useState(null);
  const [form, setForm] = React.useState({ name: '', vendor: 'Fortinet', model: '', firmware: '' });
  const [scanning, setScanning] = React.useState(null);

  const statusStyle = (s) => {
    const map = { vulnerable: { color: TOKENS.danger, bg: TOKENS.dangerDim, label: t(lang, 'vulnerable'), labelEn: 'Vulnerable' }, upToDate: { color: TOKENS.low, bg: TOKENS.lowDim, label: t(lang, 'upToDate'), labelEn: 'Up to Date' }, updateAvail: { color: TOKENS.warning, bg: TOKENS.warningDim, label: t(lang, 'updateAvail'), labelEn: 'Update Available' } };
    const m = map[s] || map.upToDate;
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: m.color, background: m.bg }}>● {lang === 'zh' ? m.label : m.labelEn}</span>;
  };

  const handleAdd = () => {
    const newDev = { id: Date.now(), name: form.name, nameEn: form.name, vendor: form.vendor, model: form.model, firmware: form.firmware, status: 'upToDate', lastCheck: new Date().toISOString().slice(0, 10), vulnCount: 0 };
    setDevices([...devices, newDev]);
    setShowAdd(false);
    setForm({ name: '', vendor: 'Fortinet', model: '', firmware: '' });
  };

  const handleEdit = (dev) => { setEditId(dev.id); setForm({ name: lang === 'zh' ? dev.name : dev.nameEn, vendor: dev.vendor, model: dev.model, firmware: dev.firmware }); };

  const handleSaveEdit = () => {
    setDevices(devices.map(d => d.id === editId ? { ...d, name: form.name, nameEn: form.name, vendor: form.vendor, model: form.model, firmware: form.firmware } : d));
    setEditId(null);
    setForm({ name: '', vendor: 'Fortinet', model: '', firmware: '' });
  };

  const handleDelete = (id) => setDevices(devices.filter(d => d.id !== id));

  const handleScan = async (id) => {
    setScanning(id);
    await new Promise(r => setTimeout(r, 2000));
    setDevices(devices.map(d => d.id === id ? { ...d, lastCheck: new Date().toISOString().slice(0, 10), status: Math.random() > 0.5 ? 'vulnerable' : 'upToDate', vulnCount: Math.floor(Math.random() * 3) } : d));
    setScanning(null);
  };

  const DeviceForm = ({ onSave, onCancel }) => (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
        <InputField label={t(lang, 'deviceName')} value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder={lang === 'zh' ? '例：總部防火牆' : 'e.g. HQ Firewall'} />
        <SelectField label={t(lang, 'vendor')} value={form.vendor} onChange={v => setForm({ ...form, vendor: v })} options={[{ value: 'Fortinet', label: 'Fortinet' }, { value: 'Palo Alto', label: 'Palo Alto' }]} />
        <InputField label={t(lang, 'model')} value={form.model} onChange={v => setForm({ ...form, model: v })} placeholder="e.g. FortiGate 60F" />
        <InputField label={t(lang, 'firmwareVer')} value={form.firmware} onChange={v => setForm({ ...form, firmware: v })} placeholder="e.g. 7.0.14" />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onCancel}>{t(lang, 'cancel')}</Btn>
        <Btn variant="primary" onClick={onSave} disabled={!form.name || !form.model || !form.firmware}>{t(lang, 'save')}</Btn>
      </div>
    </Card>
  );

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: TOKENS.text }}>{t(lang, 'deviceList')} <span style={{ fontSize: 13, fontWeight: 400, color: TOKENS.textMuted }}>({devices.length})</span></div>
        {canModify && <Btn variant="primary" icon={Icons.plus} onClick={() => { setShowAdd(true); setEditId(null); setForm({ name: '', vendor: 'Fortinet', model: '', firmware: '' }); }}>{t(lang, 'addDevice')}</Btn>}
      </div>

      {showAdd && <DeviceForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />}
      {editId && <DeviceForm onSave={handleSaveEdit} onCancel={() => setEditId(null)} />}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[{ label: lang === 'zh' ? '存在弱點' : 'Vulnerable', count: devices.filter(d => d.status === 'vulnerable').length, color: TOKENS.danger },
          { label: lang === 'zh' ? '有更新可用' : 'Update Available', count: devices.filter(d => d.status === 'updateAvail').length, color: TOKENS.warning },
          { label: lang === 'zh' ? '已是最新' : 'Up to Date', count: devices.filter(d => d.status === 'upToDate').length, color: TOKENS.low }
        ].map((s, i) => (
          <Card key={i} style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{s.label}</span>
              <span style={{ fontSize: 24, fontWeight: 700, fontFamily: TOKENS.mono, color: s.color }}>{s.count}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Device Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 100px 100px 80px 100px 140px', gap: 0, padding: '10px 16px', borderBottom: `1px solid ${TOKENS.border}`, background: 'rgba(255,255,255,0.02)' }}>
          {[t(lang, 'deviceName'), t(lang, 'vendor'), t(lang, 'model'), t(lang, 'firmwareVer'), t(lang, 'status'), lang === 'zh' ? '弱點數' : 'Vulns', t(lang, 'lastCheck'), t(lang, 'actions')].map(h => (
            <span key={h} style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{h}</span>
          ))}
        </div>
        {devices.map(d => (
          <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 100px 100px 80px 100px 140px', gap: 0, padding: '12px 16px', borderBottom: `1px solid ${TOKENS.border}`, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: TOKENS.text }}>{lang === 'zh' ? d.name : d.nameEn}</span>
            <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{d.vendor}</span>
            <span style={{ fontSize: 12, color: TOKENS.text, fontFamily: TOKENS.mono }}>{d.model}</span>
            <span style={{ fontSize: 12, color: TOKENS.primary, fontFamily: TOKENS.mono }}>{d.firmware}</span>
            {statusStyle(d.status)}
            <span style={{ fontSize: 13, fontFamily: TOKENS.mono, fontWeight: 600, color: d.vulnCount > 0 ? TOKENS.danger : TOKENS.low }}>{d.vulnCount}</span>
            <span style={{ fontSize: 12, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>{d.lastCheck}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {canModify && <button onClick={() => handleScan(d.id)} disabled={scanning === d.id} style={{ background: 'none', border: 'none', color: TOKENS.primary, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }} title={t(lang, 'check')}>
                {scanning === d.id ? <span style={{ fontSize: 11 }}>{t(lang, 'scanning')}</span> : Icons.refresh}
              </button>}
              {canModify && <button onClick={() => handleEdit(d)} style={{ background: 'none', border: 'none', color: TOKENS.textSecondary, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }} title={t(lang, 'edit')}>{Icons.edit}</button>}
              {canModify && <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: 'none', color: TOKENS.danger, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }} title={t(lang, 'delete')}>{Icons.trash}</button>}
              {!canModify && <span style={{ fontSize: 11, color: TOKENS.textMuted, padding: '4px 0' }}>—</span>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

window.DevicesPage = DevicesPage;
