require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const { generalLimiter } = require('./middleware/rateLimiter');
const sanitize = require('./middleware/sanitize');
const { logger, requestLogger } = require('./middleware/logger');

const toolsRouter = require('./routes/tools');
const investigationsRouter = require('./routes/investigations');
const aiRouter = require('./routes/ai');
const adminRouter = require('./routes/admin');

// ============================================================
// Express app setup
// ============================================================

const app = express();

// Security headers
app.use(helmet());

// CORS — supports a comma-separated CORS_ORIGIN list, e.g.:
//   CORS_ORIGIN=https://my-app.vercel.app,https://my-custom-domain.com
const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const corsAllowedOrigins = rawCorsOrigin.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl)
      if (!origin || corsAllowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Gzip compression
app.use(compression());

// HTTP request logging via Morgan (concise format) + Winston
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));
app.use(requestLogger);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiter
app.use(generalLimiter);

// Input sanitisation
app.use(sanitize);

// ============================================================
// Health check
// ============================================================

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// API Routes
// ============================================================

app.use('/api/tools', toolsRouter);
app.use('/api/investigations', investigationsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/admin', adminRouter);

// ============================================================
// 404 handler
// ============================================================

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============================================================
// Global error handler
// ============================================================

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error(err);

  const statusCode = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  res.status(statusCode).json({ error: message });
});

// ============================================================
// Start server
// ============================================================

const PORT = parseInt(process.env.PORT, 10) || 4000;

app.listen(PORT, () => {
  logger.info(`CyberCord API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
