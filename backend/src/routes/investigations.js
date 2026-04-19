const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { supabase } = require('../config/supabase');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================================
// Helpers
// ============================================================

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

/**
 * Fetches an investigation and verifies ownership (or admin access).
 * Returns { investigation } on success or sends an error response.
 */
async function getOwnedInvestigation(req, res, investigationId) {
  const { data, error } = await supabase
    .from('investigations')
    .select('*')
    .eq('id', investigationId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Investigation not found' });
    return null;
  }

  if (data.user_id !== req.user.id && req.user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return data;
}

// ============================================================
// GET / — list investigations for current user with pagination
// ============================================================

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['active', 'archived', 'completed']),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const offset = (page - 1) * limit;
    const { status } = req.query;

    let queryBuilder = supabase
      .from('investigations')
      .select('*, findings_count:investigation_findings(count)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data, error, count } = await queryBuilder;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      investigations: data,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  }
);

// ============================================================
// POST / — create investigation
// ============================================================

router.post(
  '/',
  [
    body('title').isString().notEmpty().isLength({ max: 255 }),
    body('description').optional().isString().isLength({ max: 5000 }),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString(),
    body('status').optional().isIn(['active', 'archived', 'completed']),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const { title, description, tags = [], status = 'active' } = req.body;

    const { data, error } = await supabase
      .from('investigations')
      .insert({
        user_id: req.user.id,
        title,
        description,
        tags,
        status,
      })
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ investigation: data });
  }
);

// ============================================================
// GET /:id — get single investigation with findings count
// ============================================================

router.get(
  '/:id',
  [param('id').isUUID()],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const investigation = await getOwnedInvestigation(req, res, req.params.id);
    if (!investigation) return;

    const { count: findingsCount } = await supabase
      .from('investigation_findings')
      .select('id', { count: 'exact', head: true })
      .eq('investigation_id', req.params.id);

    return res.json({ investigation: { ...investigation, findings_count: findingsCount } });
  }
);

// ============================================================
// PUT /:id — update investigation
// ============================================================

router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('title').optional().isString().notEmpty().isLength({ max: 255 }),
    body('description').optional().isString().isLength({ max: 5000 }),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString(),
    body('status').optional().isIn(['active', 'archived', 'completed']),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const existing = await getOwnedInvestigation(req, res, req.params.id);
    if (!existing) return;

    const allowedFields = ['title', 'description', 'tags', 'status'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    const { data, error } = await supabase
      .from('investigations')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ investigation: data });
  }
);

// ============================================================
// DELETE /:id — delete investigation (cascades to findings)
// ============================================================

router.delete(
  '/:id',
  [param('id').isUUID()],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const existing = await getOwnedInvestigation(req, res, req.params.id);
    if (!existing) return;

    const { error } = await supabase
      .from('investigations')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(204).send();
  }
);

// ============================================================
// POST /:id/findings — add a finding to an investigation
// ============================================================

router.post(
  '/:id/findings',
  [
    param('id').isUUID(),
    body('tool_name').isString().notEmpty(),
    body('input_data').optional().isObject(),
    body('result_data').optional().isObject(),
    body('risk_level').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('notes').optional().isString().isLength({ max: 10000 }),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const existing = await getOwnedInvestigation(req, res, req.params.id);
    if (!existing) return;

    const { tool_name, input_data, result_data, risk_level = 'low', notes } = req.body;

    const { data, error } = await supabase
      .from('investigation_findings')
      .insert({
        investigation_id: req.params.id,
        tool_name,
        input_data,
        result_data,
        risk_level,
        notes,
      })
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ finding: data });
  }
);

// ============================================================
// GET /:id/findings — get all findings for an investigation
// ============================================================

router.get(
  '/:id/findings',
  [
    param('id').isUUID(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('risk_level').optional().isIn(['low', 'medium', 'high', 'critical']),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const existing = await getOwnedInvestigation(req, res, req.params.id);
    if (!existing) return;

    const page = req.query.page || 1;
    const limit = req.query.limit || 50;
    const offset = (page - 1) * limit;

    let queryBuilder = supabase
      .from('investigation_findings')
      .select('*', { count: 'exact' })
      .eq('investigation_id', req.params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.query.risk_level) {
      queryBuilder = queryBuilder.eq('risk_level', req.query.risk_level);
    }

    const { data, error, count } = await queryBuilder;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      findings: data,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  }
);

// ============================================================
// DELETE /:id/findings/:findingId — delete a specific finding
// ============================================================

router.delete(
  '/:id/findings/:findingId',
  [param('id').isUUID(), param('findingId').isUUID()],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const existing = await getOwnedInvestigation(req, res, req.params.id);
    if (!existing) return;

    const { data: finding, error: findingError } = await supabase
      .from('investigation_findings')
      .select('id, investigation_id')
      .eq('id', req.params.findingId)
      .eq('investigation_id', req.params.id)
      .single();

    if (findingError || !finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    const { error } = await supabase
      .from('investigation_findings')
      .delete()
      .eq('id', req.params.findingId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(204).send();
  }
);

module.exports = router;
