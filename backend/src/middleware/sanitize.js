/**
 * Recursively sanitizes an object or array by:
 *  - Stripping HTML tags from strings
 *  - Trimming leading/trailing whitespace
 *  - Removing null bytes (common in injection payloads)
 */
function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\0/g, '')                            // strip null bytes
      .replace(/<[^>]*>/g, '')                       // strip HTML tags
      .replace(/javascript\s*:/gi, '')               // strip javascript: URIs
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')  // strip inline event handlers
      .trim();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value);
  }

  return value;
}

function sanitizeObject(obj) {
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    sanitized[key] = sanitizeValue(obj[key]);
  }
  return sanitized;
}

/**
 * Express middleware that sanitizes req.body in-place.
 */
function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

module.exports = sanitize;
