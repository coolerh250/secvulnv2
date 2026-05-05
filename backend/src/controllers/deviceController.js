const pool = require('../db');

// ---------------------------------------------------------------------------
// Device type → CPE product name mapping (lowercase)
// ---------------------------------------------------------------------------

const DEVICE_TYPE_PRODUCTS = {
  'FortiGate':     ['fortios', 'fortios ips engine'],
  'FortiWiFi':     ['fortios', 'fortiwifi'],
  'FortiAnalyzer': ['fortianalyzer'],
  'FortiManager':  ['fortimanager'],
  'FortiProxy':    ['fortiproxy'],
  'FortiADC':      ['fortiadc'],
  'FortiMail':     ['fortimail'],
  'FortiWeb':      ['fortiweb'],
  'PA-Series':     ['pan-os'],
  'Panorama':      ['panorama', 'pan-os'],
};

function isProductMatch(deviceType, affectedProducts) {
  if (!deviceType) return true;
  const expected = DEVICE_TYPE_PRODUCTS[deviceType];
  if (!expected) return true;
  if (!affectedProducts || affectedProducts.length === 0) return true;
  const ap = affectedProducts.map(p => String(p).toLowerCase());
  return expected.some(e => ap.some(p => p === e || p.startsWith(e)));
}

// ---------------------------------------------------------------------------
// Firmware version matching helpers
// ---------------------------------------------------------------------------

// Parse "7.0.14" or "v7.0.14" → [7, 0, 14]
function parseVer(str) {
  return String(str).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
}

// -1 / 0 / 1
function cmpVer(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

// Does this CVE's firmwareVersions array affect deviceFirmware?
// Range format from nvdSync: "7.0.0 – <7.0.15" | "7.0.0 – 7.0.14" | "7.4.0"
// Empty array → no CPE data → conservatively assume affected
function affectsDevice(deviceFirmware, firmwareVersions) {
  if (!deviceFirmware) return true;
  if (!firmwareVersions || firmwareVersions.length === 0) return true;
  const dev = parseVer(deviceFirmware);
  for (const range of firmwareVersions) {
    const parts = range.split(' – '); // ' – ' en-dash
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

async function countAffectedVulns(vendor, firmware, deviceType) {
  const { rows } = await pool.query(
    `SELECT firmware_versions, affected_products FROM vulnerabilities
     WHERE vendor = $1 AND handle_status NOT IN ('fixed')`,
    [vendor]
  );
  return rows.filter(r =>
    isProductMatch(deviceType, r.affected_products) &&
    affectsDevice(firmware, r.firmware_versions)
  ).length;
}

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

async function scan(req, res, next) {
  try {
    const { id } = req.params;
    const deviceRes = await pool.query('SELECT * FROM devices WHERE id = $1', [id]);
    if (!deviceRes.rows[0]) return res.status(404).json({ error: 'Device not found' });

    const device = deviceRes.rows[0];
    const vuln_count = await countAffectedVulns(device.vendor, device.firmware, device.device_type);
    const status = vuln_count > 0 ? 'vulnerable' : 'upToDate';

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
    const { rows: devices } = await pool.query('SELECT * FROM devices');
    if (devices.length === 0) return res.json({ updated: 0, devices: [] });
    const updated = [];
    for (const device of devices) {
      const vuln_count = await countAffectedVulns(device.vendor, device.firmware, device.device_type);
      const status = vuln_count > 0 ? 'vulnerable' : 'upToDate';
      const { rows } = await pool.query(
        `UPDATE devices SET status=$1, vuln_count=$2, last_check=CURRENT_DATE, updated_at=NOW() WHERE id=$3 RETURNING *`,
        [status, vuln_count, device.id]
      );
      updated.push(rows[0]);
    }
    res.json({ updated: updated.length, devices: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, scan, scanAll };
