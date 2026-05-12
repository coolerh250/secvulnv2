const pool = require('../db');

async function list(req, res) {
  try {
    const { keyword, category, username, dateFrom, dateTo, page = 1, limit = 50 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (dateTo) {
      params.push(dateTo);
      conditions.push(`created_at <= $${params.length}::timestamptz + interval '1 day'`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (username) {
      params.push(`%${username}%`);
      conditions.push(`username ILIKE $${params.length}`);
    }
    if (keyword) {
      params.push(`%${keyword}%`);
      const p = params.length;
      conditions.push(
        `(username ILIKE $${p} OR action ILIKE $${p} OR target_name ILIKE $${p} OR detail::text ILIKE $${p})`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit));
    params.push(offset);
    const dataResult = await pool.query(
      `SELECT id, created_at, user_id, username, role, action, category, target_id, target_name, detail
       FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: dataResult.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('Audit list error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}

module.exports = { list };
