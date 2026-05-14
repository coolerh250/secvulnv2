const https = require('https');
const pool  = require('../db');

const CUTOFF_YEARS = 5;

function getCutoffDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - CUTOFF_YEARS);
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

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
    return { score: m.cvssData.baseScore, severity: m.cvssData.baseSeverity, vector: m.cvssData.vectorString || null };
  }
  const v2 = metrics?.cvssMetricV2?.[0];
  if (v2) {
    const s = v2.cvssData.baseScore;
    return { score: s, severity: s >= 7 ? 'HIGH' : s >= 4 ? 'MEDIUM' : 'LOW', vector: v2.cvssData.vectorString || null };
  }
  return { score: 0.0, severity: 'MEDIUM', vector: null };
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
  const rawProducts = new Set(); // lowercase CPE product names for matching
  const versions = new Set();

  for (const config of (configurations || [])) {
    for (const m of collectMatches(config.nodes)) {
      const cpe = m.criteria || '';
      if (!cpe.toLowerCase().includes(vendorPrefix)) continue;

      const parts = cpe.split(':');
      const prod  = parts[4] || '';
      if (prod && prod !== '*' && prod !== '-') {
        products.add(prod.replace(/_/g, ' '));
        rawProducts.add(prod.toLowerCase().replace(/_/g, ' '));
      }

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
    affectedProducts: [...rawProducts],
  };
}

// Layer 2 fallback: fetch version ranges from vendor advisory URL in refs
async function fetchAdvisoryVersions(refUrls) {
  const fortiUrl = refUrls.find(u => /fortiguard.*psirt/i.test(u));
  if (!fortiUrl) return [];
  try {
    const html = await fetchText(fortiUrl);
    const versions = [];
    const rangeRe = /(\d+\.\d+[\d.]*)\s*(?:through|to|-|–)\s*(\d+\.\d+[\d.]*)/g;
    let m;
    while ((m = rangeRe.exec(html)) !== null) {
      versions.push(`${m[1]} – ${m[2]}`);
    }
    return [...new Set(versions)].slice(0, 12);
  } catch {
    return [];
  }
}

