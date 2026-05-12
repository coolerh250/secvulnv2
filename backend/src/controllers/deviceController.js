const pool = require('../db');
const { DEVICE_TYPE_PRODUCTS, DEVICE_TYPE_OPTIONS } = require('../lib/deviceTypes');

function isProductMatch(deviceType, affectedProducts, productText) {
  if (!deviceType) return true;
  const expected = DEVICE_TYPE_PRODUCTS[deviceType];
  if (!expected) return true;

  if (affectedProducts && affectedProducts.length > 0) {
    const ap = affectedProducts.map(p => String(p).toLowerCase());
    return expected.some(e => ap.some(p => p === e || p.startsWith(e)));
  }

  if (productText) {
    const lower = productText.toLowerCase();
    return expected.some(e => lower.includes(e));
  }

  return true;
}

function parseVer(str) {
  return String(str).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
}

function cmpVer(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

// Returns true when firmwareVersions contains at least one range with an upper
// bound, which implies a fixed firmware version exists above that bound.
function hasKnownFix(firmwareVersions) {
  if (!firmwareVersions || firmwareVersions.length === 0) return false;
  return firmwareVersions.some(range => range.split(/\s[–-]\s/).length >= 2);
}

// Determine device status from the count of unresolved vulns and the full set
// of matched (affected) vulns.
//   upToDate   — no unresolved vulns
//   updateAvail — all matched vulns have a known fix version (range with upper bound)
//   vulnerable  — at least one matched vuln has no known fix
function computeStatus(vuln_count, matchedVulns) {
  if (vuln_count === 0) return 'upToDate';
  return matchedVulns.every(v => hasKnownFix(v.firmware_versions))
    ? 'updateAvail'
    : 'vulnerable';
}

// Used when we only have vuln_count (e.g. after a manual handle_status change)
// and need to re-derive status by re-querying the DB for this device's matched vulns.
async function getDeviceStatus(device, vuln_count) {
  if (vuln_count === 0) return 'upToDate';
  const { rows } = await pool.query(
    `SELECT firmware_versions, affected_products, product
     FROM vulnerabilities WHERE vendor = $1 AND handle_status != 'fixed'`,
    [device.vendor]
  );
  const matched = rows.filter(r =>
    isProductMatch(device.device_type, r.affected_products, r.product) &&
    affectsDevice(device.firmware, r.firmware_versions)
  );
  return computeStatus(vuln_count, matched);
}

// Range format: "7.0.0 – <7.0.15" | "7.0.0 – 7.0.14" | "7.4.0"
// Empty array → no CPE data → conservatively assume affected
function affectsDevice(deviceFirmware, firmwareVersions) {
  if (!deviceFirmware) return true;
  if (!firmwareVersions || firmwareVersions.length === 0) return true;
  const dev = parseVer(deviceFirmware);
  for (const range of firmwareVersions) {
    const parts = range.split(/\s[–-]\s/); // en-dash or hyphen
    if (parts.length === 1) {
      if (cmpVer(dev, parseVer(parts[0].trim())) === 0) return true;
    } else {
      const start = parseVer(parts[0].trim());
      const endStr = parts[1].trim();
      const exclusive = endStr.startsWith('<');
      const end = parseVer(endStr.replace('<', '').trim());
      const inRange = cmpVer(dev, start) >= 0 &&
        (exclusive ? cmpVer(dev, end) < 0 : cmpVer(dev, end) <= 0);
      if (inRange) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Junction table helpers
// ---------------------------------------------------------------------------

// Sync device_vulnerabilities for one device given a list of matched vuln IDs.
// Inserts new rows (preserving existing device-level handle_status), removes
// rows for vulns that no longer match, then returns the updated non-fixed count.
async function syncDeviceVulns(deviceId, matchedIds) {
  if (matchedIds.length > 0) {
    await Promise.all(matchedIds.map(id =>
      pool.query(
        `INSERT INTO device_vulnerabilities (device_id, vuln_id)
         VALUES ($1, $2) ON CONFLICT (device_id, vuln_id) DO NOTHING`,
        [deviceId, id]
      )
    ));
    await pool.query(
      `DELETE FROM device_vulnerabilities
       WHERE device_id = $1 AND NOT (vuln_id = ANY($2::varchar[]))`,
      [deviceId, matchedIds]
    );
  } else {
    await pool.query(`DELETE FROM device_vulnerabilities WHERE device_id = $1`, [deviceId]);
  }

  const { rows: [{ cnt }] } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM device_vulnerabilities
     WHERE device_id = $1 AND handle_status != 'fixed'`,
    [deviceId]
  );
  return cnt;
}

// ---------------------------------------------------------------------------
// Device CRUD
// ---------------------------------------------------------------------------

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
    const { name, name_en, vendor, device_type, model, firmware } = req.body;
    if (!name || !model || !firmware) {
      return res.status(400).json({ error: 'name, model, and firmware are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO devices (name, name_en, vendor, device_type, model, firmware, status, last_check, vuln_count)
       VALUES ($1, $2, $3, $4, $5, $6, 'upToDate', CURRENT_DATE, 0) RETURNING *`,
      [name, name_en || name, vendor || 'Fortinet', device_type || '', model, firmware]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, name_en, vendor, device_type, model, firmware } = req.body;
    const { rows } = await pool.query(
      `UPDATE devices SET name=$1, name_en=$2, vendor=$3, device_type=$4, model=$5, firmware=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, name_en || name, vendor, device_type || '', model, firmware, id]
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

// ---------------------------------------------------------------------------
// Scan (populates device_vulnerabilities)
// ---------------------------------------------------------------------------

async function scan(req, res, next) {
  try {
    const { id } = req.params;
    const deviceRes = await pool.query('SELECT * FROM devices WHERE id = $1', [id]);
    if (!deviceRes.rows[0]) return res.status(404).json({ error: 'Device not found' });
    const device = deviceRes.rows[0];

    const { rows: vulns } = await pool.query(
      `SELECT id, firmware_versions, affected_products, product
       FROM vulnerabilities WHERE vendor = $1 AND handle_status != 'fixed'`,
      [device.vendor]
    );
    const matchedVulns = vulns.filter(r =>
      isProductMatch(device.device_type, r.affected_products, r.product) &&
      affectsDevice(device.firmware, r.firmware_versions)
    );
    const matchedIds = matchedVulns.map(r => r.id);

    const vuln_count = await syncDeviceVulns(device.id, matchedIds);
    const status = computeStatus(vuln_count, matchedVulns);

    const { rows } = await pool.query(
      `UPDATE devices SET status=$1, vuln_count=$2, last_check=CURRENT_DATE, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [status, vuln_count, id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function scanAll(req, res, next) {
  try {
    const [{ rows: devices }, { rows: allVulns }] = await Promise.all([
      pool.query('SELECT * FROM devices'),
      pool.query(
        `SELECT id, vendor, firmware_versions, affected_products, product
         FROM vulnerabilities WHERE handle_status != 'fixed'`
      ),
    ]);
    if (devices.length === 0) return res.json({ updated: 0, devices: [] });

    const vulnsByVendor = {};
    for (const v of allVulns) {
      (vulnsByVendor[v.vendor] = vulnsByVendor[v.vendor] || []).push(v);
    }

    const updated = await Promise.all(devices.map(async device => {
      const vendorVulns = vulnsByVendor[device.vendor] || [];
      const matchedVulns = vendorVulns.filter(r =>
        isProductMatch(device.device_type, r.affected_products, r.product) &&
        affectsDevice(device.firmware, r.firmware_versions)
      );
      const matchedIds = matchedVulns.map(r => r.id);

      const vuln_count = await syncDeviceVulns(device.id, matchedIds);
      const status = computeStatus(vuln_count, matchedVulns);
      const { rows } = await pool.query(
        `UPDATE devices SET status=$1, vuln_count=$2, last_check=CURRENT_DATE, updated_at=NOW()
         WHERE id=$3 RETURNING *`,
        [status, vuln_count, device.id]
      );
      return rows[0];
    }));

    res.json({ updated: updated.length, devices: updated });
  } catch (err) {
    next(err);
  }
}

// Recalculate vuln_count for all devices of a given vendor.
// Called fire-and-forget when a vulnerability's global fixed status changes.
async function recalcForVendor(vendor) {
  const [{ rows: devices }, { rows: vulns }] = await Promise.all([
    pool.query('SELECT * FROM devices WHERE vendor = $1', [vendor]),
    pool.query(
      `SELECT id, firmware_versions, affected_products, product
       FROM vulnerabilities WHERE vendor = $1 AND handle_status != 'fixed'`,
      [vendor]
    ),
  ]);
  await Promise.all(devices.map(async device => {
    const matchedVulns = vulns.filter(r =>
      isProductMatch(device.device_type, r.affected_products, r.product) &&
      affectsDevice(device.firmware, r.firmware_versions)
    );
    const matchedIds = matchedVulns.map(r => r.id);
    const vuln_count = await syncDeviceVulns(device.id, matchedIds);
    const status = computeStatus(vuln_count, matchedVulns);
    await pool.query(
      `UPDATE devices SET status=$1, vuln_count=$2, last_check=CURRENT_DATE, updated_at=NOW()
       WHERE id=$3`,
      [status, vuln_count, device.id]
    );
  }));
}

// ---------------------------------------------------------------------------
// Per-device vulnerability endpoints
// ---------------------------------------------------------------------------

async function getDeviceVulns(req, res, next) {
  try {
    const { id } = req.params;
    const { rows: dvRows } = await pool.query(
      `SELECT vuln_id, handle_status, updated_at, updated_by_name FROM device_vulnerabilities WHERE device_id = $1`,
      [id]
    );
    if (dvRows.length === 0) return res.json([]);

    const vulnIds = dvRows.map(r => r.vuln_id);
    const [{ rows: vulns }, { rows: notes }, { rows: accepts }] = await Promise.all([
      pool.query(`SELECT * FROM vulnerabilities WHERE id = ANY($1)`, [vulnIds]),
      pool.query(
        `SELECT * FROM vuln_notes WHERE vuln_id = ANY($1) AND device_id = $2 ORDER BY created_at ASC`,
        [vulnIds, id]
      ),
      pool.query(
        `SELECT * FROM risk_acceptances WHERE vuln_id = ANY($1) AND device_id = $2 ORDER BY created_at DESC`,
        [vulnIds, id]
      ),
    ]);

    const dvMap     = Object.fromEntries(dvRows.map(r => [r.vuln_id, r]));
    const notesMap  = {};
    const acceptMap = {};
    notes.forEach(n   => { (notesMap[n.vuln_id]  = notesMap[n.vuln_id]  || []).push(n); });
    accepts.forEach(a => { acceptMap[a.vuln_id] = acceptMap[a.vuln_id] || a; });

    const data = vulns.map(v => ({
      ...v,
      firmware:       v.firmware_versions,
      handle_status:     dvMap[v.id]?.handle_status || 'pending',
      status_updated_at: dvMap[v.id]?.updated_at || null,
      status_updated_by: dvMap[v.id]?.updated_by_name || null,
      notes:             notesMap[v.id]  || [],
      riskAcceptance:    acceptMap[v.id] || null,
    }));

    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function updateDeviceVulnStatus(req, res, next) {
  try {
    const { id, vulnId } = req.params;
    const { handle_status } = req.body;
    const allowed = ['pending', 'fixed', 'accepted', 'deferred'];
    if (!allowed.includes(handle_status)) {
      return res.status(400).json({ error: 'Invalid handle_status' });
    }

    const { rowCount } = await pool.query(
      `UPDATE device_vulnerabilities SET handle_status = $1, updated_at = NOW(), updated_by_name = $4
       WHERE device_id = $2 AND vuln_id = $3`,
      [handle_status, id, vulnId, req.user.username]
    );
    if (!rowCount) return res.status(404).json({ error: 'Device vulnerability record not found' });

    const { rows: [{ cnt }] } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM device_vulnerabilities
       WHERE device_id = $1 AND handle_status != 'fixed'`,
      [id]
    );
    const { rows: [device] } = await pool.query('SELECT * FROM devices WHERE id = $1', [id]);
    const status = await getDeviceStatus(device, cnt);
    await pool.query(
      `UPDATE devices SET status = $1, vuln_count = $2, updated_at = NOW() WHERE id = $3`,
      [status, cnt, id]
    );

    res.json({
      handle_status,
      status_updated_at: new Date().toISOString(),
      status_updated_by: req.user.username,
      device_id: parseInt(id),
      vuln_id: vulnId,
    });
  } catch (err) {
    next(err);
  }
}

async function addDeviceVulnNote(req, res, next) {
  try {
    const { id, vulnId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Note text required' });
    const { rows } = await pool.query(
      `INSERT INTO vuln_notes (vuln_id, text, author, user_id, device_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [vulnId, text.trim(), req.user.username, req.user.id, id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function setDeviceVulnRiskAcceptance(req, res, next) {
  try {
    const { id, vulnId } = req.params;
    const { reason, reason_detail, mitigation, mitigation_en, review_date, note } = req.body;
    if (!reason || !mitigation || !review_date) {
      return res.status(400).json({ error: 'reason, mitigation, and review_date are required' });
    }

    await pool.query(
      `UPDATE device_vulnerabilities SET handle_status = 'accepted', updated_at = NOW(), updated_by_name = $3
       WHERE device_id = $1 AND vuln_id = $2`,
      [id, vulnId, req.user.username]
    );

    await pool.query(
      `DELETE FROM risk_acceptances WHERE vuln_id = $1 AND device_id = $2`,
      [vulnId, id]
    );
    const { rows } = await pool.query(
      `INSERT INTO risk_acceptances
         (vuln_id, device_id, reason, reason_detail, mitigation, mitigation_en,
          review_date, accepted_date, note, accepted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE,$8,$9) RETURNING *`,
      [vulnId, id, reason, reason_detail || '', mitigation, mitigation_en || '',
       review_date, note || '', req.user.id]
    );

    const { rows: [{ cnt }] } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM device_vulnerabilities
       WHERE device_id = $1 AND handle_status != 'fixed'`,
      [id]
    );
    const { rows: [device] } = await pool.query('SELECT * FROM devices WHERE id = $1', [id]);
    const devStatus = await getDeviceStatus(device, cnt);
    await pool.query(
      `UPDATE devices SET status = $1, vuln_count = $2, updated_at = NOW() WHERE id = $3`,
      [devStatus, cnt, id]
    );

    res.status(201).json({
      ...rows[0],
      status_updated_at: new Date().toISOString(),
      status_updated_by: req.user.username,
    });
  } catch (err) {
    next(err);
  }
}

function getDeviceTypes(req, res) {
  res.json({ products: DEVICE_TYPE_PRODUCTS, options: DEVICE_TYPE_OPTIONS });
}

module.exports = {
  list, create, update, remove, scan, scanAll, recalcForVendor,
  getDeviceVulns, updateDeviceVulnStatus, addDeviceVulnNote, setDeviceVulnRiskAcceptance,
  getDeviceTypes,
};
