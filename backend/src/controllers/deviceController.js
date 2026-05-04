const pool = require('../db');

async function list(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM devices ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, name_en, vendor, model, firmware } = req.body;
    if (!name || !model || !firmware) {
      return res.status(400).json({ error: 'name, model, and firmware are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO devices (name, name_en, vendor, model, firmware, status, last_check, vuln_count)
       VALUES ($1, $2, $3, $4, $5, 'upToDate', CURRENT_DATE, 0) RETURNING *`,
      [name, name_en || name, vendor || 'Fortinet', model, firmware]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, name_en, vendor, model, firmware } = req.body;
    const { rows } = await pool.query(
      `UPDATE devices SET name=$1, name_en=$2, vendor=$3, model=$4, firmware=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [name, name_en || name, vendor, model, firmware, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Device not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM devices WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Device not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function scan(req, res, next) {
  try {
    const { id } = req.params;
    // Simulate scan: random result
    const status     = Math.random() > 0.5 ? 'vulnerable' : 'upToDate';
    const vuln_count = status === 'vulnerable' ? Math.floor(Math.random() * 3) + 1 : 0;
    const { rows } = await pool.query(
      `UPDATE devices SET status=$1, vuln_count=$2, last_check=CURRENT_DATE, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [status, vuln_count, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Device not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, scan };
