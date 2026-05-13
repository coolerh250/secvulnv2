const https = require('https');
const pool  = require('../db');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { timeout: 30000 }, res => {
      if (res.statusCode !== 200) return reject(new Error(`EPSS fetch failed: HTTP ${res.statusCode}`));
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('EPSS request timed out')); });
    req.end();
  });
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function syncEpss() {
  const { rows } = await pool.query('SELECT id FROM vulnerabilities');
  if (!rows.length) return { updated: 0 };

  const ids = rows.map(r => r.id);
  let updated = 0;

  for (const chunk of chunkArray(ids, 1000)) {
    const url = `https://api.first.org/data/1.0/epss?cves=${chunk.join(',')}`;
    let json;
    try {
      json = JSON.parse(await fetchText(url));
    } catch (err) {
      console.error('[EPSS] fetch chunk failed:', err.message);
      continue;
    }
    for (const item of (json.data || [])) {
      const score      = parseFloat(item.epss);
      const percentile = parseFloat(item.percentile);
      if (isNaN(score) || isNaN(percentile)) continue;
      await pool.query(
        'UPDATE vulnerabilities SET epss_score=$1, epss_percentile=$2 WHERE id=$3',
        [score, percentile, item.cve]
      );
      updated++;
    }
  }

  console.log(`[EPSS] Updated ${updated} CVE scores`);
  return { updated };
}

module.exports = { syncEpss };
