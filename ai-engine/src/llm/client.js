const axios = require('axios');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
const DEFAULT_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MAX_TOKENS = parseInt(process.env.MAX_TOKENS, 10) || 4096;
const DEFAULT_TEMPERATURE = parseFloat(process.env.TEMPERATURE) || 0.3;

function toGeminiPayload(messages, options = {}) {
  const systemMessages = [];
  const contents = [];

  for (const msg of messages || []) {
    const text = typeof msg?.content === 'string' ? msg.content : '';
    if (!text) continue;

    if (msg.role === 'system') {
      systemMessages.push(text);
      continue;
    }

    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }],
    });
  }

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Continue.' }] });
  }

  return {
    ...(systemMessages.length
      ? { systemInstruction: { parts: [{ text: systemMessages.join('\n\n') }] } }
      : {}),
    contents,
    generationConfig: {
      maxOutputTokens: options.max_tokens || DEFAULT_MAX_TOKENS,
      temperature: options.temperature !== undefined ? options.temperature : DEFAULT_TEMPERATURE,
    },
  };
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
}

async function requestGemini(messages, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('Missing Gemini API key.'), { code: 'AUTH_ERROR', status: 401 });
  }

  const model = options.model || DEFAULT_MODEL;
  const url = `${DEFAULT_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`;
  const payload = toGeminiPayload(messages, options);

  return axios.post(url, payload, {
    timeout: 60000,
    params: { key: apiKey },
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true,
  });
}

async function chat(messages, options = {}) {
  try {
    const response = await requestGemini(messages, options);
    if (response.status === 429) {
      throw Object.assign(new Error('Gemini rate limit exceeded. Please try again later.'), { code: 'RATE_LIMIT' });
    }
    if (response.status === 401 || response.status === 403) {
      throw Object.assign(new Error('Invalid Gemini API key.'), { code: 'AUTH_ERROR' });
    }
    if (response.status === 503 || response.status === 502) {
      throw Object.assign(new Error('Gemini service temporarily unavailable.'), { code: 'SERVICE_UNAVAILABLE' });
    }
    if (response.status >= 400) {
      const message = response.data?.error?.message || 'Gemini request failed.';
      throw Object.assign(new Error(message), { code: 'UPSTREAM_ERROR', status: response.status });
    }

    const text = extractGeminiText(response.data);
    if (!text) {
      throw Object.assign(new Error('Gemini returned an empty response.'), { code: 'UPSTREAM_ERROR', status: 502 });
    }
    return text;
  } catch (err) {
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
      throw Object.assign(new Error('Gemini request timed out.'), { code: 'TIMEOUT' });
    }
    if (err.response?.status === 429) {
      throw Object.assign(new Error('Gemini rate limit exceeded. Please try again later.'), { code: 'RATE_LIMIT' });
    }
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw Object.assign(new Error('Invalid Gemini API key.'), { code: 'AUTH_ERROR' });
    }
    if (err.response?.status === 503 || err.response?.status === 502) {
      throw Object.assign(new Error('Gemini service temporarily unavailable.'), { code: 'SERVICE_UNAVAILABLE' });
    }
    throw err;
  }
}

async function* streamChat(messages, options = {}) {
  const text = await chat(messages, options);
  yield text;
}

module.exports = { chat, streamChat };
