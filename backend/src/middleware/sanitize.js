/**
 * Removes HTML tags from a string using a character-by-character state machine.
 * This avoids ReDoS vulnerabilities inherent in backtracking regex on tag patterns.
 */
function stripHtmlTags(str) {
  let result = '';
  let insideTag = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '<') {
      insideTag = true;
    } else if (ch === '>') {
      insideTag = false;
    } else if (!insideTag) {
      result += ch;
    }
  }

  return result;
}

/**
 * Recursively sanitizes an object or array by:
 *  - Stripping HTML tags from strings
 *  - Trimming leading/trailing whitespace
 *  - Removing null bytes (common in injection payloads)
 */
function sanitizeValue(value) {
  if (typeof value === 'string') {
    return stripHtmlTags(value)
      .replace(/\0/g, '')    // strip null bytes
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
