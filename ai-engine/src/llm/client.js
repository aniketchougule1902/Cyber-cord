const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  timeout: 60000,
  maxRetries: 2,
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
const DEFAULT_MAX_TOKENS = parseInt(process.env.MAX_TOKENS, 10) || 4096;
const DEFAULT_TEMPERATURE = parseFloat(process.env.TEMPERATURE) || 0.3;

async function chat(messages, options = {}) {
  try {
    const response = await openai.chat.completions.create({
      model: options.model || DEFAULT_MODEL,
      messages,
      max_tokens: options.max_tokens || DEFAULT_MAX_TOKENS,
      temperature: options.temperature !== undefined ? options.temperature : DEFAULT_TEMPERATURE,
      ...options,
    });
    return response.choices[0].message.content;
  } catch (err) {
    if (err.status === 429) {
      throw Object.assign(new Error('OpenAI rate limit exceeded. Please try again later.'), { code: 'RATE_LIMIT' });
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.type === 'request-timeout') {
      throw Object.assign(new Error('OpenAI request timed out.'), { code: 'TIMEOUT' });
    }
    if (err.status === 401) {
      throw Object.assign(new Error('Invalid OpenAI API key.'), { code: 'AUTH_ERROR' });
    }
    if (err.status === 503 || err.status === 502) {
      throw Object.assign(new Error('OpenAI service temporarily unavailable.'), { code: 'SERVICE_UNAVAILABLE' });
    }
    throw err;
  }
}

async function* streamChat(messages, options = {}) {
  try {
    const stream = await openai.chat.completions.create({
      model: options.model || DEFAULT_MODEL,
      messages,
      max_tokens: options.max_tokens || DEFAULT_MAX_TOKENS,
      temperature: options.temperature !== undefined ? options.temperature : DEFAULT_TEMPERATURE,
      stream: true,
      ...options,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  } catch (err) {
    if (err.status === 429) {
      throw Object.assign(new Error('OpenAI rate limit exceeded. Please try again later.'), { code: 'RATE_LIMIT' });
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.type === 'request-timeout') {
      throw Object.assign(new Error('OpenAI request timed out.'), { code: 'TIMEOUT' });
    }
    if (err.status === 401) {
      throw Object.assign(new Error('Invalid OpenAI API key.'), { code: 'AUTH_ERROR' });
    }
    if (err.status === 503 || err.status === 502) {
      throw Object.assign(new Error('OpenAI service temporarily unavailable.'), { code: 'SERVICE_UNAVAILABLE' });
    }
    throw err;
  }
}

module.exports = { chat, streamChat };
