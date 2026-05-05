import { useState, useEffect } from 'react';
import { TOKENS, t } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import { deviceApi } from '../services/api';
import { Card, Btn, InputField, SelectField } from '../components/ui';
import { Icons } from '../components/Icons';

function DeviceForm({ form, setForm, lang, onSave, onCancel }) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
        <InputField label={t(lang, 'deviceName')} value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder={lang === 'zh' ? '例：總部防火牆' : 'e.g. HQ Firewall'} />
        <SelectField label={t(lang, 'vendor')} value={form.vendor} onChange={v => setForm({ ...form, vendor: v })} options={[{ value: 'Fortinet', label: 'Fortinet' }, { value: 'Palo Alto', label: 'Palo Alto' }]} />
        <InputField label={t(lang, 'model')}       value={form.model}    onChange={v => setForm({ ...form, model: v })}    placeholder="e.g. FortiGate 60F" />
        <InputField label={t(lang, 'firmwareVer')} value={form.firmware} onChange={v => setForm({ ...form, firmware: v })} placeholder="e.g. 7.0.14" />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onCancel}>{t(lang, 'cancel')}</Btn>
        <Btn variant="primary" onClick={onSave} disabled={!form.name || !form.model || !form.firmware}>{t(lang, 'save')}</Btn>
      </div>
    </Card>
  );
}

const STATUS_MAP = {
  vulnerable:  { color: '#f04040', bg: 'rgba(240,64,64,0.12)',  labelZh: '存在弱點',    labelEn: 'Vulnerable' },
  upToDate:    { color: '#50b080', bg: 'rgba(80,176,128,0.12)', labelZh: '已是最新',    labelEn: 'Up to Date' },
  updateAvail: { color: '#f0a030', bg: 'rgba(240,160,48,0.12)', labelZh: '有更新可用',  labelEn: 'Update Available' },
};

function StatusBadge({ status, lang }) {
  const m = STATUS_MAP[status] || STATUS_MAP.upToDate;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: m.color, background: m.bg }}>
      ● {lang === 'zh' ? m.labelZh : m.labelEn}
    </span>
  );
}

