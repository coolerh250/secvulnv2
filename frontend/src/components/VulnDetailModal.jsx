import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TOKENS, ACCEPT_REASONS, t } from '../styles/tokens';
import { vulnApi, deviceVulnApi, aiApi } from '../services/api';
import { Badge, CvssBar, VulnStatusBadge, Btn, InputField, SelectField } from './ui';
import { Icons } from './Icons';

// Reusable full-detail modal for a single vulnerability.
// Parent manages which vuln is selected; this component handles all API mutations.
// Props:
//   vuln       – the vulnerability object (use key={vuln.id} to reset state on change)
//   lang       – 'zh' | 'en'
//   onClose    – () => void
//   onUpdate   – (id, updates) => void  (parent updates its local list)
//   onDelete   – (id) => void           (parent removes from its local list)
//   device     – device object; when set, uses per-device API and hides global delete
export function VulnDetailModal({ vuln, lang, onClose, onUpdate, onDelete, device }) {
  const { can } = useAuth();
  const canModify = can('search', 'modify');

  const [showAcceptModal,   setShowAcceptModal]   = useState(false);
  const [showNoteInput,     setShowNoteInput]     = useState(false);
  const [noteText,          setNoteText]          = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,          setDeleting]          = useState(false);
  const [aiResult,          setAiResult]          = useState(() => {
    try { const s = localStorage.getItem(`ai_analysis_${vuln.id}`); return s ? JSON.parse(s).analysis : null; } catch { return null; }
  });
  const [aiLoading,         setAiLoading]         = useState(false);
  const [aiMeta,            setAiMeta]            = useState(() => {
    try { const s = localStorage.getItem(`ai_analysis_${vuln.id}`); if (!s) return null; const { providerLabel, model, analyzedAt } = JSON.parse(s); return { providerLabel, model, analyzedAt }; } catch { return null; }
  });

  const handleSetStatus = async (status) => {
    if (device) {
      await deviceVulnApi.updateStatus(device.id, vuln.id, status);
    } else {
      await vulnApi.updateStatus(vuln.id, status);
    }
    onUpdate(vuln.id, { handle_status: status });
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    let res;
    if (device) {
      res = await deviceVulnApi.addNote(device.id, vuln.id, noteText.trim());
    } else {
      res = await vulnApi.addNote(vuln.id, noteText.trim());
    }
    onUpdate(vuln.id, { notes: [...(vuln.notes || []), res.data] });
    setNoteText(''); setShowNoteInput(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await vulnApi.remove(vuln.id);
      onDelete(vuln.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const runAiAnalysis = async () => {
    setAiLoading(true);
    setAiResult(null);
    setAiMeta(null);
    try {
      const res = await aiApi.analyze(vuln, lang);
      const text = res.data.analysis;
      const result = text || (lang === 'zh' ? '## 無結果\n\n模型未回傳任何內容，請確認模型設定是否正確。' : '## No Result\n\nThe model returned no content. Please verify your model configuration.');
      const meta = { providerLabel: res.data.providerLabel, model: res.data.model, analyzedAt: new Date().toISOString() };
      setAiResult(result);
      setAiMeta(meta);
      try { localStorage.setItem(`ai_analysis_${vuln.id}`, JSON.stringify({ analysis: result, ...meta })); } catch { /* storage full or disabled */ }
    } catch (err) {
      const msg = err.response?.data?.error;
      setAiResult(lang === 'zh'
        ? `## 分析失敗\n\n${msg || '發生未預期錯誤，請稍後再試'}`
        : `## Analysis Failed\n\n${msg || 'An unexpected error occurred. Please try again.'}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ width: 780, maxHeight: '90vh', overflowY: 'auto', background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusLg }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${TOKENS.border}`, position: 'sticky', top: 0, background: TOKENS.bgCard, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 16, fontWeight: 700, color: TOKENS.primary }}>{vuln.id}</span>
            <Badge severity={vuln.severity} />
            <VulnStatusBadge status={vuln.handle_status} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TOKENS.textMuted, cursor: 'pointer' }}>{Icons.close}</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Title & Description */}
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: TOKENS.text, marginBottom: 8 }}>{lang === 'zh' ? vuln.title : vuln.title_en}</div>
            <div style={{ fontSize: 14, color: TOKENS.textSecondary, lineHeight: 1.6 }}>{lang === 'zh' ? vuln.description : vuln.description_en}</div>
          </div>

          {/* CVSS + Source */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 14, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
              <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>{t(lang, 'cvss')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28, fontWeight: 700, fontFamily: TOKENS.mono, color: vuln.cvss >= 9 ? TOKENS.danger : vuln.cvss >= 7 ? TOKENS.warning : TOKENS.medium }}>{Number(vuln.cvss).toFixed(1)}</span>
                <div style={{ flex: 1, height: 8, background: TOKENS.border, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${vuln.cvss * 10}%`, height: '100%', background: vuln.cvss >= 9 ? TOKENS.danger : vuln.cvss >= 7 ? TOKENS.warning : TOKENS.medium, borderRadius: 4 }} />
                </div>
              </div>
            </div>
            <div style={{ padding: 14, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
              <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>{t(lang, 'source')}</div>
              <div style={{ fontSize: 14, color: TOKENS.text }}>{vuln.source}</div>
              <div style={{ fontSize: 12, color: TOKENS.textMuted, marginTop: 4 }}>{vuln.published}</div>
            </div>
          </div>

          {/* Affected versions */}
          <div style={{ padding: 14, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
            <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>{t(lang, 'affected')}</div>
            <div style={{ fontSize: 13, color: TOKENS.text, fontFamily: TOKENS.mono, marginBottom: 6 }}>{vuln.vendor}</div>
            {(vuln.affected_products?.length > 0 ? vuln.affected_products : (vuln.product ? [vuln.product] : [])).map((p, i) => (
              <span key={i} style={{ display: 'inline-block', marginRight: 6, marginBottom: 6, padding: '2px 8px', background: TOKENS.primaryDim, borderRadius: 4, fontSize: 12, fontFamily: TOKENS.mono, color: TOKENS.primary }}>{p}</span>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {(vuln.firmware_versions || []).map((f, i) => (
                <span key={i} style={{ padding: '2px 8px', background: TOKENS.warningDim, borderRadius: 4, fontSize: 12, fontFamily: TOKENS.mono, color: TOKENS.warning }}>{f}</span>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div style={{ padding: 14, background: TOKENS.primaryDim, borderRadius: TOKENS.radius, border: `1px solid rgba(0,212,170,0.2)` }}>
            <div style={{ fontSize: 11, color: TOKENS.primary, marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>{t(lang, 'recommendation')}</div>
            <div style={{ fontSize: 14, color: TOKENS.text }}>{lang === 'zh' ? vuln.recommendation : vuln.recommendation_en}</div>
          </div>

          {/* Actions */}
          {canModify ? (
            <div style={{ padding: 16, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
              <div style={{ fontSize: 12, color: TOKENS.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{lang === 'zh' ? '處理動作' : 'Actions'}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant={vuln.handle_status === 'fixed' ? 'primary' : 'default'} onClick={() => handleSetStatus('fixed')} icon={Icons.check}>
                  {lang === 'zh' ? '標記已修復' : 'Mark Fixed'}
                </Btn>
                <Btn variant={vuln.handle_status === 'accepted' ? 'primary' : 'default'} onClick={() => setShowAcceptModal(true)}
                  style={{ background: vuln.handle_status === 'accepted' ? 'rgba(176,128,224,0.25)' : undefined, color: vuln.handle_status === 'accepted' ? '#b080e0' : undefined }}>
                  {lang === 'zh' ? '風險接受' : 'Accept Risk'}
                </Btn>
                <Btn variant={vuln.handle_status === 'deferred' ? 'primary' : 'default'} onClick={() => handleSetStatus('deferred')}
                  style={{ background: vuln.handle_status === 'deferred' ? TOKENS.infoDim : undefined, color: vuln.handle_status === 'deferred' ? TOKENS.info : undefined }}>
                  {lang === 'zh' ? '暫不處理' : 'Defer'}
                </Btn>
                {vuln.handle_status !== 'pending' && (
                  <Btn variant="ghost" onClick={() => handleSetStatus('pending')}>{lang === 'zh' ? '重設為待處理' : 'Reset to Pending'}</Btn>
                )}
                {!device && (
                  <Btn icon={Icons.trash} onClick={() => setShowDeleteConfirm(true)}
                    style={{ marginLeft: 'auto', color: TOKENS.danger, background: TOKENS.dangerDim, border: `1px solid ${TOKENS.danger}40` }}>
                    {lang === 'zh' ? '刪除此弱點' : 'Delete Vulnerability'}
                  </Btn>
                )}
              </div>
              {showDeleteConfirm && (
                <div style={{ marginTop: 12, padding: 14, background: TOKENS.dangerDim, borderRadius: TOKENS.radiusSm, border: `1px solid ${TOKENS.danger}50` }}>
                  <div style={{ fontSize: 13, color: TOKENS.danger, fontWeight: 600, marginBottom: 10 }}>
                    {lang === 'zh' ? `⚠ 確認要永久刪除 ${vuln.id}？此操作無法復原。` : `⚠ Permanently delete ${vuln.id}? This cannot be undone.`}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>{lang === 'zh' ? '取消' : 'Cancel'}</Btn>
                    <Btn onClick={handleDelete} disabled={deleting} style={{ background: TOKENS.danger, color: '#fff', border: 'none' }}>
                      {deleting ? (lang === 'zh' ? '刪除中...' : 'Deleting...') : (lang === 'zh' ? '確認刪除' : 'Confirm Delete')}
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 12, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: TOKENS.textMuted }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>
              {lang === 'zh' ? '您的角色僅能查看，無法執行處理動作' : 'Your role is read-only and cannot perform actions'}
            </div>
          )}

          {/* Risk Acceptance Record */}
          {vuln.handle_status === 'accepted' && vuln.riskAcceptance && (
            <div style={{ padding: 16, background: 'rgba(176,128,224,0.06)', borderRadius: TOKENS.radius, border: `1px solid rgba(176,128,224,0.2)` }}>
              <div style={{ fontSize: 12, color: '#b080e0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{lang === 'zh' ? '風險接受記錄' : 'Risk Acceptance Record'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                <div>
                  <div style={{ color: TOKENS.textMuted, fontSize: 11, marginBottom: 2 }}>{lang === 'zh' ? '接受理由' : 'Reason'}</div>
                  <div style={{ color: TOKENS.text }}>{(ACCEPT_REASONS[lang] || ACCEPT_REASONS.en).find(r => r.value === vuln.riskAcceptance.reason)?.label || vuln.riskAcceptance.reason}</div>
                </div>
                <div>
                  <div style={{ color: TOKENS.textMuted, fontSize: 11, marginBottom: 2 }}>{lang === 'zh' ? '重新評估日期' : 'Review Date'}</div>
                  <div style={{ color: TOKENS.text, fontFamily: TOKENS.mono }}>{vuln.riskAcceptance.review_date || vuln.riskAcceptance.reviewDate}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ color: TOKENS.textMuted, fontSize: 11, marginBottom: 2 }}>{lang === 'zh' ? '緩解措施' : 'Mitigation'}</div>
                  <div style={{ color: TOKENS.text }}>{lang === 'zh' ? vuln.riskAcceptance.mitigation : (vuln.riskAcceptance.mitigation_en || vuln.riskAcceptance.mitigation)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ padding: 16, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{lang === 'zh' ? '處理備註' : 'Notes'} ({(vuln.notes || []).length})</div>
              {canModify && <Btn variant="ghost" icon={Icons.plus} onClick={() => setShowNoteInput(!showNoteInput)} style={{ fontSize: 12 }}>{lang === 'zh' ? '新增備註' : 'Add Note'}</Btn>}
            </div>
            {showNoteInput && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={noteText} onChange={e => setNoteText(e.target.value)}
                  placeholder={lang === 'zh' ? '輸入備註...' : 'Enter note...'}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                  style={{ flex: 1, padding: '8px 12px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 13, fontFamily: TOKENS.font, outline: 'none' }} />
                <Btn variant="primary" onClick={handleAddNote} disabled={!noteText.trim()}>{lang === 'zh' ? '儲存' : 'Save'}</Btn>
              </div>
            )}
            {(vuln.notes || []).length === 0 && !showNoteInput && (
              <div style={{ fontSize: 13, color: TOKENS.textMuted, padding: '8px 0' }}>{lang === 'zh' ? '尚無備註' : 'No notes yet'}</div>
            )}
            {(vuln.notes || []).map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i > 0 ? `1px solid ${TOKENS.border}` : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: TOKENS.primaryDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: TOKENS.primary, fontWeight: 600, flexShrink: 0 }}>{(n.author)?.[0] || 'A'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.text }}>{n.author}</span>
                    <span style={{ fontSize: 11, color: TOKENS.textMuted, fontFamily: TOKENS.mono }}>{n.created_at ? new Date(n.created_at).toLocaleDateString() : n.date}</span>
                  </div>
                  <div style={{ fontSize: 13, color: TOKENS.textSecondary, lineHeight: 1.5 }}>{n.text}</div>
                </div>
              </div>
            ))}
          </div>

          {/* References */}
          <div>
            <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>{t(lang, 'references')}</div>
            {(vuln.refs || []).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {Icons.external}
                <a href={r} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: TOKENS.primary, textDecoration: 'none', fontFamily: TOKENS.mono, wordBreak: 'break-all' }}>{r}</a>
              </div>
            ))}
          </div>

          {/* AI Analysis */}
          {can('aiAnalysis', 'view') && (
            <div style={{ borderTop: `1px solid ${TOKENS.border}`, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{Icons.ai}<span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>{t(lang, 'aiAnalysis')}</span></div>
                <Btn variant="primary" icon={Icons.ai} onClick={runAiAnalysis} disabled={aiLoading}>{aiLoading ? t(lang, 'analyzing') : t(lang, 'analyzeVuln')}</Btn>
              </div>
              {aiLoading && (
                <div style={{ padding: 20, textAlign: 'center' }}>
                  <div style={{ width: 24, height: 24, border: `2px solid ${TOKENS.border}`, borderTop: `2px solid ${TOKENS.primary}`, borderRadius: '50%', margin: '0 auto 8px', animation: 'spin 0.8s linear infinite' }} />
                  <div style={{ fontSize: 13, color: TOKENS.textSecondary }}>{t(lang, 'analyzing')}</div>
                </div>
              )}
              {aiResult && (
                <div>
                  <div style={{ padding: 16, background: TOKENS.bg, borderRadius: TOKENS.radius, border: `1px solid ${TOKENS.border}`, fontSize: 13, color: TOKENS.text, lineHeight: 1.7 }}>
                    {aiResult.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) return <div key={i} style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, marginTop: i > 0 ? 16 : 0, color: TOKENS.primary }}>{line.replace('## ', '')}</div>;
                      if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 600, marginTop: 8, color: TOKENS.text }}>{line.replace(/\*\*/g, '')}</div>;
                      if (line.match(/^[-–•]\s/)) return <div key={i} style={{ paddingLeft: 16, color: TOKENS.textSecondary }}>{line}</div>;
                      if (line.match(/^\d+\./)) return <div key={i} style={{ paddingLeft: 16, color: TOKENS.textSecondary }}>{line}</div>;
                      return <div key={i}>{line}</div>;
                    })}
                  </div>
                  {aiMeta && (
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                      {Icons.ai}
                      <span style={{ fontSize: 11, color: TOKENS.textMuted }}>
                        {lang === 'zh' ? '由' : 'Generated by'} <span style={{ color: TOKENS.primary, fontWeight: 600 }}>{aiMeta.providerLabel}</span> · <span style={{ fontFamily: TOKENS.mono }}>{aiMeta.model}</span>
                        {aiMeta.analyzedAt && <span> · {new Date(aiMeta.analyzedAt).toLocaleString()}</span>}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Risk Acceptance Modal */}
      {showAcceptModal && (
        <RiskAcceptModal vuln={vuln} lang={lang} onClose={() => setShowAcceptModal(false)}
          onSave={async (data) => {
            if (device) {
              await deviceVulnApi.setRiskAcceptance(device.id, vuln.id, data);
            } else {
              await vulnApi.setRiskAcceptance(vuln.id, data);
            }
            onUpdate(vuln.id, { handle_status: 'accepted', riskAcceptance: { ...data, accepted_date: new Date().toISOString().slice(0, 10) } });
            setShowAcceptModal(false);
          }} />
      )}
    </div>
  );
}

function RiskAcceptModal({ vuln, lang, onClose, onSave }) {
  const [reason,       setReason]       = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [mitigation,   setMitigation]   = useState('');
  const [reviewDate,   setReviewDate]   = useState('');
  const [note,         setNote]         = useState('');
  const reasons = ACCEPT_REASONS[lang] || ACCEPT_REASONS.en;
  const canSave = reason && mitigation && reviewDate;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ width: 560, background: TOKENS.bgCard, border: `1px solid rgba(176,128,224,0.3)`, borderRadius: TOKENS.radiusLg, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text }}>{lang === 'zh' ? '風險接受' : 'Risk Acceptance'}</div>
            <div style={{ fontSize: 12, color: TOKENS.textMuted, marginTop: 2 }}>{vuln.id} — {lang === 'zh' ? vuln.title : vuln.title_en}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TOKENS.textMuted, cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SelectField label={`${lang === 'zh' ? '接受理由' : 'Reason'} *`} value={reason} onChange={setReason}
            options={[{ value: '', label: lang === 'zh' ? '請選擇...' : 'Select...' }, ...reasons]} />
          {reason === 'other' && (
            <InputField label={lang === 'zh' ? '詳細說明' : 'Details'} value={reasonDetail} onChange={setReasonDetail}
              placeholder={lang === 'zh' ? '請說明理由...' : 'Please specify...'} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: TOKENS.textSecondary, fontWeight: 500 }}>{`${lang === 'zh' ? '緩解措施' : 'Mitigation Measures'} *`}</label>
            <textarea value={mitigation} onChange={e => setMitigation(e.target.value)} rows={3}
              placeholder={lang === 'zh' ? '說明已採取的補償控制或緩解措施...' : 'Describe compensating controls or mitigations...'}
              style={{ width: '100%', padding: '8px 12px', background: TOKENS.bgInput, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusSm, color: TOKENS.text, fontSize: 13, fontFamily: TOKENS.font, outline: 'none', resize: 'vertical' }} />
          </div>
          <InputField label={`${lang === 'zh' ? '重新評估日期' : 'Review Date'} *`} value={reviewDate} onChange={setReviewDate} type="date" />
          <InputField label={lang === 'zh' ? '備註（選填）' : 'Note (optional)'} value={note} onChange={setNote}
            placeholder={lang === 'zh' ? '其他備註...' : 'Additional notes...'} />
          <div style={{ padding: 10, background: TOKENS.warningDim, borderRadius: TOKENS.radiusSm, border: `1px solid rgba(240,160,48,0.2)`, fontSize: 12, color: TOKENS.warning, lineHeight: 1.5 }}>
            {lang === 'zh' ? '⚠ 風險接受表示您已評估此弱點並決定暫不修復。' : '⚠ Risk acceptance means you have evaluated and decided not to remediate.'}
          </div>
        </div>
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn onClick={onClose}>{lang === 'zh' ? '取消' : 'Cancel'}</Btn>
          <Btn variant="primary" onClick={() => onSave({ reason, reason_detail: reasonDetail, mitigation, review_date: reviewDate, note })}
            disabled={!canSave} style={{ background: canSave ? '#b080e0' : undefined }}>
            {lang === 'zh' ? '確認接受風險' : 'Confirm Risk Acceptance'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
