const express = require('express');
const { query, param, body, validationResult } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { supabaseAdmin, supabase } = require('../config/supabase');

const router = express.Router();

// All admin routes require authentication AND admin role
router.use(authenticate, requireAdmin);

const db = () => supabaseAdmin || supabase;

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

// ============================================================
// GET /logs — paginated audit_logs with optional filters
// ============================================================

router.get(
  '/logs',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('user_id').optional().isUUID(),
    query('action').optional().isString(),
    query('date_from').optional().isISO8601(),
    query('date_to').optional().isISO8601(),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const page = req.query.page || 1;
    const limit = req.query.limit || 50;
    const offset = (page - 1) * limit;
    const { user_id, action, date_from, date_to } = req.query;

    let q = db()
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (user_id) q = q.eq('user_id', user_id);
    if (action) q = q.ilike('action', `%${action}%`);
    if (date_from) q = q.gte('created_at', date_from);
    if (date_to) q = q.lte('created_at', date_to);

    const { data, error, count } = await q;

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      logs: data,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  }
);

// ============================================================
// GET /usage-stats — aggregate tool usage counts and success rates
// ============================================================

router.get('/usage-stats', async (_req, res) => {
  const { data, error } = await db()
    .from('tool_usage_logs')
    .select('tool_name, status');

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate in-process to avoid raw SQL dependency
  const stats = {};
  for (const row of data) {
    if (!stats[row.tool_name]) {
      stats[row.tool_name] = { tool_name: row.tool_name, total: 0, success: 0, error: 0, pending: 0 };
    }
    stats[row.tool_name].total += 1;
    if (row.status === 'success') stats[row.tool_name].success += 1;
    else if (row.status === 'error') stats[row.tool_name].error += 1;
    else stats[row.tool_name].pending += 1;
  }

  const result = Object.values(stats).map((s) => ({
    ...s,
    success_rate: s.total > 0 ? ((s.success / s.total) * 100).toFixed(1) : '0.0',
  }));

  result.sort((a, b) => b.total - a.total);

  return res.json({ stats: result, total_executions: data.length });
});

// ============================================================
// GET /users — list all users with pagination and optional search
// ============================================================

router.get(
  '/users',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString(),
    query('role').optional().isIn(['admin', 'user']),
    query('is_active').optional().isBoolean().toBoolean(),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const offset = (page - 1) * limit;
    const { search, role, is_active } = req.query;

    let q = db()
      .from('users')
      .select('id, email, role, display_name, avatar_url, is_active, created_at, updated_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      q = q.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    }
    if (role) q = q.eq('role', role);
    if (is_active !== undefined) q = q.eq('is_active', is_active);

    const { data, error, count } = await q;

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      users: data,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  }
);

// ============================================================
// PATCH /users/:id — update user role or is_active
// ============================================================

router.patch(
  '/users/:id',
  [
    param('id').isUUID(),
    body('role').optional().isIn(['admin', 'user']),
    body('is_active').optional().isBoolean(),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const allowedFields = ['role', 'is_active'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    const { data, error } = await db()
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, email, role, display_name, is_active, updated_at')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found' });

    return res.json({ user: data });
  }
);

module.exports = router;
