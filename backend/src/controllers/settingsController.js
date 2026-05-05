const pool = require('../db');
const https = require('https');
const http  = require('http');

async function get(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM settings WHERE id = 1');
    res.json(rows[0] || {});
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const {
      ai_provider, ai_model, ai_api_key, ai_auth_method,
      notif_email, notif_web, notif_threshold, notif_email_addr,
      interface_language, data_sources,
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE settings SET
        ai_provider       = COALESCE($1,  ai_provider),
        ai_model          = COALESCE($2,  ai_model),
        ai_api_key        = COALESCE($3,  ai_api_key),
        ai_auth_method    = COALESCE($4,  ai_auth_method),
        notif_email       = COALESCE($5,  notif_email),
        notif_web         = COALESCE($6,  notif_web),
        notif_threshold   = COALESCE($7,  notif_threshold),
        notif_email_addr  = COALESCE($8,  notif_email_addr),
        interface_language = COALESCE($9, interface_language),
        data_sources      = COALESCE($10, data_sources),
        updated_at        = NOW()
       WHERE id = 1 RETURNING *`,
      [
        ai_provider, ai_model, ai_api_key, ai_auth_method,
        notif_email ?? null, notif_web ?? null, notif_threshold, notif_email_addr,
        interface_language,
        data_sources ? JSON.stringify(data_sources) : null,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function testSource(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT data_sources FROM settings WHERE id = 1');
    const sources = rows[0]?.data_sources || [];
    const src = sources.find(s => s.id === req.params.id);
    if (!src) return res.status(404).json({ error: 'Source not found' });
    if (!src.url || !src.url.startsWith('http')) return res.json({ ok: false, error: 'Invalid URL' });

    const lib = src.url.startsWith('https') ? https : http;
    await new Promise((resolve, reject) => {
      const req2 = lib.request(src.url, { method: 'HEAD', timeout: 5000 }, r => resolve(r.statusCode));
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

    const { sync, SOURCE_MAP } = require('../services/nvdSync');
    if (!SOURCE_MAP[sourceId]) {
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

    res.json({ ok: true, inserted: result.inserted, updated: result.updated });
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

module.exports = { get, update, testSource, syncSource };
