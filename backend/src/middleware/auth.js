const { supabase } = require('../config/supabase');

/**
 * Verifies the Supabase JWT from the Authorization header and attaches
 * req.user (auth identity + profile row from the users table).
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.slice(7);

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const authUser = data.user;

    // Fetch the application profile (role, display_name, is_active, etc.)
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, display_name, avatar_url, is_active, created_at, updated_at')
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'User profile not found' });
    }

    if (!profile.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    req.user = {
      ...authUser,
      role: profile.role,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      is_active: profile.is_active,
      token,
    };

    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication service error' });
  }
}

/**
 * Requires the authenticated user to have role === 'admin'.
 * Must be used after the authenticate middleware.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}

module.exports = { authenticate, requireAdmin };
