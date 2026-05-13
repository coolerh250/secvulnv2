const pool = require('../db');

async function stats(req, res, next) {
  try {
    const [{ rows: vulnRows }, { rows: deviceRows }, { rows: vendorRows }, { rows: recentRows }, { rows: slaRows }] = await Promise.all([
      pool.query(`SELECT severity, handle_status FROM vulnerabilities`),
      pool.query(`SELECT status FROM devices`),
      pool.query(`SELECT vendor, COUNT(*)::int AS cnt FROM vulnerabilities GROUP BY vendor`),
      pool.query(`SELECT severity, COUNT(*)::int AS cnt FROM vulnerabilities WHERE published >= CURRENT_DATE - INTERVAL '30 days' GROUP BY severity`),
      pool.query(`SELECT
        COUNT(*)::int                                                                       AS total_with_sla,
        COUNT(*) FILTER (WHERE handle_status IN ('fixed','accepted'))::int                 AS remediated,
        COUNT(*) FILTER (WHERE handle_status IN ('fixed','accepted')
                           AND updated_at::date <= due_date)::int                          AS on_time
      FROM vulnerabilities WHERE due_date IS NOT NULL`),
    ]);

    const severity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const status   = { pending: 0, fixed: 0, accepted: 0, deferred: 0 };
    vulnRows.forEach(v => {
      if (severity[v.severity]   !== undefined) severity[v.severity]++;
      if (status[v.handle_status] !== undefined) status[v.handle_status]++;
    });

    const deviceStatus = { vulnerable: 0, updateAvail: 0, upToDate: 0 };
    deviceRows.forEach(d => { if (deviceStatus[d.status] !== undefined) deviceStatus[d.status]++; });

    const vendorCounts = {};
    vendorRows.forEach(r => { vendorCounts[r.vendor] = r.cnt; });

    const recent30BySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    recentRows.forEach(r => { if (recent30BySeverity[r.severity] !== undefined) recent30BySeverity[r.severity] = r.cnt; });
    const recent30Total = Object.values(recent30BySeverity).reduce((a, b) => a + b, 0);

    const sla = slaRows[0] || { total_with_sla: 0, remediated: 0, on_time: 0 };
    const slaComplianceRate = sla.remediated > 0
      ? Math.round((sla.on_time / sla.remediated) * 100)
      : null;

    res.json({
      total:         vulnRows.length,
      severity,
      status,
      affectedDevices: deviceStatus.vulnerable,
      deviceStatus,
      vendorCounts,
      recent30: { total: recent30Total, bySeverity: recent30BySeverity },
      sla: {
        totalWithDeadline: sla.total_with_sla,
        remediated:        sla.remediated,
        onTime:            sla.on_time,
        complianceRate:    slaComplianceRate,
      },
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
         AND ra.review_date <= CURRENT_DATE + INTERVAL '90 days'
       ORDER BY ra.review_date ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function overdue(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT v.id, v.title, v.title_en, v.severity, v.cvss, v.handle_status, v.due_date,
              u.username AS assignee_username
       FROM vulnerabilities v
       LEFT JOIN users u ON u.id = v.assignee_id
       WHERE v.due_date < CURRENT_DATE
         AND v.handle_status NOT IN ('fixed', 'accepted')
       ORDER BY v.due_date ASC
       LIMIT 20`
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

module.exports = { stats, trend, reviews, overdue, rebuildTrendsHandler };
