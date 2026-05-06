const pool = require('../db');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

function buildPrompts(vuln, lang) {
  const isZh = lang === 'zh';
  const affectedList = (
    vuln.affected_products?.length > 0 ? vuln.affected_products
    : vuln.product ? [vuln.product] : []
  ).join('\n- ');
  const firmwareList = (vuln.firmware_versions || []).join(', ');
  const title       = isZh ? vuln.title          : (vuln.title_en          || vuln.title);
  const description = isZh ? vuln.description    : (vuln.description_en    || vuln.description);
  const recommend   = isZh ? vuln.recommendation : (vuln.recommendation_en || vuln.recommendation);
  const severity    = vuln.cvss >= 9 ? (isZh ? '嚴重' : 'Critical') : vuln.cvss >= 7 ? (isZh ? '高' : 'High') : vuln.cvss >= 4 ? (isZh ? '中' : 'Medium') : (isZh ? '低' : 'Low');

  const system = isZh
    ? '你是專業的資安分析師，專注於網路設備與韌體弱點。回答以繁體中文撰寫，簡潔、專業、具體可執行。'
    : 'You are a professional security analyst specializing in network device and firmware vulnerabilities. Be concise, professional, and actionable.';

  const user = isZh
    ? `請針對以下弱點進行深入分析：

**弱點 ID：** ${vuln.id}
**標題：** ${title}
**CVSS 分數：** ${vuln.cvss}（${severity}）
**來源：** ${vuln.source || '未知'}
**廠商：** ${vuln.vendor || '未知'}
**受影響產品：**\n- ${affectedList || '未知'}
**受影響版本：** ${firmwareList || '未指定'}
**描述：** ${description || '無'}
**官方建議：** ${recommend || '無'}

請依照下列結構回答（每段不超過 200 字）：

## 威脅評估
說明攻擊向量、攻擊難度與可利用性。

## 影響分析
說明成功利用後對機密性、完整性、可用性的影響。

## 修復優先級
根據 CVSS 分數與實際環境建議緊急程度與時間框架。

## 修復步驟
列出 3–5 個具體可執行的修復動作。

## 暫行緩解措施
若無法立即修復，列出可降低風險的補償控制措施。`
    : `Analyze the following vulnerability:

**ID:** ${vuln.id}
**Title:** ${title}
**CVSS:** ${vuln.cvss} (${severity})
**Source:** ${vuln.source || 'Unknown'}
**Vendor:** ${vuln.vendor || 'Unknown'}
**Affected Products:**\n- ${affectedList || 'Unknown'}
**Affected Versions:** ${firmwareList || 'Not specified'}
**Description:** ${description || 'None'}
**Recommendation:** ${recommend || 'None'}

Provide a structured analysis (max 200 words per section):

## Threat Assessment
Explain the attack vector, complexity, and exploitability.

## Impact Analysis
Describe consequences of successful exploitation (CIA triad).

## Remediation Priority
Recommend urgency and timeframe based on CVSS and context.

## Remediation Steps
List 3–5 concrete, actionable steps.

## Interim Mitigations
If immediate remediation is not possible, list compensating controls.`;

  return { system, user };
}

async function callClaude(apiKey, model, system, user) {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model,
    max_tokens: 1500,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return msg.content[0]?.text || '';
}

async function callOpenAI(apiKey, model, system, user) {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    max_tokens: 1500,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
  });
  return completion.choices[0]?.message?.content || '';
}

async function callGemini(apiKey, model, system, user) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const gemModel = genAI.getGenerativeModel({ model, systemInstruction: system });
  const result = await gemModel.generateContent(user);
  return result.response.text();
}

// Ollama / vLLM / any OpenAI-compatible local endpoint
async function callLocal(baseURL, apiKey, model, system, user) {
  if (!baseURL) throw Object.assign(new Error('ai_base_url not configured'), { code: 'missing_base_url' });
  const client = new OpenAI({
    baseURL,
    apiKey: apiKey || 'local',   // Ollama ignores the key; vLLM may require one
  });
  const completion = await client.chat.completions.create({
    model,
    max_tokens: 1500,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
  });
  return completion.choices[0]?.message?.content || '';
}

const PROVIDER_LABEL = {
  claude:  'Claude (Anthropic)',
  gemini:  'Gemini (Google)',
  chatgpt: 'ChatGPT (OpenAI)',
  local:   '本地模型',
};
const DEFAULT_MODEL = {
  claude:  'claude-sonnet-4-6',
  gemini:  'gemini-2.5-flash',
  chatgpt: 'gpt-4.1',
  local:   'llama3.2',
};

async function analyzeVuln(req, res, next) {
  try {
    const { vuln, lang = 'zh' } = req.body;
    if (!vuln?.id) return res.status(400).json({ error: 'Missing vuln data' });

    const { rows } = await pool.query(
      'SELECT ai_api_key, ai_model, ai_provider, ai_base_url FROM settings WHERE id = 1'
    );
    const s = rows[0];
    const provider = s?.ai_provider || 'claude';
    const isLocal = provider === 'local';

    // Local provider doesn't need an API key (Ollama); cloud providers do
    if (!isLocal && !s?.ai_api_key) {
      return res.status(400).json({
        error: lang === 'zh'
          ? '尚未設定 AI API 金鑰，請至「設定」頁面完成設定'
          : 'AI API key not configured. Please configure it in Settings.',
      });
    }
    if (isLocal && !s?.ai_base_url) {
      return res.status(400).json({
        error: lang === 'zh'
          ? '尚未設定本地模型端點 URL，請至「設定」頁面填寫 API Base URL'
          : 'Local model base URL not configured. Please set the API Base URL in Settings.',
      });
    }

    const model = s.ai_model || DEFAULT_MODEL[provider] || 'llama3.2';
    const { system, user } = buildPrompts(vuln, lang);

    let analysis;
    if (provider === 'claude') {
      analysis = await callClaude(s.ai_api_key, model, system, user);
    } else if (provider === 'gemini') {
      analysis = await callGemini(s.ai_api_key, model, system, user);
    } else if (provider === 'local') {
      analysis = await callLocal(s.ai_base_url, s.ai_api_key, model, system, user);
    } else {
      analysis = await callOpenAI(s.ai_api_key, model, system, user);
    }

    const baseLabel = PROVIDER_LABEL[provider] || provider;
    const providerLabel = isLocal && s.ai_base_url
      ? `${baseLabel} (${s.ai_base_url})`
      : baseLabel;

    res.json({ analysis, provider, providerLabel, model });
  } catch (err) {
    if (err.code === 'missing_base_url') {
      return res.status(400).json({ error: err.message });
    }
    // Normalise auth errors across providers
    const isAuthError = err.status === 401 || err.status === 403
      || err.code === 'invalid_api_key'
      || err.message?.includes('API key') || err.message?.includes('API_KEY');
    if (isAuthError) {
      return res.status(400).json({
        error: req.body.lang === 'zh'
          ? 'AI API 金鑰無效，請至設定頁面重新確認'
          : 'Invalid AI API key. Please verify it in Settings.',
      });
    }
    // Connection errors for local models
    const isConnError = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.cause?.code === 'ECONNREFUSED';
    if (isConnError) {
      return res.status(400).json({
        error: req.body.lang === 'zh'
          ? `無法連線至本地模型端點，請確認服務是否正在執行（${err.message}）`
          : `Cannot connect to local model endpoint. Please verify the service is running. (${err.message})`,
      });
    }
    next(err);
  }
}

module.exports = { analyzeVuln };