// Layer 3 fallback: extract version ranges from description text
function parseVersionsFromDescription(descEn) {
  const versions = [];
  const rangeRe = /(\d+\.\d+[\d.]*)\s*[-–]\s*(\d+\.\d+[\d.]*)/g;
  let m;
  while ((m = rangeRe.exec(descEn)) !== null) {
    versions.push(`${m[1]} – ${m[2]}`);
  }
  const beforeRe = /(?:before|prior to|through)\s+(\d+\.\d+[\d.]*)/gi;
  while ((m = beforeRe.exec(descEn)) !== null) {
    versions.push(`< ${m[1]}`);
  }
  return [...new Set(versions)].slice(0, 12);
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

  const { score, severity, vector } = parseCvss(cve.metrics);
  const published = (cve.published || cve.lastModified || '').slice(0, 10);
  if (!published) return 'skipped';
  if (published < getCutoffDate()) return 'skipped';

  const vendorPrefix = vendor.toLowerCase().split(' ')[0]; // 'fortinet' | 'palo'
  let { product, firmwareVersions, affectedProducts } = parseConfigurations(cve.configurations, vendorPrefix);
  const refUrls = (cve.references || []).map(r => r.url).filter(Boolean);

  // Layer 2: fetch versions from vendor advisory URL in refs
  if (!firmwareVersions.length) {
    firmwareVersions = await fetchAdvisoryVersions(refUrls);
  }
  // Layer 3: extract versions from description text
  if (!firmwareVersions.length) {
    firmwareVersions = parseVersionsFromDescription(descEn);
  }

  const vulnStatus = cve.vulnStatus || null;
  const titleEn = buildTitle(descEn);
  const refs    = JSON.stringify(refUrls.slice(0, 15));

  const { rows } = await pool.query(
    `INSERT INTO vulnerabilities
       (id, vendor, product, firmware_versions, affected_products, cvss, severity, published,
        title, title_en, description, description_en,
        source, recommendation, recommendation_en, refs, cvss_vector, vuln_status, handle_status, updated_at)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,'pending',NOW())
     ON CONFLICT (id) DO UPDATE SET
       vendor            = EXCLUDED.vendor,
       product           = CASE
                             WHEN EXCLUDED.product IS DISTINCT FROM EXCLUDED.vendor THEN EXCLUDED.product
                             ELSE COALESCE(vulnerabilities.product, EXCLUDED.product)
                           END,
       firmware_versions = CASE WHEN jsonb_array_length(EXCLUDED.firmware_versions) > 0
                                THEN EXCLUDED.firmware_versions
                                ELSE vulnerabilities.firmware_versions END,
       affected_products = CASE WHEN jsonb_array_length(EXCLUDED.affected_products) > 0
                                THEN EXCLUDED.affected_products
                                ELSE vulnerabilities.affected_products END,
       cvss              = GREATEST(vulnerabilities.cvss, EXCLUDED.cvss),
       severity          = CASE
                             WHEN array_position(ARRAY['LOW','MEDIUM','HIGH','CRITICAL'], vulnerabilities.severity)
                                  > array_position(ARRAY['LOW','MEDIUM','HIGH','CRITICAL'], EXCLUDED.severity)
                             THEN vulnerabilities.severity
                             ELSE EXCLUDED.severity
                           END,
       published         = EXCLUDED.published,
       title             = EXCLUDED.title,
       title_en          = EXCLUDED.title_en,
       description       = EXCLUDED.description,
       description_en    = EXCLUDED.description_en,
       source            = CASE
                             WHEN vulnerabilities.source IS NULL OR vulnerabilities.source = '' OR vulnerabilities.source = 'NVD'
                               THEN 'NVD'
                             WHEN vulnerabilities.source LIKE 'NVD%'
                               THEN vulnerabilities.source
                             ELSE 'NVD + ' || vulnerabilities.source
                           END,
       recommendation    = EXCLUDED.recommendation,
       recommendation_en = EXCLUDED.recommendation_en,
       refs              = EXCLUDED.refs,
       cvss_vector       = EXCLUDED.cvss_vector,
       vuln_status       = EXCLUDED.vuln_status,
       updated_at        = NOW()
     RETURNING (xmax::text::bigint = 0) AS was_inserted`,
    [
      id, vendor, product || vendor,
      JSON.stringify(firmwareVersions),
      JSON.stringify(affectedProducts),
      score, severity, published,
      titleEn, titleEn, descEn, descEn,
      'NVD',
      buildRecommendation(severity, vendor, true),
      buildRecommendation(severity, vendor, false),
      refs,
      vector,
      vulnStatus,
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

  // NVD rules:
  //   - pubStartDate requires pubEndDate and range ≤ 120 days → avoid entirely
  //   - lastModStartDate + lastModEndDate works for incremental sync (range ≤ 120 days)
  //   - No date filter → fetch all matching CVEs (used for initial sync)
  const baseParams = { keywordSearch: keyword, resultsPerPage: 2000 };

  const sinceParsed = sinceDate && sinceDate !== '—' ? new Date(sinceDate).getTime() : 0;
  const now         = Date.now();
  const rangeMs     = now - sinceParsed;
  const DAYS_7      = 7   * 86400000;
  const DAYS_120    = 120 * 86400000;

  // Use incremental window only when lastSync is a genuine past date (> 7 days ago, ≤ 120 days ago)
  if (sinceParsed > 0 && rangeMs > DAYS_7 && rangeMs <= DAYS_120) {
    baseParams.lastModStartDate = new Date(sinceParsed).toISOString().slice(0, 23);
    baseParams.lastModEndDate   = new Date(now).toISOString().slice(0, 23);
  }
  // else: no date filter — fetch all (initial sync, seed-data fake timestamps, or range > 120 days)

  let startIndex   = 0;
  let totalResults = null;
  let inserted = 0, updated = 0;

  do {
    const data = await nvdRequest({ ...baseParams, startIndex }, apiKey);

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
// ---------------------------------------------------------------------------
// Rebuild vuln_trends from current vulnerabilities table
// ---------------------------------------------------------------------------

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function rebuildTrends() {
  const { rows } = await pool.query(
    `SELECT
       EXTRACT(YEAR  FROM published)::int AS year,
       EXTRACT(MONTH FROM published)::int AS month_num,
       severity,
       COUNT(*)::int AS cnt
     FROM vulnerabilities
     WHERE published IS NOT NULL
     GROUP BY 1, 2, 3`
  );

  const map = {};
  for (const r of rows) {
    const key = `${r.year}-${r.month_num}`;
    if (!map[key]) map[key] = { year: r.year, month_num: r.month_num, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    map[key][r.severity] = (map[key][r.severity] || 0) + r.cnt;
  }

  // Truncate first so months with no remaining vulns don't persist stale counts
  await pool.query('TRUNCATE TABLE vuln_trends');

  for (const v of Object.values(map)) {
    await pool.query(
      `INSERT INTO vuln_trends (month, year, critical_count, high_count, medium_count, low_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [MONTH_LABELS[v.month_num - 1], v.year, v.CRITICAL || 0, v.HIGH || 0, v.MEDIUM || 0, v.LOW || 0]
    );
  }

  return Object.keys(map).length; // number of months rebuilt
}

// ---------------------------------------------------------------------------
// PAN Security Advisory RSS sync
// RSS feed: https://security.paloaltonetworks.com/rss.xml
// Title format: "CVE-XXXX-XXXX Product: Description (Severity: HIGH)"
// ---------------------------------------------------------------------------

const SEVERITY_CVSS_DEFAULT = { CRITICAL: 9.0, HIGH: 7.5, MEDIUM: 5.0, LOW: 2.0 };

// Extracts the affected product from a PAN RSS title description.
// Titles follow the pattern "Product: description" or just "description".
function parsePanProduct(desc) {
  const colonIdx = desc.indexOf(':');
  if (colonIdx <= 0) return { display: 'PAN-OS', id: 'pan-os' };
  const raw   = desc.slice(0, colonIdx).trim();
  const lower = raw.toLowerCase();
  if (lower === 'pan-os' || lower.startsWith('pan-os'))         return { display: 'PAN-OS',       id: 'pan-os' };
  if (lower.startsWith('globalprotect'))                        return { display: 'GlobalProtect', id: 'globalprotect' };
  if (lower === 'panorama')                                     return { display: 'Panorama',      id: 'panorama' };
  if (lower === 'expedition')                                   return { display: 'Expedition',    id: 'expedition' };
  if (lower.startsWith('cloud ngfw') || lower === 'cloud-ngfw') return { display: 'Cloud NGFW',   id: 'pan-os' };
  if (lower.startsWith('prisma access'))                        return { display: 'Prisma Access', id: 'prisma-access' };
  if (lower.startsWith('prisma'))                               return { display: raw,             id: lower.replace(/ /g, '-') };
  if (lower.startsWith('cortex'))                               return { display: raw,             id: lower.replace(/ /g, '-') };
  return { display: raw.charAt(0).toUpperCase() + raw.slice(1), id: lower.replace(/ /g, '-') };
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { timeout: 30000 }, res => {
      if (res.statusCode !== 200) return reject(new Error(`RSS fetch failed: HTTP ${res.statusCode}`));
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('RSS request timed out')); });
    req.end();
  });
}

function parsePanRssItems(xml) {
  const items = [];
  const blockRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = blockRe.exec(xml)) !== null) {
    const block = m[1];
    const get = tag => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
      return r ? r[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    };
    const title   = get('title');
    const link    = get('link');
    const pubDate = get('pubDate');

    // Only process CVE-format entries; skip PAN-SA-XXXX informational bulletins
    const cveM = title.match(/^(CVE-\d{4}-\d+)\s+(.*?)\s+\(Severity:\s*(CRITICAL|HIGH|MEDIUM|LOW|INFORMATIONAL)\)/i);
    if (!cveM) continue;
    const [, cveId, desc, sev] = cveM;
    if (sev.toUpperCase() === 'INFORMATIONAL') continue;

    items.push({ cveId, title: desc.trim(), severity: sev.toUpperCase(), link, pubDate });
  }
  return items;
}

async function syncPanRss(sinceDate) {
  const xml      = await fetchText('https://security.paloaltonetworks.com/rss.xml');
  const items    = parsePanRssItems(xml);
  const cutoff   = getCutoffDate();
  const sinceMs  = (sinceDate && sinceDate !== '—') ? new Date(sinceDate).getTime() : 0;

  let inserted = 0, updated = 0;

  for (const item of items) {
    const published = item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : null;
    if (!published || published < cutoff) continue;

    const pan  = parsePanProduct(item.title);
    const cvss = SEVERITY_CVSS_DEFAULT[item.severity] ?? 5.0;

    const { rows } = await pool.query(
      'SELECT id FROM vulnerabilities WHERE id = $1', [item.cveId]
    );

    if (rows.length > 0) {
      // Existing CVE — unconditional idempotent UPDATE: fixes product/affected_products
      // that may have been overwritten by NVD vendor-fallback, upgrades severity if PAN
      // rates it higher, and ensures the PAN source label is present.
      await pool.query(
        `UPDATE vulnerabilities
         SET source            = CASE WHEN source NOT LIKE '%PAN Security Advisory%'
                                      THEN source || ' + PAN Security Advisory'
                                      ELSE source END,
             product           = CASE WHEN product IS NULL OR product = 'Palo Alto'
                                      THEN $2 ELSE product END,
             affected_products = CASE WHEN jsonb_array_length(affected_products) = 0
                                      THEN $3::jsonb ELSE affected_products END,
             cvss              = GREATEST(cvss, $4),
             severity          = CASE
               WHEN array_position(ARRAY['LOW','MEDIUM','HIGH','CRITICAL'], severity)
                    < array_position(ARRAY['LOW','MEDIUM','HIGH','CRITICAL'], $5)
               THEN $5 ELSE severity END,
             updated_at        = NOW()
         WHERE id = $1`,
        [item.cveId, pan.display, JSON.stringify([pan.id]), cvss, item.severity]
      );
      updated++;
    } else {
      // New CVE not yet in NVD — always attempt insert; ON CONFLICT DO NOTHING is
      // the idempotency guard. No date filter here: the RSS feed is small (~25 items)
      // and NVD may lag behind official PAN publications by hours or days, so a
      // date-based filter would silently drop valid new records.
      await pool.query(
        `INSERT INTO vulnerabilities
           (id, vendor, product, firmware_versions, affected_products, cvss, severity, published,
            title, title_en, description, description_en,
            source, recommendation, recommendation_en, refs, handle_status, updated_at)
         VALUES ($1,'Palo Alto',$2,'[]'::jsonb,$3::jsonb,
                 $4,$5,$6,$7,$8,$9,$10,
                 'PAN Security Advisory',$11,$12,$13::jsonb,'pending',NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          item.cveId, pan.display, JSON.stringify([pan.id]),
          cvss, item.severity, published,
          item.title, item.title,   // title / title_en
          item.title, item.title,   // description / description_en
          buildRecommendation(item.severity, 'Palo Alto', true),
          buildRecommendation(item.severity, 'Palo Alto', false),
          JSON.stringify([item.link].filter(Boolean)),
        ]
      );
      inserted++;
    }
  }

  return { inserted, updated, total: items.length };
}

// ---------------------------------------------------------------------------
// Public entry point called by settingsController
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CISA KEV (Known Exploited Vulnerabilities) sync
// ---------------------------------------------------------------------------

async function syncKev() {
  const text = await fetchText('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
  const { vulnerabilities: kevList = [] } = JSON.parse(text);

  await pool.query('UPDATE vulnerabilities SET is_kev = false, kev_due_date = null WHERE is_kev = true');

  if (!kevList.length) return { inserted: 0, updated: 0, removed: 0 };

  const ids      = kevList.map(v => v.cveID).filter(Boolean);
  const dueDates = kevList.filter(v => v.cveID).map(v => v.dueDate || null);

  const { rowCount } = await pool.query(
    `UPDATE vulnerabilities v
     SET is_kev = true, kev_due_date = u.due_date::date
     FROM unnest($1::varchar[], $2::text[]) AS u(cve_id, due_date)
     WHERE v.id = u.cve_id`,
    [ids, dueDates]
  );

  return { inserted: 0, updated: rowCount || 0, removed: 0 };
}

// Sources supported for automatic sync (NVD keyword-based + RSS-based + CISA KEV)
const SYNC_SOURCES = new Set(['nvd', 'fortinet', 'paloalto', 'cisa_kev']);

async function sync(sourceId, settings) {
  const src       = (settings.data_sources || []).find(s => s.id === sourceId);
  const sinceDate = src?.lastSync || null;

  if (sourceId === 'cisa_kev') {
    const result = await syncKev();
    return { ...result, removed: 0 };
  }

  // Palo Alto Networks: RSS sync against official security advisory feed
  if (sourceId === 'paloalto') {
    const result = await syncPanRss(sinceDate);
    await rebuildTrends();
    return { ...result, removed: 0 };
  }

  // NVD API sync (nvd and fortinet sources)
  const vendors = SOURCE_MAP[sourceId];
  if (!vendors) throw new Error(`Sync not configured for source "${sourceId}"`);

  const apiKey = src?.apiKey || null;
  let totalInserted = 0, totalUpdated = 0;

  for (const { keyword, vendor } of vendors) {
    const r = await syncVendor(keyword, vendor, apiKey, sinceDate);
    totalInserted += r.inserted;
    totalUpdated  += r.updated;
  }

  // Remove vulnerabilities published more than 5 years ago
  const cutoff = getCutoffDate();
  const { rowCount: removed } = await pool.query(
    'DELETE FROM vulnerabilities WHERE published < $1', [cutoff]
  );

  // Rebuild monthly trend aggregates
  await rebuildTrends();

  return { inserted: totalInserted, updated: totalUpdated, removed: removed || 0 };
}

module.exports = { sync, rebuildTrends, SOURCE_MAP, SYNC_SOURCES };
