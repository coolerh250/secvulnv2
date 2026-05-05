const https = require('https');
const pool  = require('../db');

// Which NVD keyword queries each source ID maps to
const SOURCE_MAP = {
  nvd:      [{ keyword: 'Fortinet', vendor: 'Fortinet' }, { keyword: 'Palo Alto Networks', vendor: 'Palo Alto' }],
  fortinet: [{ keyword: 'Fortinet', vendor: 'Fortinet' }],
  paloalto: [{ keyword: 'Palo Alto Networks', vendor: 'Palo Alto' }],
};

// ---------------------------------------------------------------------------
// NVD API helper
// ---------------------------------------------------------------------------

function nvdRequest(params, apiKey) {
  // NVD requires literal colons in date strings — do NOT use encodeURIComponent on values
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${String(v).replace(/ /g, '%20')}`)
    .join('&');

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'services.nvd.nist.gov',
      path:     `/rest/json/cves/2.0?${qs}`,
      method:   'GET',
      headers:  apiKey ? { apiKey } : {},
      timeout:  30000,
    }, res => {
      if (res.statusCode === 403) return reject(new Error('NVD rate limit exceeded or invalid API key'));
      if (res.statusCode !== 200) return reject(new Error(`NVD API returned HTTP ${res.statusCode}`));
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('NVD returned invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('NVD request timed out')); });
    req.end();
  });
}

// ---------------------------------------------------------------------------
// CVE data parsers
// ---------------------------------------------------------------------------

function parseCvss(metrics) {
  for (const key of ['cvssMetricV31', 'cvssMetricV30']) {
    const arr = metrics?.[key];
    if (!arr?.length) continue;
    const m = arr.find(x => x.type === 'Primary') || arr[0];
    return { score: m.cvssData.baseScore, severity: m.cvssData.baseSeverity };
  }
  const v2 = metrics?.cvssMetricV2?.[0];
  if (v2) {
    const s = v2.cvssData.baseScore;
    return { score: s, severity: s >= 7 ? 'HIGH' : s >= 4 ? 'MEDIUM' : 'LOW' };
  }
  return { score: 0.0, severity: 'MEDIUM' };
}

function collectMatches(nodes, out = []) {
  for (const node of (nodes || [])) {
    for (const m of (node.cpeMatch || [])) out.push(m);
    collectMatches(node.nodes, out);
  }
  return out;
}

function parseConfigurations(configurations, vendorPrefix) {
  const products = new Set();
  const versions = new Set();

  for (const config of (configurations || [])) {
    for (const m of collectMatches(config.nodes)) {
      const cpe = m.criteria || '';
      if (!cpe.toLowerCase().includes(vendorPrefix)) continue;

      const parts = cpe.split(':');
      const prod  = parts[4] || '';
      if (prod && prod !== '*' && prod !== '-') products.add(prod.replace(/_/g, ' '));

      if (m.versionStartIncluding && m.versionEndExcluding) {
        versions.add(`${m.versionStartIncluding} – <${m.versionEndExcluding}`);
      } else if (m.versionStartIncluding && m.versionEndIncluding) {
        versions.add(`${m.versionStartIncluding} – ${m.versionEndIncluding}`);
      } else {
        const ver = parts[5] || '';
        if (ver && ver !== '*' && ver !== '-') versions.add(ver);
      }
    }
  }

  return {
    product:          [...products].slice(0, 3).join(', ') || null,
    firmwareVersions: [...versions].slice(0, 12),
  };
}

function buildTitle(desc) {
  const first = (desc.split('. ')[0] || desc).trim();
  return first.length > 120 ? first.slice(0, 117) + '...' : first;
}

function buildRecommendation(severity, vendor, zh) {
  if (zh) {
    if (severity === 'CRITICAL') return `此為嚴重弱點，請立即更新 ${vendor} 至最新安全修補版本，並評估系統是否已遭入侵`;
    if (severity === 'HIGH')     return `請儘速更新 ${vendor} 至已修補版本，以消除此高風險弱點`;
    return `請依例行維護排程更新 ${vendor} 至最新版本`;
  }
  if (severity === 'CRITICAL') return `Immediately update ${vendor} to the latest security patch and assess for indicators of compromise`;
  if (severity === 'HIGH')     return `Update ${vendor} to the patched version as soon as possible`;
  return `Update ${vendor} to the latest version during your next maintenance window`;
}

// ---------------------------------------------------------------------------
// DB upsert — returns 'inserted' | 'updated' | 'skipped'
// Uses xmax trick to detect insert vs update without a pre-SELECT
// ---------------------------------------------------------------------------

async function upsertCve(cve, vendor) {
  const id     = cve.id;
  const descEn = (cve.descriptions || []).find(d => d.lang === 'en')?.value || '';
  if (!descEn || !id) return 'skipped';

  const { score, severity } = parseCvss(cve.metrics);
  const published = (cve.published || cve.lastModified || '').slice(0, 10);
  if (!published) return 'skipped';

  const vendorPrefix = vendor.toLowerCase().split(' ')[0]; // 'fortinet' | 'palo'
  const { product, firmwareVersions } = parseConfigurations(cve.configurations, vendorPrefix);
  const titleEn = buildTitle(descEn);
  const refs    = JSON.stringify((cve.references || []).map(r => r.url).slice(0, 15));

  const { rows } = await pool.query(
    `INSERT INTO vulnerabilities
       (id, vendor, product, firmware_versions, cvss, severity, published,
        title, title_en, description, description_en,
        source, recommendation, recommendation_en, refs, handle_status, updated_at)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,'pending',NOW())
     ON CONFLICT (id) DO UPDATE SET
       vendor            = EXCLUDED.vendor,
       product           = EXCLUDED.product,
       firmware_versions = CASE WHEN jsonb_array_length(EXCLUDED.firmware_versions) > 0
                                THEN EXCLUDED.firmware_versions
                                ELSE vulnerabilities.firmware_versions END,
       cvss              = EXCLUDED.cvss,
       severity          = EXCLUDED.severity,
       published         = EXCLUDED.published,
       title             = EXCLUDED.title,
       title_en          = EXCLUDED.title_en,
       description       = EXCLUDED.description,
       description_en    = EXCLUDED.description_en,
       source            = EXCLUDED.source,
       recommendation    = EXCLUDED.recommendation,
       recommendation_en = EXCLUDED.recommendation_en,
       refs              = EXCLUDED.refs,
       updated_at        = NOW()
     RETURNING (xmax::text::bigint = 0) AS was_inserted`,
    [
      id, vendor, product || vendor,
      JSON.stringify(firmwareVersions),
      score, severity, published,
      titleEn, titleEn, descEn, descEn,
      'NVD',
      buildRecommendation(severity, vendor, true),
      buildRecommendation(severity, vendor, false),
      refs,
    ]
  );

  return rows[0]?.was_inserted ? 'inserted' : 'updated';
}

// ---------------------------------------------------------------------------
// Sync one vendor against NVD
// ---------------------------------------------------------------------------

async function syncVendor(keyword, vendor, apiKey, sinceDate) {
  // NVD rate limits: 50 req/30s with key, 5 req/30s without
  const delayMs = apiKey ? 700 : 6200;

  // Use sinceDate only if it's a real past sync (more than 7 days ago).
  // Seed data contains fake future/recent timestamps — treat those as first-run.
  const TWO_YEARS_AGO = Date.now() - 2 * 365 * 86400000;
  const SEVEN_DAYS_AGO = Date.now() - 7 * 86400000;
  const sinceParsed = sinceDate && sinceDate !== '—' ? new Date(sinceDate).getTime() : 0;
  const useIncremental = sinceParsed > 0 && sinceParsed < SEVEN_DAYS_AGO;
  const fromDate = (useIncremental ? new Date(sinceParsed) : new Date(TWO_YEARS_AGO))
    .toISOString().slice(0, 23);

  let startIndex   = 0;
  let totalResults = null;
  let inserted = 0, updated = 0;

  do {
    const data = await nvdRequest({
      keywordSearch:  keyword,
      pubStartDate:   fromDate,
      resultsPerPage: 2000,
      startIndex,
    }, apiKey);

    if (totalResults === null) totalResults = data.totalResults || 0;
    const vulns = data.vulnerabilities || [];
    if (!vulns.length) break;

    for (const item of vulns) {
      const action = await upsertCve(item.cve, vendor);
      if (action === 'inserted') inserted++;
      else if (action === 'updated') updated++;
    }

    startIndex += vulns.length;
    if (startIndex < totalResults) await new Promise(r => setTimeout(r, delayMs));
  } while (startIndex < totalResults);

  return { inserted, updated, total: totalResults || 0 };
}

// ---------------------------------------------------------------------------
// Public entry point called by settingsController
// ---------------------------------------------------------------------------

async function sync(sourceId, settings) {
  const vendors = SOURCE_MAP[sourceId];
  if (!vendors) throw new Error(`NVD sync not configured for source "${sourceId}"`);

  const src       = (settings.data_sources || []).find(s => s.id === sourceId);
  const apiKey    = src?.apiKey    || null;
  const sinceDate = src?.lastSync  || null;

  let totalInserted = 0, totalUpdated = 0;

  for (const { keyword, vendor } of vendors) {
    const r = await syncVendor(keyword, vendor, apiKey, sinceDate);
    totalInserted += r.inserted;
    totalUpdated  += r.updated;
  }

  return { inserted: totalInserted, updated: totalUpdated };
}

module.exports = { sync, SOURCE_MAP };