export function DevicesPage() {
  const { lang } = useLang();
  const { can } = useAuth();
  const canModify = can('devices', 'modify');
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId,  setEditId]  = useState(null);
  const [scanning,    setScanning]    = useState(null);
  const [scanningAll, setScanningAll] = useState(false);
  const [form, setForm] = useState({ name: '', vendor: 'Fortinet', model: '', firmware: '' });

  useEffect(() => {
    deviceApi.list().then(res => setDevices(res.data)).finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    const res = await deviceApi.create({ ...form, name_en: form.name });
    setDevices(prev => [...prev, res.data]);
    setShowAdd(false); setForm({ name: '', vendor: 'Fortinet', model: '', firmware: '' });
  };

  const handleEdit = (dev) => {
    setEditId(dev.id);
    setForm({ name: lang === 'zh' ? dev.name : (dev.name_en || dev.name), vendor: dev.vendor, model: dev.model, firmware: dev.firmware });
  };

  const handleSaveEdit = async () => {
    const res = await deviceApi.update(editId, { ...form, name_en: form.name });
    setDevices(prev => prev.map(d => d.id === editId ? res.data : d));
    setEditId(null); setForm({ name: '', vendor: 'Fortinet', model: '', firmware: '' });
  };

  const handleDelete = async (id) => {
    await deviceApi.remove(id);
    setDevices(prev => prev.filter(d => d.id !== id));
  };

  const handleScanAll = async () => {
    setScanningAll(true);
    try {
      const res = await deviceApi.scanAll();
      setDevices(res.data.devices);
    } finally {
      setScanningAll(false);
    }
  };

  const handleScan = async (id) => {
    setScanning(id);
    try {
      const res = await deviceApi.scan(id);
      setDevices(prev => prev.map(d => d.id === id ? res.data : d));
    } finally {
      setScanning(null);
    }
  };

  if (loading) return (
    <div style={{ padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${TOKENS.border}`, borderTop: `3px solid ${TOKENS.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: TOKENS.text }}>{t(lang, 'deviceList')} <span style={{ fontSize: 13, fontWeight: 400, color: TOKENS.textMuted }}>({devices.length})</span></div>
        {canModify && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn icon={Icons.refresh} onClick={handleScanAll} disabled={scanningAll}>
              {scanningAll ? (lang === 'zh' ? '掃描中...' : 'Scanning...') : (lang === 'zh' ? '重新比對所有設備' : 'Re-scan All')}
            </Btn>
            <Btn variant="primary" icon={Icons.plus} onClick={() => { setShowAdd(true); setEditId(null); setForm({ name: '', vendor: 'Fortinet', model: '', firmware: '' }); }}>
              {t(lang, 'addDevice')}
            </Btn>
          </div>
        )}
      </div>

      {showAdd  && <DeviceForm form={form} setForm={setForm} lang={lang} onSave={handleAdd}      onCancel={() => setShowAdd(false)} />}
      {editId   && <DeviceForm form={form} setForm={setForm} lang={lang} onSave={handleSaveEdit} onCancel={() => setEditId(null)}  />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[{ label: lang === 'zh' ? '存在弱點' : 'Vulnerable',       count: devices.filter(d => d.status === 'vulnerable').length,  color: TOKENS.danger },
          { label: lang === 'zh' ? '有更新可用' : 'Update Available', count: devices.filter(d => d.status === 'updateAvail').length, color: TOKENS.warning },
          { label: lang === 'zh' ? '已是最新' : 'Up to Date',        count: devices.filter(d => d.status === 'upToDate').length,    color: TOKENS.low },
        ].map((s, i) => (
          <Card key={i} style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{s.label}</span>
              <span style={{ fontSize: 24, fontWeight: 700, fontFamily: TOKENS.mono, color: s.color }}>{s.count}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 100px 100px 80px 100px 140px', padding: '10px 16px', borderBottom: `1px solid ${TOKENS.border}`, background: 'rgba(255,255,255,0.02)' }}>
          {[t(lang, 'deviceName'), t(lang, 'vendor'), t(lang, 'model'), t(lang, 'firmwareVer'), t(lang, 'status'), lang === 'zh' ? '弱點數' : 'Vulns', t(lang, 'lastCheck'), t(lang, 'actions')].map(h => (
            <span key={h} style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textSecondary }}>{h}</span>
          ))}
        </div>
        {devices.map(d => (
          <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 100px 100px 80px 100px 140px', padding: '12px 16px', borderBottom: `1px solid ${TOKENS.border}`, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: TOKENS.text }}>{lang === 'zh' ? d.name : (d.name_en || d.name)}</span>
            <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{d.vendor}</span>
            <span style={{ fontSize: 12, color: TOKENS.text, fontFamily: TOKENS.mono }}>{d.model}</span>
            <span style={{ fontSize: 12, color: TOKENS.primary, fontFamily: TOKENS.mono }}>{d.firmware}</span>
            <StatusBadge status={d.status} lang={lang} />
            <span style={{ fontSize: 13, fontFamily: TOKENS.mono, fontWeight: 600, color: d.vuln_count > 0 ? TOKENS.danger : TOKENS.low }}>{d.vuln_count}</span>
            <span style={{ fontSize: 12, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>{d.last_check}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {canModify && (
                <button onClick={() => handleScan(d.id)} disabled={scanning === d.id}
                  style={{ background: 'none', border: 'none', color: TOKENS.primary, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}
                  title={t(lang, 'check')}>
                  {scanning === d.id ? <span style={{ fontSize: 11 }}>{t(lang, 'scanning')}</span> : Icons.refresh}
                </button>
              )}
              {canModify && (
                <button onClick={() => handleEdit(d)} style={{ background: 'none', border: 'none', color: TOKENS.textSecondary, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }} title={t(lang, 'edit')}>{Icons.edit}</button>
              )}
              {canModify && (
                <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: 'none', color: TOKENS.danger, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }} title={t(lang, 'delete')}>{Icons.trash}</button>
              )}
              {!canModify && <span style={{ fontSize: 11, color: TOKENS.textMuted }}>—</span>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
