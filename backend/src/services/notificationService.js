const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');
const pool = require('../db');

const SEVERITY_LEVELS = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function severitiesAboveThreshold(threshold) {
  const minLevel = SEVERITY_LEVELS[threshold] ?? SEVERITY_LEVELS.HIGH;
  return Object.entries(SEVERITY_LEVELS)
    .filter(([, level]) => level >= minLevel)
    .map(([sev]) => sev);
}

async function getNewVulns(threshold) {
  const sevList = severitiesAboveThreshold(threshold);
  const { rows } = await pool.query(
    `SELECT id, severity, description, source, product
     FROM vulnerabilities
     WHERE created_at > NOW() - INTERVAL '10 minutes'
       AND severity = ANY($1)
     ORDER BY
       CASE severity WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC,
       created_at DESC`,
    [sevList]
  );
  return rows;
}

// ─── Email ───────────────────────────────────────────────────────────────────

function buildEmailHtml(vulns, sourceLabel) {
  const rows = vulns.map(v => {
    const desc = (v.description || '').slice(0, 120);
    const colour = v.severity === 'CRITICAL' ? '#d32f2f'
                 : v.severity === 'HIGH'     ? '#f57c00'
                 : v.severity === 'MEDIUM'   ? '#fbc02d' : '#388e3c';
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600">${v.id}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${colour};font-weight:700">${v.severity}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${v.source || ''}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${desc}${desc.length === 120 ? '…' : ''}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#333">
    <h2 style="color:#1565c0">SecVuln 弱點通知</h2>
    <p>來源：<strong>${sourceLabel || '排程同步'}</strong>　偵測到 <strong>${vulns.length}</strong> 筆新弱點</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead><tr style="background:#e3f2fd">
        <th style="padding:8px 10px;text-align:left">CVE ID</th>
        <th style="padding:8px 10px;text-align:left">嚴重度</th>
        <th style="padding:8px 10px;text-align:left">來源</th>
        <th style="padding:8px 10px;text-align:left">描述</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:16px;color:#888;font-size:12px">此郵件由 SecVuln 自動發送，請勿回覆。</p>
  </body></html>`;
}

function createTransport(settings) {
  return nodemailer.createTransport({
    host: settings.notif_smtp_host,
    port: Number(settings.notif_smtp_port) || 587,
    secure: Number(settings.notif_smtp_port) === 465,
    auth: {
      user: settings.notif_smtp_user,
      pass: settings.notif_smtp_pass,
    },
  });
}

async function sendEmailDigest(settings, vulns, sourceLabel) {
  if (!settings.notif_email) return;
  if (!settings.notif_smtp_host || !settings.notif_smtp_user || !settings.notif_smtp_pass) return;
  if (!settings.notif_email_addr) return;

  const transporter = createTransport(settings);
  await transporter.sendMail({
    from: settings.notif_smtp_from || settings.notif_smtp_user,
    to: settings.notif_email_addr,
    subject: `SecVuln 弱點通知：${vulns.length} 筆新弱點`,
    html: buildEmailHtml(vulns, sourceLabel),
  });
  console.log(`[notif] Email sent to ${settings.notif_email_addr} (${vulns.length} vulns)`);
}

async function sendTestEmail(settings) {
  const transporter = createTransport(settings);
  await transporter.sendMail({
    from: settings.notif_smtp_from || settings.notif_smtp_user,
    to: settings.notif_email_addr || settings.notif_smtp_user,
    subject: 'SecVuln 通知測試',
    html: '<p>SecVuln Email 通知設定正確，此為測試郵件。</p>',
  });
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

function buildWebhookPayload(type, vulns, sourceLabel) {
  const title = `SecVuln：偵測到 ${vulns.length} 筆新弱點`;
  const summary = vulns.map(v => `• ${v.id} [${v.severity}]  ${(v.description || '').slice(0, 80)}`).join('\n');

  if (type === 'teams') {
    return JSON.stringify({
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: 'FF0000',
      summary: title,
      sections: [{
        activityTitle: title,
        activitySubtitle: `來源：${sourceLabel || '排程同步'}`,
        facts: vulns.map(v => ({
          name: `${v.id} [${v.severity}]`,
          value: (v.description || '').slice(0, 100),
        })),
      }],
    });
  }

  if (type === 'slack') {
    return JSON.stringify({
      text: title,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: title } },
        { type: 'section', text: { type: 'mrkdwn', text: summary } },
      ],
    });
  }

  // generic
  return JSON.stringify({
    title,
    source: sourceLabel || '',
    count: vulns.length,
    vulnerabilities: vulns.map(v => ({
      id: v.id,
      severity: v.severity,
      source: v.source || '',
      description: (v.description || '').slice(0, 200),
    })),
  });
}

function httpsPost(urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: { 'Content-Length': Buffer.byteLength(body), ...headers },
      timeout: 10000,
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('webhook request timed out')); });
    req.write(body);
    req.end();
  });
}

async function sendWebhookDigest(settings, vulns, sourceLabel) {
  if (!settings.notif_web) return;
  if (!settings.notif_webhook_url) return;

  const type = settings.notif_webhook_type || 'teams';

  if (type === 'line') {
    // Line Notify uses form-encoded POST with Authorization header
    const token = settings.notif_webhook_token;
    if (!token) throw new Error('Line Notify token is required');
    const msg = encodeURIComponent(
      `\nSecVuln 弱點通知：${vulns.length} 筆新弱點\n` +
      vulns.map(v => `${v.id} [${v.severity}]`).join('\n')
    );
    const body = `message=${msg}`;
    const result = await httpsPost(settings.notif_webhook_url, body, {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${token}`,
    });
    if (result.status !== 200) throw new Error(`Line Notify error: HTTP ${result.status}`);
  } else {
    const payload = buildWebhookPayload(type, vulns, sourceLabel);
    const result = await httpsPost(settings.notif_webhook_url, payload, {
      'Content-Type': 'application/json',
    });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Webhook error: HTTP ${result.status} — ${result.body.slice(0, 200)}`);
    }
  }
  console.log(`[notif] Webhook sent (${type}, ${vulns.length} vulns)`);
}

async function sendTestWebhook(settings) {
  const type = settings.notif_webhook_type || 'teams';
  const testVulns = [{
    id: 'CVE-TEST-0000',
    severity: 'HIGH',
    source: 'SecVuln Test',
    description: '這是一則 SecVuln Webhook 通知測試訊息。',
  }];
  await sendWebhookDigest(
    { ...settings, notif_web: true },
    testVulns,
    '測試'
  );
}

// ─── Main entry point ─────────────────────────────────────────────────────────

async function notify(settings, sourceId) {
  try {
    const vulns = await getNewVulns(settings.notif_threshold || 'HIGH');
    if (!vulns.length) return;

    const sourceLabel = {
      nvd: 'NVD',
      fortinet: 'Fortinet',
      paloalto: 'Palo Alto Networks',
    }[sourceId] || sourceId || '排程同步';

    await Promise.all([
      sendEmailDigest(settings, vulns, sourceLabel).catch(err =>
        console.error('[notif] Email failed:', err.message)),
      sendWebhookDigest(settings, vulns, sourceLabel).catch(err =>
        console.error('[notif] Webhook failed:', err.message)),
    ]);
  } catch (err) {
    console.error('[notif] notify() unexpected error:', err.message);
  }
}

async function sendReportEmail(settings, pdfBuffer, recipient, label) {
  if (!settings.notif_smtp_host || !settings.notif_smtp_user || !settings.notif_smtp_pass) {
    throw new Error('SMTP 設定不完整');
  }
  const to = recipient || settings.notif_email_addr;
  if (!to) throw new Error('收件地址未設定');

  const transporter = createTransport(settings);
  const filename = `report_${label || new Date().toISOString().slice(0, 10)}.pdf`;
  await transporter.sendMail({
    from: settings.notif_smtp_from || settings.notif_smtp_user,
    to,
    subject: `SecVuln 報表：${label || new Date().toISOString().slice(0, 10)}`,
    html: '<p>請見附件 PDF 報表。</p><p style="color:#888;font-size:12px">此郵件由 SecVuln 自動發送，請勿回覆。</p>',
    attachments: [{ filename, content: pdfBuffer }],
  });
  console.log(`[notif] Report email sent to ${to} (${filename})`);
}

module.exports = { notify, sendTestEmail, sendTestWebhook, sendReportEmail };
