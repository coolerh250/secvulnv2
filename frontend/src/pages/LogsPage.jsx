import { useState, useCallback } from 'react';
import { TOKENS } from '../styles/tokens';
import { useLang } from '../contexts/LangContext';
import { auditApi } from '../services/api';

const CATEGORY_BADGE = {
  auth:          { color: TOKENS.primary,       bg: TOKENS.primaryDim },
  settings:      { color: TOKENS.warning,       bg: TOKENS.warningDim },
  vulnerability: { color: TOKENS.danger,        bg: TOKENS.dangerDim },
  device:        { color: TOKENS.info,          bg: TOKENS.infoDim },
  user:          { color: TOKENS.textSecondary, bg: 'rgba(120,128,160,0.12)' },
  ai:            { color: TOKENS.medium,        bg: TOKENS.mediumDim },
};

const CATEGORIES = ['auth', 'settings', 'vulnerability', 'device', 'user', 'ai'];

const inputStyle = {
  background: TOKENS.bgInput,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: TOKENS.radiusSm,
  color: TOKENS.text,
  padding: '7px 10px',
  fontSize: 13,
  fontFamily: TOKENS.font,
  outline: 'none',
};

function CategoryBadge({ category }) {
  const style = CATEGORY_BADGE[category] || { color: TOKENS.textSecondary, bg: 'rgba(120,128,160,0.12)' };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      color: style.color, background: style.bg, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {category}
    </span>
  );
}

function DetailSummary({ detail }) {
  if (!detail || Object.keys(detail).length === 0) return <span style={{ color: TOKENS.textMuted }}>—</span>;
  const entries = Object.entries(detail).slice(0, 3);
  return (
    <span style={{ fontSize: 12, color: TOKENS.textSecondary, fontFamily: TOKENS.mono }}>
      {entries.map(([k, v]) => {
        const val = Array.isArray(v) ? v.join(', ') : String(v);
        return `${k}: ${val.length > 40 ? val.slice(0, 40) + '…' : val}`;
      }).join(' | ')}
    </span>
  );
}

function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
      <button onClick={() => onPage(1)} disabled={page === 1} style={pageBtnStyle(page === 1)}>«</button>
      <button onClick={() => onPage(page - 1)} disabled={page === 1} style={pageBtnStyle(page === 1)}>‹</button>
      {Array.from({ length: Math.min(5, pages) }, (_, i) => {
        const start = Math.max(1, Math.min(page - 2, pages - 4));
        const p = start + i;
        return (
          <button key={p} onClick={() => onPage(p)} style={pageBtnStyle(false, p === page)}>
            {p}
          </button>
        );
      })}
      <button onClick={() => onPage(page + 1)} disabled={page === pages} style={pageBtnStyle(page === pages)}>›</button>
      <button onClick={() => onPage(pages)} disabled={page === pages} style={pageBtnStyle(page === pages)}>»</button>
    </div>
  );
}

function pageBtnStyle(disabled, active = false) {
  return {
    minWidth: 30, padding: '4px 8px', borderRadius: TOKENS.radiusSm, fontSize: 13,
    border: `1px solid ${active ? TOKENS.primary : TOKENS.border}`,
    background: active ? TOKENS.primaryDim : 'transparent',
    color: disabled ? TOKENS.textMuted : active ? TOKENS.primary : TOKENS.textSecondary,
    cursor: disabled ? 'default' : 'pointer', fontFamily: TOKENS.font,
  };
}

