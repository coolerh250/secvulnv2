const pool = require('../db');
const { sendReportEmail } = require('../services/notificationService');

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const SEV_COLOR = { CRITICAL: '#e53935', HIGH: '#f57c00', MEDIUM: '#f9a825', LOW: '#43a047' };
const STATUS_COLOR = { pending: '#f57c00', fixed: '#43a047', accepted: '#7b1fa2', deferred: '#1976d2' };
const STATUS_LABEL = {
  zh: { pending: '待處理', fixed: '已修復', accepted: '風險接受', deferred: '暫不處理' },
  en: { pending: 'Pending', fixed: 'Fixed', accepted: 'Accepted', deferred: 'Deferred' },
};
const SEV_LABEL = {
  zh: { CRITICAL: '嚴重', HIGH: '高', MEDIUM: '中', LOW: '低' },
  en: { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' },
};

// ─── DB Query ────────────────────────────────────────────────────────────────

async function getReportData(deviceIds, from, to) {
  const { rows } = await pool.query(
    `SELECT
       d.id AS device_id, d.name, d.vendor, d.device_type, d.model, d.firmware, d.status, d.last_check,
       v.id AS vuln_id, v.title, v.title_en, v.severity, v.cvss, v.published,
       v.description, v.description_en, v.recommendation, v.recommendation_en,
       dv.handle_status,
       ra.review_date, ra.mitigation, ra.mitigation_en
     FROM devices d
     JOIN device_vulnerabilities dv ON dv.device_id = d.id
     JOIN vulnerabilities v ON v.id = dv.vuln_id
     LEFT JOIN risk_acceptances ra ON ra.vuln_id = v.id AND ra.device_id = d.id
     WHERE d.id = ANY($1)
       AND v.published BETWEEN $2 AND $3
     ORDER BY d.id, CASE v.severity WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC, v.cvss DESC`,
    [deviceIds, from, to]
  );

  const deviceMap = {};
  for (const r of rows) {
    if (!deviceMap[r.device_id]) {
      deviceMap[r.device_id] = {
        id: r.device_id, name: r.name, vendor: r.vendor, device_type: r.device_type,
        model: r.model, firmware: r.firmware, status: r.status, last_check: r.last_check,
        vulns: [], statusCounts: { pending: 0, fixed: 0, accepted: 0, deferred: 0 },
      };
    }
    const d = deviceMap[r.device_id];
    d.vulns.push({
      id: r.vuln_id, title: r.title, title_en: r.title_en, severity: r.severity,
      cvss: r.cvss, published: r.published, handle_status: r.handle_status,
      description: r.description, description_en: r.description_en,
      recommendation: r.recommendation, recommendation_en: r.recommendation_en,
      review_date: r.review_date, mitigation: r.mitigation, mitigation_en: r.mitigation_en,
    });
    const st = r.handle_status || 'pending';
    if (d.statusCounts[st] !== undefined) d.statusCounts[st]++;
  }
  return Object.values(deviceMap);
}

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────

function buildDonutSvg(statusCounts) {
  const segments = [
    { key: 'pending',  color: STATUS_COLOR.pending,  value: statusCounts.pending || 0 },
    { key: 'fixed',    color: STATUS_COLOR.fixed,    value: statusCounts.fixed || 0 },
    { key: 'accepted', color: STATUS_COLOR.accepted, value: statusCounts.accepted || 0 },
    { key: 'deferred', color: STATUS_COLOR.deferred, value: statusCounts.deferred || 0 },
  ].filter(s => s.value > 0);

  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) {
    return `<svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx="45" cy="45" r="34" fill="none" stroke="#ddd" stroke-width="12"/>
      <text x="45" y="49" text-anchor="middle" font-size="11" fill="#999">0</text>
    </svg>`;
  }

  const cx = 45, cy = 45, r = 34, sw = 12;
  let startAngle = -Math.PI / 2;
  let paths = '';

  for (const seg of segments) {
    const angle = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    paths += `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}"
      fill="none" stroke="${seg.color}" stroke-width="${sw}" stroke-linecap="round"/>`;
    startAngle = endAngle;
  }

  return `<svg width="90" height="90" viewBox="0 0 90 90">${paths}
    <text x="45" y="42" text-anchor="middle" font-size="14" font-weight="bold" fill="#333" font-family="monospace">${total}</text>
    <text x="45" y="54" text-anchor="middle" font-size="8" fill="#888">TOTAL</text>
  </svg>`;
}

