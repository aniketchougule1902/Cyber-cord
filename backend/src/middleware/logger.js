const winston = require('winston');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logLevel = process.env.LOG_LEVEL || 'info';

// Base Winston logger used throughout the application
const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    printf(({ level, message, timestamp: ts, stack }) => {
      return stack
        ? `${ts} [${level.toUpperCase()}] ${message}\n${stack}`
        : `${ts} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        printf(({ level, message, timestamp: ts, stack }) => {
          return stack
            ? `${ts} [${level}] ${message}\n${stack}`
            : `${ts} [${level}] ${message}`;
        })
      ),
    }),
  ],
});

/**
 * Express middleware that logs HTTP requests: method, URL, status,
 * response time, and remote IP address.
 */
function requestLogger(req, res, next) {
  const startAt = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const responseTimeMs = Date.now() - startAt;
    const { statusCode } = res;

    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger[level](
      `${method} ${originalUrl} ${statusCode} ${responseTimeMs}ms — ${ip}`
    );
  });

  next();
}

module.exports = { logger, requestLogger };
