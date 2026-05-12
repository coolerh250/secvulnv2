const pool = require('../db');

async function list(req, res) {
  try {
    const { keyword, category, username, dateFrom, dateTo, page = 1, limit = 50 } = req.query;

    const limitVal  = parseInt(limit);
    const offsetVal = (parseInt(page) - 1) * limitVal;
    const params    = [];
    const conditions = [];
    let idx = 1;

    if (dateFrom) { params.push(dateFrom);         conditions.push(`created_at >= $${idx++}`); }
    if (dateTo)   { params.push(dateTo);            conditions.push(`created_at <= $${idx++}::timestamptz + interval '1 day'`); }
    if (category) { params.push(category);          conditions.push(`category = $${idx++}`); }
    if (username) { params.push(`%${username}%`);   conditions.push(`username ILIKE $${idx++}`); }
    if (keyword) {
      params.push(`%${keyword}%`);
      conditions.push(
        `(username ILIKE $${idx} OR action ILIKE $${idx} OR target_name ILIKE $${idx} OR detail::text ILIKE $${idx})`
      );
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limitVal, offsetVal);

    const { rows } = await pool.query(
      `SELECT id, created_at, user_id, username, role, action, category, target_id, target_name, detail,
              COUNT(*) OVER() AS total_count
       FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
    res.json({
      data: rows.map(({ total_count, ...row }) => row),
      total,
      page: parseInt(page),
      limit: limitVal,
      pages: Math.ceil(total / limitVal) || 1,
    });
  } catch (err) {
    console.error('Audit list error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}

module.exports = { list };
