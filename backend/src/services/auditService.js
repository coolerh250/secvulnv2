const pool = require('../db');

async function log(user, action, category, targetId, targetName, detail = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, username, role, action, category, target_id, target_name, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        user?.id || null,
        user?.username || null,
        user?.role || null,
        action,
        category,
        targetId != null ? String(targetId) : null,
        targetName || null,
        JSON.stringify(detail),
      ]
    );
  } catch (err) {
    console.error('Audit log insert error:', err.message);
  }
}

async function cleanup(retentionDays) {
  await pool.query(
    `DELETE FROM audit_logs WHERE created_at < NOW() - ($1 || ' days')::interval`,
    [String(retentionDays)]
  );
}

module.exports = { log, cleanup };
