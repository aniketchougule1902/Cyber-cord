const crypto = require('crypto');
const { supabaseAdmin, supabase } = require('../config/supabase');

const KEY_PREFIX = 'cc_';

/**
 * Generates a new random API key with the "cc_" prefix.
 * The plaintext key is returned once and never stored.
 */
function generateApiKey() {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `${KEY_PREFIX}${randomBytes}`;
}

/**
 * Returns the SHA-256 hex digest of the given key.
 */
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Timing-safe comparison of a plaintext key against a stored hash.
 */
function verifyApiKey(key, storedHash) {
  const candidateHash = hashApiKey(key);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Creates a new API key record in the database.
 * Returns the plaintext key (caller must deliver it to the user) and the DB row.
 *
 * @param {string} userId       - UUID of the owning user
 * @param {string} name         - Human-readable label
 * @param {string[]} permissions - Array of permission strings
 * @param {number} [rateLimit=100] - Per-key rate limit
 */
async function createApiKeyInDb(userId, name, permissions = [], rateLimit = 100) {
  const db = supabaseAdmin || supabase;

  const plaintext = generateApiKey();
  const keyHash = hashApiKey(plaintext);

  const { data, error } = await db
    .from('api_keys')
    .insert({
      user_id: userId,
      key_hash: keyHash,
      name,
      permissions,
      rate_limit: rateLimit,
      is_active: true,
    })
    .select('id, user_id, name, permissions, rate_limit, is_active, created_at')
    .single();

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`);
  }

  return { plaintext, record: data };
}

/**
 * Soft-revokes an API key by setting is_active = false.
 *
 * @param {string} keyId - UUID of the api_keys row
 */
async function revokeApiKey(keyId) {
  const db = supabaseAdmin || supabase;

  const { data, error } = await db
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .select('id, is_active')
    .single();

  if (error) {
    throw new Error(`Failed to revoke API key: ${error.message}`);
  }

  return data;
}

/**
 * Looks up an API key record by its plaintext value.
 * Updates last_used_at on a match.
 *
 * @param {string} plaintext
 * @returns {object|null} The api_keys row or null if not found / inactive
 */
async function lookupApiKey(plaintext) {
  const db = supabaseAdmin || supabase;
  const keyHash = hashApiKey(plaintext);

  const { data, error } = await db
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  // Fire-and-forget last_used_at update
  db.from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {});

  return data;
}

module.exports = {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  createApiKeyInDb,
  revokeApiKey,
  lookupApiKey,
};
