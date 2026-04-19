const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All AI routes require authentication
router.use(authenticate);

const AI_TIMEOUT_MS = 60000; // 60 s — AI inference can be slow

function getAiUrl() {
  return process.env.AI_ENGINE_URL || 'http://localhost:5001';
}

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

// ============================================================
// POST /analyze
// Analyze a set of findings for threat patterns and anomalies.
// ============================================================

router.post(
  '/analyze',
  [
    body('findings').isArray({ min: 1 }).withMessage('findings must be a non-empty array'),
    body('context').optional().isObject(),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const { findings, context = {} } = req.body;

    try {
      const response = await axios.post(
        `${getAiUrl()}/analyze`,
        {
          findings,
          context,
          user_id: req.user.id,
        },
        { timeout: AI_TIMEOUT_MS }
      );

      return res.json(response.data);
    } catch (err) {
      const status = err.response?.status || 502;
      const message = err.response?.data?.error || err.message || 'AI engine error';
      return res.status(status).json({ error: message });
    }
  }
);

// ============================================================
// POST /summarize
// Produce a natural-language summary of an investigation.
// ============================================================

router.post(
  '/summarize',
  [
    body('investigation').isObject().withMessage('investigation must be an object'),
    body('findings').isArray().withMessage('findings must be an array'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const { investigation, findings } = req.body;

    try {
      const response = await axios.post(
        `${getAiUrl()}/summarize`,
        {
          investigation,
          findings,
          user_id: req.user.id,
        },
        { timeout: AI_TIMEOUT_MS }
      );

      return res.json(response.data);
    } catch (err) {
      const status = err.response?.status || 502;
      const message = err.response?.data?.error || err.message || 'AI engine error';
      return res.status(status).json({ error: message });
    }
  }
);

// ============================================================
// POST /recommend
// Get AI-driven recommendations for next investigative steps.
// ============================================================

router.post(
  '/recommend',
  [
    body('investigation').isObject().withMessage('investigation must be an object'),
    body('findings').isArray().withMessage('findings must be an array'),
    body('current_focus').optional().isString(),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const { investigation, findings, current_focus } = req.body;

    try {
      const response = await axios.post(
        `${getAiUrl()}/recommend`,
        {
          investigation,
          findings,
          current_focus: current_focus || null,
          user_id: req.user.id,
        },
        { timeout: AI_TIMEOUT_MS }
      );

      return res.json(response.data);
    } catch (err) {
      const status = err.response?.status || 502;
      const message = err.response?.data?.error || err.message || 'AI engine error';
      return res.status(status).json({ error: message });
    }
  }
);

module.exports = router;
