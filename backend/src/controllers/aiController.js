const pool = require('../db');
const Anthropic = require('@anthropic-ai/sdk');

async function analyzeVuln(req, res, next) {
  try {
    const { vuln, lang = 'zh' } = req.body;
    if (!vuln?.id) return res.status(400).json({ error: 'Missing vuln data' });

    const { rows } = await pool.query('SELECT ai_api_key, ai_model FROM settings WHERE id = 1');
    const settings = rows[0];
    if (!settings?.ai_api_key) {
      return res.status(400).json({
        error: lang === 'zh' ? '尚未設定 AI API 金鑰，請至「設定」頁面完成設定' : 'AI API key not configured. Please configure it in Settings.',
      });
    }

    const client = new Anthropic({ apiKey: settings.ai_api_key });
    const model = settings.ai_model || 'claude-sonnet-4-6';

    const isZh = lang === 'zh';
    const affectedList = (vuln.affected_products?.length > 0
      ? vuln.affected_products
      : vuln.product ? [vuln.product] : []
    ).join('\n- ');
    const firmwareList = (vuln.firmware_versions || []).join(', ');
    const title = isZh ? vuln.title : (vuln.title_en || vuln.title);
    const description = isZh ? vuln.description : (vuln.description_en || vuln.description);
    const recommendation = isZh ? vuln.recommendation : (vuln.recommendation_en || vuln.recommendation);

    const prompt = isZh
      ? `你是一位資安分析師，請針對以下弱點進行深入分析，以繁體中文回答。

**弱點 ID：** ${vuln.id}
**標題：** ${title}
**CVSS 分數：** ${vuln.cvss}（${vuln.cvss >= 9 ? '嚴重' : vuln.cvss >= 7 ? '高' : vuln.cvss >= 4 ? '中' : '低'}）
**來源：** ${vuln.source || '未知'}
**廠商：** ${vuln.vendor || '未知'}
**受影響產品：**
- ${affectedList || '未知'}
**受影響版本：** ${firmwareList || '未指定'}
**描述：** ${description || '無'}
**官方建議：** ${recommendation || '無'}

請依照以下結構提供分析，每個段落不超過 200 字：

## 威脅評估
說明此漏洞的攻擊向量、攻擊難度與可利用性。

## 影響分析
說明成功利用後的潛在後果（機密性、完整性、可用性）。

## 修復優先級
根據 CVSS 分數與實際環境，建議修復的緊急程度與時間框架。

## 修復步驟
列出 3-5 個具體可執行的修復動作。

## 暫行緩解措施
若無法立即修復，列出可降低風險的補償控制措施。`
      : `You are a security analyst. Analyze the following vulnerability and respond in English.

**Vulnerability ID:** ${vuln.id}
**Title:** ${title}
**CVSS Score:** ${vuln.cvss} (${vuln.cvss >= 9 ? 'Critical' : vuln.cvss >= 7 ? 'High' : vuln.cvss >= 4 ? 'Medium' : 'Low'})
**Source:** ${vuln.source || 'Unknown'}
**Vendor:** ${vuln.vendor || 'Unknown'}
**Affected Products:**
- ${affectedList || 'Unknown'}
**Affected Versions:** ${firmwareList || 'Not specified'}
**Description:** ${description || 'None'}
**Official Recommendation:** ${recommendation || 'None'}

Provide a structured analysis with the following sections (max 200 words each):

## Threat Assessment
Explain the attack vector, complexity, and exploitability.

## Impact Analysis
Describe potential consequences of successful exploitation (confidentiality, integrity, availability).

## Remediation Priority
Recommend urgency and timeframe based on CVSS score and practical context.

## Remediation Steps
List 3-5 concrete, actionable steps to fix the vulnerability.

## Interim Mitigations
If immediate remediation is not possible, list compensating controls to reduce risk.`;

    const message = await client.messages.create({
      model,
      max_tokens: 1500,
      system: isZh
        ? '你是專業的資安分析師，專注於網路設備與韌體弱點。回答簡潔、專業、具體可執行。'
        : 'You are a professional security analyst specializing in network device and firmware vulnerabilities. Be concise, professional, and actionable.',
      messages: [{ role: 'user', content: prompt }],
    });

    const analysis = message.content[0]?.text || '';
    res.json({ analysis });
  } catch (err) {
    if (err.status === 401) {
      return res.status(400).json({ error: req.body.lang === 'zh' ? 'AI API 金鑰無效，請至設定頁面重新設定' : 'Invalid AI API key. Please update it in Settings.' });
    }
    next(err);
  }
}

module.exports = { analyzeVuln };
