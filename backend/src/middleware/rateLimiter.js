const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter: 100 requests per 15 minutes.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later.',
  },
  keyGenerator: (req) => req.ip,
});

/**
 * Tool execution rate limiter: 10 tool runs per hour.
 * Tighter limit to prevent abuse of expensive OSINT calls.
 */
const toolLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.TOOL_RATE_LIMIT_MAX, 10) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Tool execution rate limit exceeded. Please wait before running more tools.',
  },
  keyGenerator: (req) => (req.user ? req.user.id : req.ip),
});

module.exports = { generalLimiter, toolLimiter };
