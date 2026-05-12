const bcrypt       = require('bcryptjs');
const pool         = require('../db');
const auditService = require('../services/auditService');

const ROLE_HIERARCHY = { superadmin: 3, admin: 2, user: 1 };

function canAssign(actorRole, targetRole) {
  return (ROLE_HIERARCHY[actorRole] || 0) >= (ROLE_HIERARCHY[targetRole] || 0);
}

async function list(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, display_name, display_name_en, email, role, active, last_login, created_at FROM users ORDER BY id ASC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { username, password, display_name, display_name_en, email, role = 'user', active = true } = req.body;
    if (!username || !password || !display_name || !email) {
      return res.status(400).json({ error: 'username, password, display_name, email required' });
    }
    if (!canAssign(req.user.role, role)) {
      return res.status(403).json({ error: 'You cannot assign this role' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, display_name, display_name_en, email, role, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, username, display_name, display_name_en, email, role, active, created_at`,
      [username.trim(), hash, display_name, display_name_en || '', email, role, active]
    );
    auditService.log(req.user, 'user.create', 'user', rows[0].id, rows[0].username,
      { role });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { display_name, display_name_en, email, role, active, password } = req.body;

    if (role && !canAssign(req.user.role, role)) {
      return res.status(403).json({ error: 'You cannot assign this role' });
    }

    // Fetch current row to protect against escalation
    const { rows: existing } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!existing[0]) return res.status(404).json({ error: 'User not found' });
    if (!canAssign(req.user.role, existing[0].role) && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Insufficient permissions to edit this user' });
    }

    const sets = [];
    const vals = [];
    let p = 1;
    if (display_name    !== undefined) { sets.push(`display_name=$${p++}`);    vals.push(display_name); }
    if (display_name_en !== undefined) { sets.push(`display_name_en=$${p++}`); vals.push(display_name_en); }
    if (email           !== undefined) { sets.push(`email=$${p++}`);           vals.push(email); }
    if (role            !== undefined) { sets.push(`role=$${p++}`);            vals.push(role); }
    if (active          !== undefined) { sets.push(`active=$${p++}`);          vals.push(active); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      sets.push(`password_hash=$${p++}`); vals.push(hash);
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(',')} WHERE id=$${p} RETURNING id, username, display_name, display_name_en, email, role, active, last_login, created_at`,
      vals
    );
    const changedFields = Object.keys(req.body).filter(k => k !== 'password');
    auditService.log(req.user, 'user.update', 'user', id, rows[0].username,
      { changed_fields: changedFields });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const { rows: existing } = await pool.query('SELECT role, username FROM users WHERE id = $1', [id]);
    if (!existing[0]) return res.status(404).json({ error: 'User not found' });
    if (!canAssign(req.user.role, existing[0].role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    auditService.log(req.user, 'user.delete', 'user', id, existing[0].username, {});
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