// ─── HTML Template Builders ───────────────────────────────────────────────────

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333; background: #fff; }
  h1 { font-size: 20px; color: #1a5276; margin-bottom: 4px; }
  h2 { font-size: 15px; color: #1a5276; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #1a5276; }
  h3 { font-size: 13px; color: #555; margin-bottom: 8px; margin-top: 16px; }
  .cover { padding: 32px 40px 16px; border-bottom: 1px solid #ddd; margin-bottom: 24px; }
  .cover .meta { font-size: 11px; color: #777; margin-top: 8px; }
  .device-section { padding: 24px 40px; page-break-before: always; }
  .device-section:first-of-type { page-break-before: auto; }
  .device-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .device-info { font-size: 11px; color: #666; line-height: 1.8; }
  .device-info strong { color: #333; }
  .chart-area { display: flex; align-items: center; gap: 16px; }
  .legend { font-size: 10px; line-height: 2; }
  .legend span { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
  th { background: #1a5276; color: #fff; padding: 6px 8px; text-align: left; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .sev { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; color: #fff; }
  .sev-CRITICAL { background: #e53935; }
  .sev-HIGH { background: #f57c00; }
  .sev-MEDIUM { background: #f9a825; color: #333; }
  .sev-LOW { background: #43a047; }
  .st { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; }
  .st-pending { background: #fff3e0; color: #e65100; }
  .st-fixed { background: #e8f5e9; color: #2e7d32; }
  .st-accepted { background: #f3e5f5; color: #6a1b9a; }
  .st-deferred { background: #e3f2fd; color: #1565c0; }
  .summary-table th { background: #2c3e50; }
  .pct-bar { height: 8px; background: #eee; border-radius: 4px; overflow: hidden; margin-top: 3px; }
  .pct-fill { height: 100%; background: #43a047; border-radius: 4px; }
  .priority-table th { background: #6d4c41; }
  .page-break { page-break-before: always; }
  footer { font-size: 10px; color: #aaa; text-align: center; padding: 16px; border-top: 1px solid #eee; margin-top: 24px; }
`;

function formatDate(d) {
  if (!d) return '—';
  return String(d).slice(0, 10);
}

function buildCover(from, to, generatedAt, lang) {
  const isZh = lang === 'zh';
  return `<div class="cover">
    <h1>${isZh ? '設備弱點修補狀態報告' : 'Device Vulnerability Remediation Report'}</h1>
    <div class="meta">
      ${isZh ? '報告期間' : 'Period'}: ${from} ～ ${to}　|
      ${isZh ? '產出時間' : 'Generated'}: ${generatedAt}
    </div>
  </div>`;
}

// Format 1: Per-device table + donut chart
function buildFormat1(data, lang, from, to) {
  const isZh = lang === 'zh';
  const generatedAt = new Date().toLocaleString(isZh ? 'zh-TW' : 'en-US');
  let html = buildCover(from, to, generatedAt, lang);

  for (const d of data) {
    const svg = buildDonutSvg(d.statusCounts);
    const patchRate = d.vulns.length > 0
      ? Math.round((d.statusCounts.fixed / d.vulns.length) * 100) : 0;

    const legendItems = Object.entries(STATUS_COLOR).map(([k, c]) =>
      d.statusCounts[k] > 0
        ? `<div><span style="background:${c}"></span>${STATUS_LABEL[lang][k]}: <strong>${d.statusCounts[k]}</strong></div>`
        : ''
    ).join('');

    const rows = d.vulns.map(v => `
      <tr>
        <td style="font-family:monospace;font-weight:700;color:#1a5276;white-space:nowrap">${escapeHtml(v.id)}</td>
        <td><span class="sev sev-${v.severity}">${escapeHtml(SEV_LABEL[lang][v.severity] || v.severity)}</span></td>
        <td style="text-align:center">${v.cvss || '—'}</td>
        <td style="white-space:nowrap">${formatDate(v.published)}</td>
        <td><span class="st st-${v.handle_status}">${escapeHtml(STATUS_LABEL[lang][v.handle_status] || v.handle_status)}</span></td>
        <td>${escapeHtml(isZh ? (v.title || v.title_en) : (v.title_en || v.title))}</td>
      </tr>`).join('');

    html += `<div class="device-section">
      <h2>${escapeHtml(isZh ? d.name : (d.name_en || d.name))}</h2>
      <div class="device-header">
        <div class="device-info">
          <div><strong>${isZh ? '廠商' : 'Vendor'}：</strong>${escapeHtml(d.vendor)}</div>
          <div><strong>${isZh ? '設備種類' : 'Type'}：</strong>${escapeHtml(d.device_type) || '—'}</div>
          <div><strong>${isZh ? '型號' : 'Model'}：</strong>${escapeHtml(d.model) || '—'}</div>
          <div><strong>${isZh ? '韌體版本' : 'Firmware'}：</strong>${escapeHtml(d.firmware) || '—'}</div>
          <div><strong>${isZh ? '最後掃描' : 'Last Check'}：</strong>${formatDate(d.last_check)}</div>
          <div><strong>${isZh ? '修補率' : 'Patch Rate'}：</strong>${patchRate}%</div>
        </div>
        <div class="chart-area">
          ${svg}
          <div class="legend">${legendItems}</div>
        </div>
      </div>
      <h3>${isZh ? '弱點明細' : 'Vulnerability Details'} (${d.vulns.length} ${isZh ? '筆' : 'items'})</h3>
      ${d.vulns.length === 0
        ? `<p style="color:#aaa;font-style:italic">${isZh ? '此期間無相關弱點' : 'No vulnerabilities in this period'}</p>`
        : `<table>
            <thead><tr>
              <th>CVE ID</th>
              <th>${isZh ? '嚴重度' : 'Severity'}</th>
              <th>CVSS</th>
              <th>${isZh ? '發布日期' : 'Published'}</th>
              <th>${isZh ? '狀態' : 'Status'}</th>
              <th>${isZh ? '標題' : 'Title'}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
           </table>`
      }
    </div>`;
  }

  return html;
}

// Format 2: Executive Summary
function buildFormat2(data, lang, from, to) {
  const isZh = lang === 'zh';
  const generatedAt = new Date().toLocaleString(isZh ? 'zh-TW' : 'en-US');
  let html = buildCover(from, to, generatedAt, lang);

  const totalVulns  = data.reduce((a, d) => a + d.vulns.length, 0);
  const totalFixed  = data.reduce((a, d) => a + d.statusCounts.fixed, 0);
  const overallRate = totalVulns > 0 ? Math.round((totalFixed / totalVulns) * 100) : 0;
  const critCount   = data.reduce((a, d) => a + d.vulns.filter(v => v.severity === 'CRITICAL').length, 0);

  html += `<div class="device-section">
    <h2>${isZh ? '管理層總覽' : 'Executive Summary'}</h2>
    <div style="display:flex;gap:32px;margin-bottom:24px">
      ${[
        { l: isZh ? '涵蓋設備' : 'Devices', v: data.length, c: '#1a5276' },
        { l: isZh ? '總弱點數' : 'Total Vulns', v: totalVulns, c: '#333' },
        { l: isZh ? '嚴重弱點' : 'Critical', v: critCount, c: '#e53935' },
        { l: isZh ? '整體修補率' : 'Overall Patch Rate', v: overallRate + '%', c: '#43a047' },
      ].map(i => `<div style="text-align:center;padding:12px 20px;border:1px solid #eee;border-radius:6px">
        <div style="font-size:24px;font-weight:700;color:${i.c};font-family:monospace">${i.v}</div>
        <div style="font-size:10px;color:#888;margin-top:4px">${i.l}</div>
      </div>`).join('')}
    </div>

    <table class="summary-table">
      <thead><tr>
        <th>${isZh ? '設備名稱' : 'Device'}</th>
        <th>${isZh ? '廠商 / 種類' : 'Vendor / Type'}</th>
        <th>${isZh ? '型號 / 韌體' : 'Model / FW'}</th>
        <th>${isZh ? '弱點總數' : 'Total'}</th>
        <th style="color:#f44336">${SEV_LABEL[lang]['CRITICAL']}</th>
        <th style="color:#ff9800">${SEV_LABEL[lang]['HIGH']}</th>
        <th>${isZh ? '待處理' : 'Pending'}</th>
        <th>${isZh ? '修補率' : 'Patch Rate'}</th>
      </tr></thead>
      <tbody>
        ${data.map(d => {
          const pct = d.vulns.length > 0 ? Math.round((d.statusCounts.fixed / d.vulns.length) * 100) : 0;
          const crit = d.vulns.filter(v => v.severity === 'CRITICAL').length;
          const high = d.vulns.filter(v => v.severity === 'HIGH').length;
          return `<tr>
            <td><strong>${escapeHtml(isZh ? d.name : (d.name_en || d.name))}</strong></td>
            <td>${escapeHtml(d.vendor)}<br><span style="color:#888">${escapeHtml(d.device_type) || '—'}</span></td>
            <td>${escapeHtml(d.model) || '—'}<br><span style="color:#888">${escapeHtml(d.firmware) || '—'}</span></td>
            <td style="text-align:center;font-weight:700">${d.vulns.length}</td>
            <td style="text-align:center;color:#e53935;font-weight:700">${crit || '—'}</td>
            <td style="text-align:center;color:#f57c00;font-weight:700">${high || '—'}</td>
            <td style="text-align:center">${d.statusCounts.pending}</td>
            <td>
              <div style="font-weight:700;color:${pct >= 80 ? '#43a047' : pct >= 50 ? '#f57c00' : '#e53935'}">${pct}%</div>
              <div class="pct-bar"><div class="pct-fill" style="width:${pct}%;background:${pct >= 80 ? '#43a047' : pct >= 50 ? '#f57c00' : '#e53935'}"></div></div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;

  return html;
}

// Format 3: Priority Action List
function buildFormat3(data, lang, from, to) {
  const isZh = lang === 'zh';
  const generatedAt = new Date().toLocaleString(isZh ? 'zh-TW' : 'en-US');
  let html = buildCover(from, to, generatedAt, lang);

  // Merge all vulns across devices, track which devices each vuln affects
  const vulnMap = {};
  for (const d of data) {
    for (const v of d.vulns) {
      if (!vulnMap[v.id]) {
        vulnMap[v.id] = { ...v, affectedDevices: [] };
      }
      vulnMap[v.id].affectedDevices.push({ name: isZh ? d.name : (d.name_en || d.name), handle_status: v.handle_status });
      const sev = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const curSev = sev[v.severity] || 0;
      const storedSev = sev[vulnMap[v.id].severity] || 0;
      if (curSev > storedSev) {
        vulnMap[v.id].severity = v.severity;
        vulnMap[v.id].cvss = v.cvss;
      } else if (curSev === storedSev && (v.cvss || 0) > (vulnMap[v.id].cvss || 0)) {
        vulnMap[v.id].cvss = v.cvss;
      }
    }
  }

  const vulns = Object.values(vulnMap).sort((a, b) => {
    const sevOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const sd = (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
    return sd !== 0 ? sd : (b.cvss || 0) - (a.cvss || 0);
  });

  const notFixed = vulns.filter(v => v.affectedDevices.some(d => d.handle_status !== 'fixed'));

  const rows = vulns.map(v => {
    const worstStatus = v.affectedDevices.some(d => d.handle_status === 'pending') ? 'pending'
      : v.affectedDevices.some(d => d.handle_status === 'accepted') ? 'accepted'
      : v.affectedDevices.some(d => d.handle_status === 'deferred') ? 'deferred' : 'fixed';
    const affectedStr = v.affectedDevices.map(d => escapeHtml(d.name)).join(', ');
    return `<tr>
      <td style="font-family:monospace;font-weight:700;color:#1a5276;white-space:nowrap">${escapeHtml(v.id)}</td>
      <td><span class="sev sev-${v.severity}">${escapeHtml(SEV_LABEL[lang][v.severity] || v.severity)}</span></td>
      <td style="text-align:center">${v.cvss || '—'}</td>
      <td style="font-size:10px">${affectedStr}</td>
      <td><span class="st st-${worstStatus}">${escapeHtml(STATUS_LABEL[lang][worstStatus])}</span></td>
      <td>${escapeHtml(isZh ? (v.title || v.title_en) : (v.title_en || v.title))}</td>
    </tr>`;
  }).join('');

  html += `<div class="device-section">
    <h2>${isZh ? '優先處理清單' : 'Priority Action List'}</h2>
    <p style="color:#666;margin-bottom:16px;font-size:11px">
      ${isZh
        ? `共 ${vulns.length} 個弱點，其中 ${notFixed.length} 個尚未修復，依嚴重度與 CVSS 降序排列。`
        : `${vulns.length} vulnerabilities total, ${notFixed.length} not yet fixed. Sorted by severity and CVSS.`}
    </p>
    <table class="priority-table">
      <thead><tr>
        <th>CVE ID</th>
        <th>${isZh ? '嚴重度' : 'Severity'}</th>
        <th>CVSS</th>
        <th>${isZh ? '影響設備' : 'Affected Devices'}</th>
        <th>${isZh ? '最差狀態' : 'Worst Status'}</th>
        <th>${isZh ? '標題' : 'Title'}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;

  return html;
}

// ─── PDF Generation (puppeteer) ───────────────────────────────────────────────

async function generatePdf(html) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ─── Shared helper: build HTML for given params ───────────────────────────────

async function buildHtmlForParams(deviceIds, from, to, format, lang) {
  const data = await getReportData(deviceIds, from, to);
  const builder = format === 2 ? buildFormat2 : format === 3 ? buildFormat3 : buildFormat1;
  const body = builder(data, lang, from, to);
  return `<!DOCTYPE html><html lang="${lang}"><head>
    <meta charset="UTF-8"><style>${CSS}</style>
  </head><body>${body}<footer>SecVuln — ${new Date().toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US')}</footer></body></html>`;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

async function data(req, res, next) {
  try {
    const { devices, from, to } = req.query;
    if (!devices || !from || !to) return res.status(400).json({ error: 'devices, from, to required' });
    const deviceIds = String(devices).split(',').map(Number).filter(Boolean);
    if (!deviceIds.length) return res.status(400).json({ error: 'Invalid device list' });
    const result = await getReportData(deviceIds, from, to);
    res.json(result);
  } catch (err) { next(err); }
}

async function pdf(req, res, next) {
  try {
    const { devices, from, to, format = '1', lang = 'zh' } = req.query;
    if (!devices || !from || !to) return res.status(400).json({ error: 'devices, from, to required' });
    const deviceIds = String(devices).split(',').map(Number).filter(Boolean);
    const html = await buildHtmlForParams(deviceIds, from, to, parseInt(format), lang);
    const pdfBuffer = await generatePdf(html);
    const filename = `SecVuln_Report_${from}_${to}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
}

async function email(req, res, next) {
  try {
    const { devices, from, to, format = 1, lang = 'zh', recipient } = req.body;
    if (!devices?.length || !from || !to || !recipient) {
      return res.status(400).json({ error: 'devices, from, to, recipient required' });
    }
    const { rows } = await pool.query(
      'SELECT notif_smtp_host, notif_smtp_port, notif_smtp_user, notif_smtp_pass, notif_smtp_from, notif_email_addr FROM settings WHERE id = 1'
    );
    if (!rows[0]) return res.status(500).json({ error: 'Settings not found' });
    const settings = rows[0];
    if (!settings.notif_smtp_host || !settings.notif_smtp_user || !settings.notif_smtp_pass) {
      return res.status(400).json({ error: 'SMTP 設定不完整，請先至設定頁完成 SMTP 設定' });
    }

    const html = await buildHtmlForParams(devices, from, to, parseInt(format), lang);
    const pdfBuffer = await generatePdf(html);

    await sendReportEmail(settings, pdfBuffer, recipient, `${from} ～ ${to}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getSchedule(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT report_schedules FROM settings WHERE id = 1');
    res.json(rows[0]?.report_schedules || []);
  } catch (err) { next(err); }
}

async function saveSchedule(req, res, next) {
  try {
    const schedules = req.body;
    if (!Array.isArray(schedules)) return res.status(400).json({ error: 'Array expected' });
    await pool.query('UPDATE settings SET report_schedules = $1, updated_at = NOW() WHERE id = 1',
      [JSON.stringify(schedules)]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { data, pdf, email, getSchedule, saveSchedule, buildHtmlForParams, generatePdf, getReportData, buildFormat1, buildFormat2, buildFormat3 };