export function LogsPage() {
  const { lang } = useLang();
  const isZh = lang === 'zh';

  const [filters, setFilters] = useState({ keyword: '', category: '', username: '', dateFrom: '', dateTo: '' });
  const [pending, setPending] = useState({ keyword: '', category: '', username: '', dateFrom: '', dateTo: '' });
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchLogs = useCallback(async (appliedFilters, p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 50 };
      if (appliedFilters.keyword)  params.keyword  = appliedFilters.keyword;
      if (appliedFilters.category) params.category = appliedFilters.category;
      if (appliedFilters.username) params.username = appliedFilters.username;
      if (appliedFilters.dateFrom) params.dateFrom = appliedFilters.dateFrom;
      if (appliedFilters.dateTo)   params.dateTo   = appliedFilters.dateTo;
      const res = await auditApi.list(params);
      setData(res.data.data);
      setTotal(res.data.total);
      setPage(res.data.page);
      setPages(res.data.pages);
      setSearched(true);
    } catch (err) {
      console.error('Fetch audit logs error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    setFilters({ ...pending });
    fetchLogs(pending, 1);
  };

  const handlePage = (p) => {
    fetchLogs(filters, p);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div style={{ padding: 24, maxWidth: 1300, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: TOKENS.text, margin: 0 }}>
          {isZh ? '稽核日誌' : 'Audit Logs'}
        </h1>
        <p style={{ fontSize: 13, color: TOKENS.textSecondary, margin: '4px 0 0' }}>
          {isZh ? '追蹤系統內所有重要操作紀錄' : 'Track all significant operations in the system'}
        </p>
      </div>

      {/* Filter bar */}
      <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: TOKENS.textSecondary }}>{isZh ? '關鍵字' : 'Keyword'}</label>
            <input
              style={{ ...inputStyle, width: 200 }}
              placeholder={isZh ? '搜尋動作、使用者、對象…' : 'Search action, user, target…'}
              value={pending.keyword}
              onChange={e => setPending(p => ({ ...p, keyword: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: TOKENS.textSecondary }}>{isZh ? '分類' : 'Category'}</label>
            <select
              style={{ ...inputStyle, width: 140, cursor: 'pointer' }}
              value={pending.category}
              onChange={e => setPending(p => ({ ...p, category: e.target.value }))}
            >
              <option value="">{isZh ? '全部' : 'All'}</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: TOKENS.textSecondary }}>{isZh ? '使用者' : 'Username'}</label>
            <input
              style={{ ...inputStyle, width: 140 }}
              placeholder={isZh ? '使用者名稱' : 'Username'}
              value={pending.username}
              onChange={e => setPending(p => ({ ...p, username: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: TOKENS.textSecondary }}>{isZh ? '開始日期' : 'From'}</label>
            <input type="date" style={{ ...inputStyle, width: 140 }} value={pending.dateFrom}
              onChange={e => setPending(p => ({ ...p, dateFrom: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: TOKENS.textSecondary }}>{isZh ? '結束日期' : 'To'}</label>
            <input type="date" style={{ ...inputStyle, width: 140 }} value={pending.dateTo}
              onChange={e => setPending(p => ({ ...p, dateTo: e.target.value }))} />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{ padding: '7px 20px', background: TOKENS.primary, color: '#000', border: 'none', borderRadius: TOKENS.radiusSm, fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: TOKENS.font, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (isZh ? '查詢中…' : 'Loading…') : (isZh ? '查詢' : 'Search')}
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: TOKENS.textSecondary }}>
              {isZh ? `共 ${total} 筆紀錄` : `${total} records found`}
            </span>
          </div>

          {data.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: TOKENS.textMuted }}>
              {isZh ? '無符合條件的紀錄' : 'No records found'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                    {[
                      isZh ? '時間' : 'Time',
                      isZh ? '分類' : 'Category',
                      isZh ? '動作' : 'Action',
                      isZh ? '操作者' : 'User',
                      isZh ? '對象' : 'Target',
                      isZh ? '詳情' : 'Detail',
                    ].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: TOKENS.textSecondary, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map(row => (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${TOKENS.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = TOKENS.bgCardHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 14px', color: TOKENS.textSecondary, whiteSpace: 'nowrap', fontFamily: TOKENS.mono, fontSize: 12 }}>
                        {new Date(row.created_at).toLocaleString(isZh ? 'zh-TW' : 'en-US')}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <CategoryBadge category={row.category} />
                      </td>
                      <td style={{ padding: '10px 14px', color: TOKENS.text, fontFamily: TOKENS.mono, fontSize: 12 }}>
                        {row.action}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: TOKENS.text, fontWeight: 500 }}>{row.username || '—'}</span>
                        {row.role && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: TOKENS.textMuted }}>({row.role})</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: TOKENS.textSecondary, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.target_name || row.target_id || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: 280 }}>
                        <DetailSummary detail={row.detail} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} pages={pages} onPage={handlePage} />
        </div>
      )}

      {!searched && (
        <div style={{ textAlign: 'center', padding: 64, color: TOKENS.textMuted }}>
          {isZh ? '設定篩選條件後點擊「查詢」' : 'Set filters and click Search'}
        </div>
      )}
    </div>
  );
}
