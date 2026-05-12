const pool         = require('../db');
const https        = require('https');
const { sendTestEmail, sendTestWebhook } = require('../services/notificationService');
const auditService = require('../services/auditService');

// Returns true for hostnames that should never be fetched server-side (SSRF prevention)
function isPrivateHostname(urlStr) {
  let hostname;
  try { hostname = new URL(urlStr).hostname; } catch { return true; }
  return /^(localhost|127\.|0\.0\.0\.0$|::1$|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|fc00:|fd[0-9a-f]{2}:|fe80:)/i.test(hostname);
}

const maskKey = k => (k && k.length > 4) ? k.slice(0, 4) + '****' : (k ? '****' : k);
const isMasked = v => typeof v === 'string' && /\*{4}$/.test(v);

async function get(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM settings WHERE id = 1');
    if (!rows[0]) return res.json({});
    const s = { ...rows[0] };
    if (s.ai_api_key)         s.ai_api_key         = maskKey(s.ai_api_key);
    if (s.notif_smtp_pass)    s.notif_smtp_pass     = maskKey(s.notif_smtp_pass);
    if (s.notif_webhook_token) s.notif_webhook_token = maskKey(s.notif_webhook_token);
    if (Array.isArray(s.data_sources)) {
      s.data_sources = s.data_sources.map(src =>
        src.apiKey ? { ...src, apiKey: maskKey(src.apiKey) } : src
      );
    }
    res.json(s);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const {
      ai_provider, ai_model, ai_api_key, ai_auth_method, ai_base_url,
      notif_email, notif_web, notif_threshold, notif_email_addr,
      notif_smtp_host, notif_smtp_port, notif_smtp_user, notif_smtp_pass, notif_smtp_from,
      notif_webhook_url, notif_webhook_type, notif_webhook_token,
      interface_language, data_sources, log_retention_days,
    } = req.body;

    // If the client echoes back a masked placeholder, don't overwrite the stored value
    const realAiKey        = isMasked(ai_api_key)         ? null : ai_api_key;
    const realSmtpPass     = isMasked(notif_smtp_pass)    ? null : notif_smtp_pass;
    const realWebhookToken = isMasked(notif_webhook_token) ? null : notif_webhook_token;

    // Restore any masked source API keys from the current DB value
    let mergedSources = null;
    if (data_sources) {
      const hasMasked = data_sources.some(s => isMasked(s.apiKey));
      if (hasMasked) {
        const { rows: cur } = await pool.query('SELECT data_sources FROM settings WHERE id = 1');
        const existing = cur[0]?.data_sources || [];
        mergedSources = data_sources.map(s => {
          if (isMasked(s.apiKey)) {
            const old = existing.find(e => e.id === s.id);
            return { ...s, apiKey: old?.apiKey || '' };
          }
          return s;
        });
      } else {
        mergedSources = data_sources;
      }
    }

    const { rows } = await pool.query(
      `UPDATE settings SET
        ai_provider          = COALESCE($1,  ai_provider),
        ai_model             = COALESCE($2,  ai_model),
        ai_api_key           = COALESCE($3,  ai_api_key),
        ai_auth_method       = COALESCE($4,  ai_auth_method),
        ai_base_url          = COALESCE($5,  ai_base_url),
        notif_email          = COALESCE($6,  notif_email),
        notif_web            = COALESCE($7,  notif_web),
        notif_threshold      = COALESCE($8,  notif_threshold),
        notif_email_addr     = COALESCE($9,  notif_email_addr),
        notif_smtp_host      = COALESCE($10, notif_smtp_host),
        notif_smtp_port      = COALESCE($11, notif_smtp_port),
        notif_smtp_user      = COALESCE($12, notif_smtp_user),
        notif_smtp_pass      = COALESCE($13, notif_smtp_pass),
        notif_smtp_from      = COALESCE($14, notif_smtp_from),
        notif_webhook_url    = COALESCE($15, notif_webhook_url),
        notif_webhook_type   = COALESCE($16, notif_webhook_type),
        notif_webhook_token  = COALESCE($17, notif_webhook_token),
        interface_language   = COALESCE($18, interface_language),
        data_sources         = COALESCE($19, data_sources),
        log_retention_days   = COALESCE($20, log_retention_days),
        updated_at           = NOW()
       WHERE id = 1 RETURNING *`,
      [
        ai_provider, ai_model, realAiKey, ai_auth_method, ai_base_url || null,
        notif_email ?? null, notif_web ?? null, notif_threshold, notif_email_addr,
        notif_smtp_host || null, notif_smtp_port || null, notif_smtp_user || null,
        realSmtpPass || null, notif_smtp_from || null,
        notif_webhook_url || null, notif_webhook_type || null, realWebhookToken || null,
        interface_language,
        mergedSources ? JSON.stringify(mergedSources) : null,
        log_retention_days || null,
      ]
    );
    const SENSITIVE = ['ai_api_key', 'notif_smtp_pass', 'notif_webhook_token'];
    const changedFields = Object.keys(req.body).filter(k => !SENSITIVE.includes(k));
    auditService.log(req.user, 'settings.update', 'settings', 'settings', 'System Settings',
      { changed_fields: changedFields });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function testEmail(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM settings WHERE id = 1');
    if (!rows[0]) return res.status(500).json({ ok: false, error: 'Settings not found' });
    const s = rows[0];
    if (!s.notif_smtp_host || !s.notif_smtp_user || !s.notif_smtp_pass) {
      return res.json({ ok: false, error: 'SMTP 設定不完整，請填寫主機、帳號與密碼' });
    }
    if (!s.notif_email_addr) {
      return res.json({ ok: false, error: '尚未設定收件 Email 地址' });
    }
    await sendTestEmail(s);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

async function testWebhook(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM settings WHERE id = 1');
    if (!rows[0]) return res.status(500).json({ ok: false, error: 'Settings not found' });
    const s = rows[0];
    if (!s.notif_webhook_url) {
      return res.json({ ok: false, error: '尚未設定 Webhook URL' });
    }
    if (s.notif_webhook_type === 'line' && !s.notif_webhook_token) {
      return res.json({ ok: false, error: 'Line Notify 需要填寫 Token' });
    }
    await sendTestWebhook(s);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

async function testSource(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT data_sources FROM settings WHERE id = 1');
    const sources = rows[0]?.data_sources || [];
    const src = sources.find(s => s.id === req.params.id);
    if (!src) return res.status(404).json({ error: 'Source not found' });
    if (!src.url || !src.url.startsWith('https://')) return res.json({ ok: false, error: 'URL must use HTTPS' });
    if (isPrivateHostname(src.url)) return res.json({ ok: false, error: 'Private or loopback addresses are not allowed' });

    await new Promise((resolve, reject) => {
      const req2 = https.request(src.url, { method: 'HEAD', timeout: 5000 }, r => resolve(r.statusCode));
      req2.on('error', reject);
      req2.on('timeout', () => { req2.destroy(); reject(new Error('timeout')); });
      req2.end();
    });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

async function syncSource(req, res, next) {
  const sourceId = req.params.id;
  try {
    const { rows } = await pool.query('SELECT * FROM settings WHERE id = 1');
    const settings = rows[0];
    if (!settings) return res.status(500).json({ error: 'Settings not found' });

    const sources   = settings.data_sources || [];
    const srcIndex  = sources.findIndex(s => s.id === sourceId);
    if (srcIndex === -1) return res.status(404).json({ error: 'Source not found' });

    const { sync, SYNC_SOURCES } = require('../services/nvdSync');
    if (!SYNC_SOURCES.has(sourceId)) {
      return res.status(501).json({ error: `Sync for "${sourceId}" is not yet implemented` });
    }

    const result = await sync(sourceId, settings);

    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const updated = sources.map((s, i) =>
      i === srcIndex ? { ...s, lastSync: now, syncStatus: 'ok' } : s
    );
    await pool.query(
      'UPDATE settings SET data_sources = $1, updated_at = NOW() WHERE id = 1',
      [JSON.stringify(updated)]
    );

    res.json({ ok: true, inserted: result.inserted, updated: result.updated, removed: result.removed });
  } catch (err) {
    try {
      const { rows } = await pool.query('SELECT data_sources FROM settings WHERE id = 1');
      const sources  = rows[0]?.data_sources || [];
      const srcIndex = sources.findIndex(s => s.id === sourceId);
      if (srcIndex !== -1) {
        sources[srcIndex] = { ...sources[srcIndex], syncStatus: 'fail' };
        await pool.query('UPDATE settings SET data_sources = $1 WHERE id = 1', [JSON.stringify(sources)]);
      }
    } catch { /* ignore secondary failure */ }
    next(err);
  }
}

module.exports = { get, update, testEmail, testWebhook, testSource, syncSource };
