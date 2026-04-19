const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { toolLimiter } = require('../middleware/rateLimiter');
const { supabase } = require('../config/supabase');
const crypto = require('crypto');

const router = express.Router();

// ============================================================
// Tool registry
// ============================================================

const TOOLS = [
  {
    tool_name: 'email-breach-check',
    category: 'email',
    description: 'Check if an email address has appeared in known data breaches.',
    risk_level: 'medium',
    input_schema: {
      fields: [
        { name: 'email', type: 'string', required: true, description: 'Email address to check' },
      ],
    },
    requires_api_key: true,
  },
  {
    tool_name: 'email-verify',
    category: 'email',
    description: 'Verify email deliverability via MX record and SMTP check.',
    risk_level: 'low',
    input_schema: {
      fields: [
        { name: 'email', type: 'string', required: true, description: 'Email address to verify' },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'email-headers',
    category: 'email',
    description: 'Parse and analyze email headers to trace origin and routing.',
    risk_level: 'low',
    input_schema: {
      fields: [
        { name: 'headers', type: 'string', required: true, description: 'Raw email header text' },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'dns-lookup',
    category: 'domain',
    description: 'Perform DNS lookups for A, AAAA, MX, NS, TXT, and CNAME records.',
    risk_level: 'low',
    input_schema: {
      fields: [
        { name: 'domain', type: 'string', required: true, description: 'Domain name to query' },
        {
          name: 'record_types',
          type: 'array',
          required: false,
          description: 'Record types to fetch, e.g. ["A","MX"]. Defaults to all common types.',
        },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'whois',
    category: 'domain',
    description: 'Retrieve WHOIS registration data for a domain.',
    risk_level: 'low',
    input_schema: {
      fields: [
        { name: 'domain', type: 'string', required: true, description: 'Domain to query WHOIS for' },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'ssl-cert',
    category: 'domain',
    description: 'Inspect the SSL/TLS certificate of a host for validity and details.',
    risk_level: 'low',
    input_schema: {
      fields: [
        { name: 'host', type: 'string', required: true, description: 'Hostname or domain' },
        { name: 'port', type: 'integer', required: false, description: 'Port number, default 443' },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'subdomain-enum',
    category: 'domain',
    description: 'Enumerate subdomains using passive DNS and certificate transparency logs.',
    risk_level: 'medium',
    input_schema: {
      fields: [
        { name: 'domain', type: 'string', required: true, description: 'Root domain to enumerate' },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'ip-geolocate',
    category: 'ip',
    description: 'Get geolocation data (country, city, coordinates, ASN) for an IP address.',
    risk_level: 'low',
    input_schema: {
      fields: [
        { name: 'ip', type: 'string', required: true, description: 'IPv4 or IPv6 address' },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'ip-reputation',
    category: 'ip',
    description: 'Check an IP address against threat intelligence and abuse databases.',
    risk_level: 'medium',
    input_schema: {
      fields: [
        { name: 'ip', type: 'string', required: true, description: 'IPv4 or IPv6 address' },
      ],
    },
    requires_api_key: true,
  },
  {
    tool_name: 'port-scan',
    category: 'ip',
    description: 'Scan common ports on a host to identify open services.',
    risk_level: 'high',
    input_schema: {
      fields: [
        { name: 'host', type: 'string', required: true, description: 'Hostname or IP address' },
        {
          name: 'ports',
          type: 'string',
          required: false,
          description: 'Comma-separated ports or range, e.g. "22,80,443" or "1-1024"',
        },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'username-check',
    category: 'username',
    description: 'Check username availability across major social networks and platforms.',
    risk_level: 'low',
    input_schema: {
      fields: [
        { name: 'username', type: 'string', required: true, description: 'Username to search for' },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'phone-lookup',
    category: 'phone',
    description: 'Look up carrier, region, and line type for a phone number.',
    risk_level: 'medium',
    input_schema: {
      fields: [
        {
          name: 'phone',
          type: 'string',
          required: true,
          description: 'Phone number in E.164 format, e.g. +14155552671',
        },
      ],
    },
    requires_api_key: true,
  },
  {
    tool_name: 'phone-format',
    category: 'phone',
    description: 'Parse and format a phone number into international and national formats.',
    risk_level: 'low',
    input_schema: {
      fields: [
        { name: 'phone', type: 'string', required: true, description: 'Raw phone number string' },
        {
          name: 'country_code',
          type: 'string',
          required: false,
          description: 'ISO 3166-1 alpha-2 country code hint, e.g. "US"',
        },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'metadata-extract',
    category: 'metadata',
    description: 'Extract EXIF and document metadata from uploaded files or URLs.',
    risk_level: 'low',
    input_schema: {
      fields: [
        {
          name: 'url',
          type: 'string',
          required: false,
          description: 'Publicly accessible URL to the file',
        },
        {
          name: 'file_base64',
          type: 'string',
          required: false,
          description: 'Base64-encoded file content (max 10 MB)',
        },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'github-osint',
    category: 'social',
    description: 'Gather OSINT data from a GitHub user profile: repos, stars, orgs, email leaks.',
    risk_level: 'low',
    input_schema: {
      fields: [
        { name: 'username', type: 'string', required: true, description: 'GitHub username' },
      ],
    },
    requires_api_key: false,
  },
  {
    tool_name: 'password-strength',
    category: 'security',
    description: 'Analyse password strength, entropy, and pattern weaknesses.',
    risk_level: 'low',
    input_schema: {
      fields: [
        { name: 'password', type: 'string', required: true, description: 'Password to evaluate' },
      ],
    },
    requires_api_key: false,
  },
];

const TOOL_NAMES = new Set(TOOLS.map((t) => t.tool_name));

// ============================================================
// GET /list
// ============================================================

router.get('/list', (_req, res) => {
  res.json({ tools: TOOLS, count: TOOLS.length });
});

// ============================================================
// POST /run
// ============================================================

router.post(
  '/run',
  authenticate,
  toolLimiter,
  [
    body('tool_name')
      .isString()
      .notEmpty()
      .custom((val) => {
        if (!TOOL_NAMES.has(val)) throw new Error(`Unknown tool: ${val}`);
        return true;
      }),
    body('input').isObject().withMessage('input must be a JSON object'),
    body('investigation_id').optional().isUUID(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tool_name: rawToolName, input, investigation_id } = req.body;
    const userId = req.user.id;
    const startTime = Date.now();

    // Resolve the canonical tool name from the registry to prevent URL injection
    const toolMeta = TOOLS.find((t) => t.tool_name === rawToolName);
    if (!toolMeta) {
      return res.status(400).json({ error: 'Unknown tool' });
    }
    const tool_name = toolMeta.tool_name;

    // Stable hash of the input for deduplication / audit
    const inputHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');

    // Insert a pending log row upfront
    const { data: logRow, error: logInsertError } = await supabase
      .from('tool_usage_logs')
      .insert({
        user_id: userId,
        tool_name,
        input_hash: inputHash,
        status: 'pending',
      })
      .select('id')
      .single();

    if (logInsertError) {
      return res.status(500).json({ error: 'Failed to initialise usage log' });
    }

    const logId = logRow?.id;

    try {
      const pythonUrl = process.env.PYTHON_SERVICES_URL || 'http://localhost:8000';
      // tool_name is resolved from the static TOOLS registry — never raw user input
      const toolPath = encodeURIComponent(tool_name);
      const response = await axios.post(
        `${pythonUrl}/tools/${toolPath}`,
        { input },
        { timeout: 30000 }
      );

      const executionTimeMs = Date.now() - startTime;

      // Update log to success
      if (logId) {
        await supabase
          .from('tool_usage_logs')
          .update({ status: 'success', execution_time_ms: executionTimeMs })
          .eq('id', logId);
      }

      // If caller provided an investigation_id, auto-save a finding
      if (investigation_id) {
        await supabase.from('investigation_findings').insert({
          investigation_id,
          tool_name,
          input_data: input,
          result_data: response.data,
          risk_level: toolMeta.risk_level,
        });
      }

      return res.json({
        tool_name,
        execution_time_ms: executionTimeMs,
        result: response.data,
      });
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;

      if (logId) {
        await supabase
          .from('tool_usage_logs')
          .update({ status: 'error', execution_time_ms: executionTimeMs })
          .eq('id', logId);
      }

      const status = err.response?.status || 502;
      const message = err.response?.data?.error || err.message || 'Tool execution failed';

      return res.status(status).json({ error: message });
    }
  }
);

module.exports = router;
