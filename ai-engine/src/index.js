require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const winston = require('winston');

const { chat } = require('./llm/client');
const { buildAnalyzePrompt } = require('./prompts/analyze');
const { buildSummarizePrompt } = require('./prompts/summarize');
const { buildRecommendPrompt } = require('./prompts/recommend');

// ── Logger ────────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) =>
      stack
        ? `${timestamp} [${level.toUpperCase()}] ${message}\n${stack}`
        : `${timestamp} [${level.toUpperCase()}] ${message}`
    )
  ),
  transports: [new winston.transports.Console()],
});

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireInternalKey(req, res, next) {
  const expectedKey = process.env.BACKEND_API_KEY;
  if (!expectedKey) {
    logger.warn('BACKEND_API_KEY is not configured — skipping auth check');
    return next();
  }

  const headerKey = req.headers['x-internal-key'];
  const bearerKey = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  const providedKey = headerKey || bearerKey;

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing internal API key' });
  }
  next();
}

// ── Helper ────────────────────────────────────────────────────────────────────
function tryParseJSON(text) {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return text;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — public, no auth required
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CyberCord AI Engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// POST /analyze
app.post('/analyze', requireInternalKey, async (req, res, next) => {
  const { findings, context } = req.body;

  if (!findings || !Array.isArray(findings) || findings.length === 0) {
    return res.status(400).json({ error: '`findings` must be a non-empty array' });
  }

  try {
    logger.info(`/analyze called with ${findings.length} finding(s)`);
    const messages = buildAnalyzePrompt(findings, context || '');
    const response = await chat(messages);
    const parsed = tryParseJSON(response);

    return res.json({
      analysis: parsed,
      model: process.env.OPENAI_MODEL,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /summarize
app.post('/summarize', requireInternalKey, async (req, res, next) => {
  const { investigation, findings } = req.body;

  if (!investigation || typeof investigation !== 'object') {
    return res.status(400).json({ error: '`investigation` must be an object' });
  }
  if (!findings || !Array.isArray(findings) || findings.length === 0) {
    return res.status(400).json({ error: '`findings` must be a non-empty array' });
  }

  try {
    logger.info(`/summarize called for investigation "${investigation.id || 'unknown'}"`);
    const messages = buildSummarizePrompt(investigation, findings);
    const response = await chat(messages);

    return res.json({
      summary: response,
      model: process.env.OPENAI_MODEL,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /recommend
app.post('/recommend', requireInternalKey, async (req, res, next) => {
  const { investigation, findings, current_focus } = req.body;

  if (!investigation || typeof investigation !== 'object') {
    return res.status(400).json({ error: '`investigation` must be an object' });
  }
  if (!findings || !Array.isArray(findings) || findings.length === 0) {
    return res.status(400).json({ error: '`findings` must be a non-empty array' });
  }

  try {
    logger.info(`/recommend called for investigation "${investigation.id || 'unknown'}"`);
    const messages = buildRecommendPrompt(investigation, findings, current_focus || '');
    const response = await chat(messages);
    const parsed = tryParseJSON(response);

    return res.json({
      recommendations: parsed,
      model: process.env.OPENAI_MODEL,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error(err.message, err);

  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  if (code === 'RATE_LIMIT') {
    return res.status(429).json({ error: err.message, code });
  }
  if (code === 'TIMEOUT') {
    return res.status(504).json({ error: err.message, code });
  }
  if (code === 'AUTH_ERROR') {
    return res.status(502).json({ error: err.message, code });
  }
  if (code === 'SERVICE_UNAVAILABLE') {
    return res.status(503).json({ error: err.message, code });
  }

  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 5001;
app.listen(PORT, () => {
  logger.info(`CyberCord AI Engine listening on port ${PORT}`);
  logger.info(`Model: ${process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'}`);
});

module.exports = app;
