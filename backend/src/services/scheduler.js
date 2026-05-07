const pool = require('../db');
const { sync, SYNC_SOURCES } = require('./nvdSync');
const { notify, sendReportEmail } = require('./notificationService');

const FREQ_MS = {
  '1h':    1 * 60 * 60 * 1000,
  '3h':    3 * 60 * 60 * 1000,
  '6h':    6 * 60 * 60 * 1000,
  '12h':  12 * 60 * 60 * 1000,
  '24h':  24 * 60 * 60 * 1000,
  '168h': 168 * 60 * 60 * 1000,
};

let _timer = null;
let _running = false;

async function runDueSources() {
  if (_running) return; // prevent overlapping runs
  _running = true;
  try {
    const { rows } = await pool.query('SELECT * FROM settings WHERE id = 1');
    if (!rows[0]) return;
    const settings = rows[0];
    const sources  = settings.data_sources || [];
    const now      = Date.now();

    for (const src of sources) {
      if (!src.enabled || src.syncFreq === 'manual' || !SYNC_SOURCES.has(src.id)) continue;
      const freqMs = FREQ_MS[src.syncFreq];
      if (!freqMs) continue;

      const lastMs = src.lastSync && src.lastSync !== '—'
        ? new Date(src.lastSync).getTime() : 0;
      if (now - lastMs < freqMs) continue;

      console.log(`[scheduler] Running scheduled sync for "${src.id}" (freq: ${src.syncFreq})`);
      try {
        const result = await sync(src.id, settings);
        const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
        // Refresh settings from DB in case another process updated them
        const { rows: fresh } = await pool.query(
          `SELECT data_sources,
                  notif_threshold, notif_email, notif_email_addr,
                  notif_smtp_host, notif_smtp_port, notif_smtp_user, notif_smtp_pass, notif_smtp_from,
                  notif_web, notif_webhook_url, notif_webhook_type, notif_webhook_token
           FROM settings WHERE id = 1`
        );
        const freshSources = (fresh[0]?.data_sources || []).map(s =>
          s.id === src.id ? { ...s, lastSync: nowStr, syncStatus: 'ok' } : s
        );
        await pool.query('UPDATE settings SET data_sources = $1, updated_at = NOW() WHERE id = 1',
          [JSON.stringify(freshSources)]);
        console.log(`[scheduler] "${src.id}" done — ${result.inserted} new, ${result.updated} updated, ${result.removed} removed`);
        if (result.inserted > 0) {
          await notify(fresh[0], src.id);
        }
      } catch (err) {
        console.error(`[scheduler] Sync failed for "${src.id}":`, err.message);
        try {
          const { rows: fresh } = await pool.query('SELECT data_sources FROM settings WHERE id = 1');
          const failed = (fresh[0]?.data_sources || []).map(s =>
            s.id === src.id ? { ...s, syncStatus: 'fail' } : s
          );
          await pool.query('UPDATE settings SET data_sources = $1 WHERE id = 1', [JSON.stringify(failed)]);
        } catch { /* ignore secondary failure */ }
      }
    }
  } catch (err) {
    console.error('[scheduler] Unexpected error:', err.message);
  } finally {
    _running = false;
  }
}

async function runDueReports() {
  try {
    const { rows } = await pool.query('SELECT report_schedules, notif_smtp_host, notif_smtp_port, notif_smtp_user, notif_smtp_pass, notif_smtp_from FROM settings WHERE id = 1');
    if (!rows[0]) return;
    const settings = rows[0];
    const schedules = settings.report_schedules || [];
    if (!schedules.length) return;

    const now = Date.now();
    let updated = false;

    for (const sched of schedules) {
      if (!sched.enabled || sched.freq === 'manual') continue;
      const freqMs = FREQ_MS[sched.freq];
      if (!freqMs) continue;
      const lastMs = sched.lastRun ? new Date(sched.lastRun).getTime() : 0;
      if (now - lastMs < freqMs) continue;

      console.log(`[scheduler] Running scheduled report "${sched.name || sched.id}"`);
      try {
        const { buildHtmlForParams, generatePdf } = require('../controllers/reportController');
        const from = sched.periodType === 'custom'
          ? sched.periodFrom
          : new Date(now - parseInt(sched.periodType) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const to = sched.periodType === 'custom'
          ? sched.periodTo
          : new Date().toISOString().slice(0, 10);

        const html = await buildHtmlForParams(sched.devices, from, to, sched.format || 1, 'zh');
        const pdfBuffer = await generatePdf(html);
        const label = `${sched.name || sched.id}_${to}`;
        await sendReportEmail(settings, pdfBuffer, sched.recipient, label);
        sched.lastRun = new Date().toISOString();
        updated = true;
      } catch (err) {
        console.error(`[scheduler] Report schedule "${sched.id}" failed:`, err.message);
      }
    }

    if (updated) {
      await pool.query('UPDATE settings SET report_schedules = $1 WHERE id = 1', [JSON.stringify(schedules)]);
    }
  } catch (err) {
    console.error('[scheduler] runDueReports error:', err.message);
  }
}

function start() {
  if (_timer) clearInterval(_timer);
  // Check every 5 minutes whether any source is due for sync
  _timer = setInterval(() => { runDueSources(); runDueReports(); }, 5 * 60 * 1000);
  // Initial check after 15 s so the DB connection is ready
  setTimeout(runDueSources, 15_000);
  console.log('[scheduler] Auto-sync scheduler started (checks every 5 min)');
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { start, stop };
