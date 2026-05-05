const pool = require('../db');

async function stats(req, res, next) {
  try {
    const { rows: vulnRows } = await pool.query(
      `SELECT severity, handle_status FROM vulnerabilities`
    );
    const { rows: deviceRows } = await pool.query(
      `SELECT status FROM devices`
    );

    const severity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const status   = { pending: 0, fixed: 0, accepted: 0, deferred: 0 };
    vulnRows.forEach(v => {
      if (severity[v.severity]   !== undefined) severity[v.severity]++;
      if (status[v.handle_status] !== undefined) status[v.handle_status]++;
    });

    const deviceStatus = { vulnerable: 0, updateAvail: 0, upToDate: 0 };
    deviceRows.forEach(d => { if (deviceStatus[d.status] !== undefined) deviceStatus[d.status]++; });

    res.json({
      total:         vulnRows.length,
      severity,
      status,
      affectedDevices: deviceStatus.vulnerable,
      deviceStatus,
    });
  } catch (err) {
    next(err);
  }
}

async function trend(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT month, year, critical_count, high_count, medium_count, low_count
       FROM vuln_trends ORDER BY year ASC,
       CASE month WHEN 'Jan' THEN 1 WHEN 'Feb' THEN 2 WHEN 'Mar' THEN 3 WHEN 'Apr' THEN 4
         WHEN 'May' THEN 5 WHEN 'Jun' THEN 6 WHEN 'Jul' THEN 7 WHEN 'Aug' THEN 8
         WHEN 'Sep' THEN 9 WHEN 'Oct' THEN 10 WHEN 'Nov' THEN 11 WHEN 'Dec' THEN 12 END ASC`
    );
    res.json(rows.map(r => ({
      month:    r.month,
      year:     r.year,
      critical: r.critical_count,
      high:     r.high_count,
      medium:   r.medium_count,
      low:      r.low_count,
    })));
  } catch (err) {
    next(err);
  }
}

async function reviews(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT v.*, ra.review_date, ra.reason, ra.mitigation, ra.mitigation_en, ra.accepted_date
       FROM vulnerabilities v
       JOIN risk_acceptances ra ON ra.vuln_id = v.id
       WHERE v.handle_status = 'accepted'
       ORDER BY ra.review_date ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function rebuildTrendsHandler(req, res, next) {
  try {
    const { rebuildTrends } = require('../services/nvdSync');
    const months = await rebuildTrends();
    res.json({ ok: true, months });
  } catch (err) {
    next(err);
  }
}

module.exports = { stats, trend, reviews, rebuildTrendsHandler };
