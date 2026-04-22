const express = require('express');
const axios = require('axios');
const dns = require('dns');
const tls = require('tls');
const net = require('net');
const { promisify } = require('util');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { toolLimiter } = require('../middleware/rateLimiter');
const { supabase } = require('../config/supabase');
const crypto = require('crypto');

const whois = require('whois-json');
const { parsePhoneNumber, isValidPhoneNumber, parsePhoneNumberFromString } = require('libphonenumber-js');

const router = express.Router();

// ── DNS promisified helpers ────────────────────────────────────────────────────
const resolveMx  = promisify(dns.resolveMx);
const resolveNs  = promisify(dns.resolveNs);
const resolveTxt = promisify(dns.resolveTxt);
const resolve4   = promisify(dns.resolve4);
const resolve6   = promisify(dns.resolve6);
const resolveCname = promisify(dns.resolveCname);
const resolveSoa = promisify(dns.resolveSoa);
const reverse    = promisify(dns.reverse);

const DISCLAIMER = 'This tool is for authorized security research only. Unauthorized use is illegal.';

// ── Disposable email domains ───────────────────────────────────────────────────
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','10minutemail.com','tempmail.com','throwaway.email',
  'yopmail.com','sharklasers.com','trashmail.com','trashmail.me','dispostable.com',
  'mailnull.com','tempr.email','temp-mail.org','emailondeck.com','fakemail.net',
  'maildrop.cc','spamgourmet.com','filzmail.com','getairmail.com','mohmal.com',
  'tempmailaddress.com','throwam.com','fakeinbox.com','mailexpire.com','meltmail.com',
  'mytrashmail.com','discard.email','tempinbox.com','toss.pw','10mail.org',
  'mailtemp.net','temp-mail.io','grr.la',
]);

const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com',
  'protonmail.com','live.com','aol.com',
]);

// ── Common ports for scanning ──────────────────────────────────────────────────
const TOP_PORTS = [21,22,23,25,53,80,110,135,139,143,443,445,993,995,1723,3306,3389,5900,8080,8443];
const SERVICE_MAP = {
  21:'FTP',22:'SSH',23:'Telnet',25:'SMTP',53:'DNS',80:'HTTP',
  110:'POP3',135:'MSRPC',139:'NetBIOS',143:'IMAP',443:'HTTPS',
  445:'SMB',465:'SMTPS',587:'SMTP',993:'IMAPS',995:'POP3S',
  1433:'MSSQL',1521:'Oracle',1723:'PPTP',2049:'NFS',3306:'MySQL',
  3389:'RDP',5432:'PostgreSQL',5672:'RabbitMQ',5900:'VNC',6379:'Redis',
  8080:'HTTP Alt',8443:'HTTPS Alt',8888:'Jupyter',9200:'Elasticsearch',27017:'MongoDB',
};

// ── Social platforms for username check ───────────────────────────────────────
const SOCIAL_PLATFORMS = [
  { name: 'GitHub',    base: 'https://github.com',          path: (u) => `/${u}` },
  { name: 'Twitter/X', base: 'https://x.com',               path: (u) => `/${u}` },
  { name: 'Instagram', base: 'https://www.instagram.com',   path: (u) => `/${u}/` },
  { name: 'Reddit',    base: 'https://www.reddit.com',      path: (u) => `/user/${u}` },
  { name: 'YouTube',   base: 'https://www.youtube.com',     path: (u) => `/@${u}` },
  { name: 'TikTok',    base: 'https://www.tiktok.com',      path: (u) => `/@${u}` },
  { name: 'Twitch',    base: 'https://www.twitch.tv',       path: (u) => `/${u}` },
  { name: 'GitLab',    base: 'https://gitlab.com',          path: (u) => `/${u}` },
  { name: 'Medium',    base: 'https://medium.com',          path: (u) => `/@${u}` },
  { name: 'Dev.to',    base: 'https://dev.to',              path: (u) => `/${u}` },
];
const NOT_FOUND_PATTERNS = {
  'GitHub': ['not found'],
  'Twitter/X': ["this account doesn", 'page not found'],
  'Reddit': ["nobody on reddit goes by that name"],
  'Dev.to': ['not found'],
};

// ── SSL certificate helper ─────────────────────────────────────────────────────
function getSSLCertificate(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname, port, servername: hostname,
        // rejectUnauthorized is intentionally false: this tool inspects the certificate
        // itself (including self-signed and expired certs) rather than validating it.
        rejectUnauthorized: false,
        timeout: 10000,
      },
      () => {
        const cert = socket.getPeerCertificate(true);
        const protocol = socket.getProtocol();
        const cipher = socket.getCipher();
        socket.end();
        if (!cert || Object.keys(cert).length === 0) { resolve(null); return; }
        const validTo   = new Date(cert.valid_to);
        const validFrom = new Date(cert.valid_from);
        const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / 86400000);
        const selfSigned = cert.issuer?.CN === cert.subject?.CN && cert.issuer?.O === cert.subject?.O;
        const san = cert.subjectaltname
          ? cert.subjectaltname.split(', ').map((s) => s.replace('DNS:', '').replace('IP Address:', '').trim())
          : [];
        resolve({
          subject: cert.subject, issuer: cert.issuer,
          valid_from: validFrom.toISOString(), valid_to: validTo.toISOString(),
          days_remaining: daysRemaining, expired: daysRemaining < 0,
          self_signed: selfSigned, fingerprint: cert.fingerprint,
          fingerprint256: cert.fingerprint256, san, protocol,
          cipher: { name: cipher?.name, bits: cipher?.secretKeySize },
          serial_number: cert.serialNumber,
        });
      }
    );
    socket.on('error', () => resolve(null));
    socket.setTimeout(10000, () => { socket.destroy(); resolve(null); });
  });
}

// ── Password strength ──────────────────────────────────────────────────────────
function analyzePassword(password) {
  const len = password.length;
  const hasLower   = /[a-z]/.test(password);
  const hasUpper   = /[A-Z]/.test(password);
  const hasDigits  = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  let charsetSize = 0;
  if (hasLower)   charsetSize += 26;
  if (hasUpper)   charsetSize += 26;
  if (hasDigits)  charsetSize += 10;
  if (hasSpecial) charsetSize += 32;
  charsetSize = Math.max(charsetSize, 1);

  const entropyBits = len > 0 ? Math.round(Math.log2(charsetSize) * len * 100) / 100 : 0;

  const patterns = [];
  const lower = password.toLowerCase();
  const COMMON_WORDS = ['password','pass','qwerty','letmein','welcome','admin','login','master','dragon','monkey'];
  for (const w of COMMON_WORDS) { if (lower.includes(w)) patterns.push(`common_word:${w}`); }
  if (/(.)\1{2,}/.test(password))  patterns.push('repeated_characters');
  if (/012|123|234|345|456|567|678|789/.test(password)) patterns.push('sequential_numbers');
  if (/abc|bcd|cde|def|efg|fgh|ghi|hij|jkl|klm|lmn|mno|nop|pqr|rst|stu|tuv|uvw|vwx|wxy|xyz/.test(lower)) patterns.push('sequential_letters');

  let score = 0;
  score += Math.min(len * 3, 30);
  score += hasLower  ? 10 : 0;
  score += hasUpper  ? 10 : 0;
  score += hasDigits ? 10 : 0;
  score += hasSpecial ? 20 : 0;
  score += Math.min(Math.floor(entropyBits / 3), 20);
  score -= patterns.length * 10;
  score = Math.max(0, Math.min(100, score));

  const label = score < 20 ? 'very_weak' : score < 40 ? 'weak' : score < 60 ? 'moderate' : score < 80 ? 'strong' : 'very_strong';

  const combinations = Math.pow(charsetSize, len);
  const crackSec = combinations / 10_000_000_000;
  const crackStr = crackSec < 1 ? 'instantly' : crackSec < 60 ? `${Math.floor(crackSec)} seconds`
    : crackSec < 3600 ? `${Math.floor(crackSec / 60)} minutes`
    : crackSec < 86400 ? `${Math.floor(crackSec / 3600)} hours`
    : crackSec < 31536000 ? `${Math.floor(crackSec / 86400)} days`
    : crackSec < 3153600000 ? `${Math.floor(crackSec / 31536000)} years`
    : 'centuries';

  const suggestions = [];
  if (len < 12)     suggestions.push('Use at least 12 characters.');
  if (!hasUpper)    suggestions.push('Add uppercase letters (A-Z).');
  if (!hasLower)    suggestions.push('Add lowercase letters (a-z).');
  if (!hasDigits)   suggestions.push('Add digits (0-9).');
  if (!hasSpecial)  suggestions.push('Add special characters (!@#$%^&*...).');
  if (patterns.length) suggestions.push('Avoid common words, keyboard walks, and repeated characters.');

  return {
    length: len,
    has_uppercase: hasUpper,
    has_lowercase: hasLower,
    has_digits: hasDigits,
    has_special: hasSpecial,
    charset_size: charsetSize,
    entropy_bits: entropyBits,
    strength_score: score,
    strength_label: label,
    crack_time_estimate: crackStr,
    common_patterns_detected: patterns,
    suggestions,
  };
}

// ── IP address validator ───────────────────────────────────────────────────────
const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
// Simplified IPv6 — reject obviously invalid strings while accepting common forms
const IPV6_RE = /^[0-9a-fA-F:]{2,39}$/;

function validateIp(ip) {
  if (IPV4_RE.test(ip) || IPV6_RE.test(ip)) return ip;
  throw new Error('Invalid IP address format.');
}
async function safeDns(fn) {
  try { return await fn(); } catch { return null; }
}

// ── Tool implementations ───────────────────────────────────────────────────────

async function runTool(tool_name, input) {
  switch (tool_name) {

    // ── Email: breach check ──────────────────────────────────────────────────
    case 'email-breach-check': {
      const email = String(input.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) throw new Error('Valid email address required.');
      const hibpKey = process.env.HIBP_API_KEY;
      if (!hibpKey) throw new Error('HIBP API key not configured. Set HIBP_API_KEY in environment.');
      const resp = await axios.get(
        `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`,
        { headers: { 'hibp-api-key': hibpKey, 'user-agent': 'CyberCord-OSINT/1.0' }, params: { truncateResponse: false }, timeout: 15000, validateStatus: (s) => s === 200 || s === 404 || s === 429 || s === 401 }
      );
      if (resp.status === 401) throw new Error('HIBP API key missing or invalid.');
      if (resp.status === 429) throw new Error('Rate limited by HIBP. Try again shortly.');
      const breaches = resp.status === 200 ? resp.data : [];
      const breachCount = breaches.length;
      const riskLevel = breachCount === 0 ? 'low' : breachCount <= 3 ? 'medium' : 'high';
      return {
        result: {
          email, breach_count: breachCount,
          breach_names: breaches.map((b) => b.Name || 'Unknown'),
          breaches: breaches.map((b) => ({
            name: b.Name, title: b.Title, breach_date: b.BreachDate,
            pwn_count: b.PwnCount, data_classes: b.DataClasses || [],
            is_verified: b.IsVerified || false, is_sensitive: b.IsSensitive || false,
          })),
        },
        risk_level: riskLevel, input: email,
      };
    }

    // ── Email: verify ────────────────────────────────────────────────────────
    case 'email-verify': {
      const email = String(input.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) throw new Error('Valid email address required.');
      const domain = email.split('@')[1];
      let hasMx = false, mxRecords = [], dnsError = null;
      try {
        const answers = await resolveMx(domain);
        mxRecords = answers.map((r) => String(r.exchange).replace(/\.$/, '')).sort();
        hasMx = true;
      } catch (e) {
        dnsError = e.message || 'DNS lookup failed';
      }
      const isDisposable = DISPOSABLE_DOMAINS.has(domain);
      const isFreeProvider = FREE_EMAIL_PROVIDERS.has(domain);
      return {
        result: { email, domain, is_valid_format: true, has_mx: hasMx, mx_records: mxRecords, dns_error: dnsError, is_disposable: isDisposable, is_free_provider: isFreeProvider },
        risk_level: isDisposable ? 'high' : hasMx ? 'low' : 'medium', input: email,
      };
    }

    // ── Email: analyze headers ───────────────────────────────────────────────
    case 'email-headers': {
      const raw = String(input.headers || '').trim();
      if (!raw) throw new Error('Email headers text is required.');
      const lines = raw.split(/\r?\n/);
      const headers = {};
      let currentKey = null;
      for (const line of lines) {
        if (/^\s/.test(line) && currentKey) {
          headers[currentKey] += ' ' + line.trim();
        } else {
          const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)/);
          if (match) { currentKey = match[1].toLowerCase(); headers[currentKey] = match[2].trim(); }
        }
      }
      const received = lines.filter((l) => /^Received:/i.test(l)).map((l) => l.replace(/^Received:\s*/i, '').trim());
      const authRaw = headers['authentication-results'] || '';
      const spfMatch = authRaw.match(/spf=(\w+)/i);
      const dkimMatch = authRaw.match(/dkim=(\w+)/i);
      const dmarcMatch = authRaw.match(/dmarc=(\w+)/i);
      const spfResult = spfMatch ? spfMatch[1].toLowerCase() : null;
      const dkimResult = dkimMatch ? dkimMatch[1].toLowerCase() : null;
      const dmarcResult = dmarcMatch ? dmarcMatch[1].toLowerCase() : null;
      const dkimSigPresent = 'dkim-signature' in headers;
      const failures = [spfResult && spfResult !== 'pass', dmarcResult && dmarcResult !== 'pass', !dkimSigPresent].filter(Boolean).length;
      return {
        result: {
          from: headers['from'] || null, to: headers['to'] || null, subject: headers['subject'] || null,
          date: headers['date'] || null, message_id: headers['message-id'] || null,
          reply_to: headers['reply-to'] || null, x_originating_ip: headers['x-originating-ip'] || null,
          received_chain: received, received_hop_count: received.length,
          dkim_signature_present: dkimSigPresent,
          spf_result: spfResult, dkim_result: dkimResult, dmarc_result: dmarcResult,
          authentication_results_raw: authRaw || null, authentication_failures: failures,
        },
        risk_level: failures >= 2 ? 'medium' : 'low', input: '[email headers]',
      };
    }

    // ── Domain: DNS lookup ───────────────────────────────────────────────────
    case 'dns-lookup': {
      const domain = String(input.domain || '').trim().toLowerCase().replace(/\.$/, '');
      if (!domain) throw new Error('Domain name required.');
      const [a, aaaa, mx, ns, txt, cname, soa] = await Promise.all([
        safeDns(() => resolve4(domain)),
        safeDns(() => resolve6(domain)),
        safeDns(() => resolveMx(domain).then((rs) => rs.map((r) => `${r.priority} ${r.exchange}`))),
        safeDns(() => resolveNs(domain)),
        safeDns(() => resolveTxt(domain).then((rs) => rs.map((r) => r.join('')))),
        safeDns(() => resolveCname(domain)),
        safeDns(() => resolveSoa(domain)),
      ]);
      const spf = (txt || []).find((t) => t.startsWith('v=spf1')) || null;
      let dmarc = null;
      try { const dt = await resolveTxt(`_dmarc.${domain}`); dmarc = dt.map((r) => r.join('')).find((t) => t.startsWith('v=DMARC1')) || null; } catch { }
      return {
        result: { domain, records: { A: a || [], AAAA: aaaa || [], MX: mx || [], NS: ns || [], TXT: txt || [], CNAME: cname || [] }, soa_record: soa || null, spf_record: spf, spf_valid: !!spf, dmarc_record: dmarc, dmarc_valid: !!dmarc },
        risk_level: 'low', input: domain,
      };
    }

    // ── Domain: WHOIS ────────────────────────────────────────────────────────
    case 'whois': {
      const domain = String(input.domain || '').trim().toLowerCase().replace(/\.$/, '');
      if (!domain) throw new Error('Domain name required.');
      let data;
      try { data = await whois(domain); } catch (e) { throw new Error(`WHOIS lookup failed: ${e.message}`); }
      const serialize = (v) => {
        if (Array.isArray(v)) return v.map(serialize);
        if (v instanceof Date) return v.toISOString();
        return v;
      };
      return {
        result: { domain, registrar: serialize(data.registrar), creation_date: serialize(data.creationDate || data.created), expiration_date: serialize(data.expirationDate || data.expires), updated_date: serialize(data.updatedDate || data.changed), name_servers: serialize(data.nameServers || data.nserver), status: serialize(data.status), emails: serialize(data.emails), country: serialize(data.country) },
        risk_level: 'low', input: domain,
      };
    }

    // ── Domain: SSL cert ─────────────────────────────────────────────────────
    case 'ssl-cert': {
      const host = String(input.host || '').trim().replace(/^https?:\/\//, '').split('/')[0];
      if (!host) throw new Error('Hostname required.');
      const port = Number(input.port) || 443;
      const cert = await getSSLCertificate(host, port);
      if (!cert) throw new Error('Could not retrieve SSL certificate. Host may be unreachable or not have TLS.');
      const riskLevel = cert.expired || cert.self_signed ? 'high' : cert.days_remaining < 30 ? 'medium' : 'low';
      return { result: { host, port, ...cert }, risk_level: riskLevel, input: `${host}:${port}` };
    }

    // ── Domain: subdomain enum ───────────────────────────────────────────────
    case 'subdomain-enum': {
      const domain = String(input.domain || '').trim().toLowerCase().replace(/\.$/, '');
      if (!domain) throw new Error('Domain name required.');
      const subdomains = new Map();
      // crt.sh
      try {
        const crtResp = await axios.get('https://crt.sh/', { params: { q: `%.${domain}`, output: 'json' }, timeout: 12000 });
        if (Array.isArray(crtResp.data)) {
          for (const entry of crtResp.data) {
            if (!entry.name_value) continue;
            for (const name of entry.name_value.split('\n')) {
              const clean = name.replace('*.', '').trim().toLowerCase();
              if (clean && clean !== domain && clean.endsWith(`.${domain}`)) {
                if (!subdomains.has(clean)) subdomains.set(clean, ['crt.sh']);
              }
            }
          }
        }
      } catch { }
      // hackertarget
      try {
        const htResp = await axios.get('https://api.hackertarget.com/hostsearch/', { params: { q: domain }, timeout: 8000 });
        if (typeof htResp.data === 'string' && !htResp.data.includes('error')) {
          for (const line of htResp.data.split('\n')) {
            const [sub] = line.split(',');
            if (sub && sub.endsWith(`.${domain}`) && sub !== domain) {
              if (!subdomains.has(sub)) subdomains.set(sub, ['hackertarget']);
              else subdomains.get(sub).push('hackertarget');
            }
          }
        }
      } catch { }
      const result = Array.from(subdomains.entries()).slice(0, 100).map(([subdomain, sources]) => ({ subdomain, sources: [...new Set(sources)] }));
      return { result: { domain, found_count: result.length, subdomains: result }, risk_level: 'low', input: domain };
    }

    // ── IP: geolocate ────────────────────────────────────────────────────────
    case 'ip-geolocate': {
      const ip = validateIp(String(input.ip || '').trim());
      const fields = 'status,message,continent,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting';
      // ip is validated above — only digits, dots, colons (IPv4/IPv6 characters)
      const resp = await axios.get(`http://ip-api.com/json/${ip}`, { params: { fields }, timeout: 10000 });
      const data = resp.data;
      if (data.status === 'fail') throw new Error(data.message || 'Geolocation failed.');
      const riskLevel = data.proxy || data.hosting ? 'high' : 'low';
      return {
        result: { ip, continent: data.continent, country: data.country, country_code: data.countryCode, region: data.region, region_name: data.regionName, city: data.city, zip: data.zip, lat: data.lat, lon: data.lon, timezone: data.timezone, isp: data.isp, org: data.org, as: data.as, as_name: data.asname, reverse_dns: data.reverse, is_mobile: data.mobile, is_proxy: data.proxy, is_hosting: data.hosting },
        risk_level: riskLevel, input: ip,
      };
    }

    // ── IP: reputation ───────────────────────────────────────────────────────
    case 'ip-reputation': {
      const ip = validateIp(String(input.ip || '').trim());
      const abuseKey = process.env.ABUSEIPDB_API_KEY;
      if (!abuseKey) throw new Error('AbuseIPDB API key not configured. Set ABUSEIPDB_API_KEY in environment.');
      const resp = await axios.get('https://api.abuseipdb.com/api/v2/check', {
        headers: { Key: abuseKey, Accept: 'application/json' },
        params: { ipAddress: ip, maxAgeInDays: '90', verbose: '' },
        timeout: 10000,
      });
      const data = resp.data.data || {};
      const score = data.abuseConfidenceScore || 0;
      const riskLevel = score >= 80 ? 'critical' : score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low';
      return {
        result: { ip, abuse_confidence_score: score, total_reports: data.totalReports, last_reported_at: data.lastReportedAt, is_public: data.isPublic, ip_version: data.ipVersion, is_whitelisted: data.isWhitelisted, country_code: data.countryCode, usage_type: data.usageType, isp: data.isp, domain: data.domain, num_distinct_users: data.numDistinctUsers },
        risk_level: riskLevel, input: ip,
      };
    }

    // ── IP: port scan ────────────────────────────────────────────────────────
    case 'port-scan': {
      const host = String(input.host || '').trim();
      if (!host) throw new Error('Hostname or IP required.');
      let portsToScan = TOP_PORTS;
      if (input.ports) {
        const raw = String(input.ports);
        if (raw.includes('-')) {
          const [start, end] = raw.split('-').map(Number);
          if (!isNaN(start) && !isNaN(end)) {
            portsToScan = [];
            for (let p = start; p <= Math.min(end, start + 199); p++) portsToScan.push(p);
          }
        } else {
          portsToScan = raw.split(',').map((p) => parseInt(p.trim(), 10)).filter((p) => p > 0 && p <= 65535).slice(0, 200);
        }
      }
      const openPorts = [];
      const concurrency = 20;
      let idx = 0;
      async function probe(port) {
        return new Promise((res) => {
          const sock = net.createConnection({ host, port, timeout: 1500 });
          sock.on('connect', () => { sock.destroy(); res({ port, state: 'open', service: SERVICE_MAP[port] || 'unknown' }); });
          sock.on('error', () => { sock.destroy(); res(null); });
          sock.on('timeout', () => { sock.destroy(); res(null); });
        });
      }
      const workers = Array.from({ length: Math.min(concurrency, portsToScan.length) }, async () => {
        while (idx < portsToScan.length) {
          const port = portsToScan[idx++];
          const r = await probe(port);
          if (r) openPorts.push(r);
        }
      });
      await Promise.all(workers);
      openPorts.sort((a, b) => a.port - b.port);
      const riskLevel = openPorts.length > 10 ? 'high' : openPorts.length > 0 ? 'medium' : 'low';
      return { result: { host, ports_scanned: portsToScan.length, open_port_count: openPorts.length, open_ports: openPorts }, risk_level: riskLevel, input: host };
    }

    // ── Username: check ──────────────────────────────────────────────────────
    case 'username-check': {
      const username = String(input.username || '').trim().replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 50);
      if (!username) throw new Error('Username required (alphanumeric, dots, underscores, hyphens).');
      const results = await Promise.all(SOCIAL_PLATFORMS.map(async ({ name, base, path }) => {
        const urlObj = new URL(base);
        urlObj.pathname = path(username);
        const profileUrl = urlObj.toString();
        try {
          const r = await axios.get(profileUrl, { timeout: 6000, maxRedirects: 3, validateStatus: (s) => s < 500, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CybercordBot/2.0)' } });
          const body = (typeof r.data === 'string' ? r.data : '').toLowerCase();
          const patterns = NOT_FOUND_PATTERNS[name] || ['not found', 'page not found', 'user not found'];
          if (r.status === 404 || patterns.some((p) => body.includes(p))) return { platform: name, status: 'NOT_FOUND', url: profileUrl };
          return { platform: name, status: 'FOUND', url: profileUrl };
        } catch {
          return { platform: name, status: 'NOT_FOUND', url: profileUrl };
        }
      }));
      const foundCount = results.filter((r) => r.status === 'FOUND').length;
      return {
        result: { username, platforms_checked: results.length, found_count: foundCount, platforms: results },
        risk_level: 'low', input: username,
      };
    }

    // ── Phone: lookup ────────────────────────────────────────────────────────
    case 'phone-lookup': {
      const phone = String(input.phone || '').trim();
      if (!phone) throw new Error('Phone number required.');
      const region = String(input.country_code || 'US').toUpperCase();
      let parsed;
      try { parsed = parsePhoneNumber(phone, region); } catch (e) { throw new Error(`Invalid phone number: ${e.message}`); }
      if (!parsed) throw new Error('Could not parse phone number.');
      const isValid = parsed.isValid();
      return {
        result: {
          input: phone, country_code_hint: region, is_valid: isValid,
          country_code: parsed.countryCallingCode,
          national_number: parsed.nationalNumber,
          international_format: isValid ? parsed.formatInternational() : null,
          national_format: isValid ? parsed.formatNational() : null,
          e164_format: isValid ? parsed.format('E.164') : null,
          number_type: parsed.getType() || 'UNKNOWN',
          country: parsed.country || null,
        },
        risk_level: 'low', input: phone,
      };
    }

    // ── Phone: format ────────────────────────────────────────────────────────
    case 'phone-format': {
      const phone = String(input.phone || '').trim();
      if (!phone) throw new Error('Phone number required.');
      const region = String(input.country_code || 'US').toUpperCase();
      let parsed;
      try { parsed = parsePhoneNumber(phone, region); } catch (e) { throw new Error(`Invalid phone number: ${e.message}`); }
      const isValid = parsed && parsed.isValid();
      return {
        result: {
          input: phone, is_valid: Boolean(isValid),
          country_code: parsed?.countryCallingCode || null,
          region_code: parsed?.country || null,
          formats: isValid ? {
            e164: parsed.format('E.164'), international: parsed.formatInternational(),
            national: parsed.formatNational(), rfc3966: parsed.format('RFC3966'),
          } : { e164: null, international: null, national: null, rfc3966: null },
        },
        risk_level: 'low', input: phone,
      };
    }

    // ── Metadata: extract from URL ───────────────────────────────────────────
    case 'metadata-extract': {
      const url = String(input.url || '').trim();
      if (!url) throw new Error('A publicly accessible image URL is required.');
      let parsedUrl;
      try { parsedUrl = new URL(url); } catch { throw new Error('Invalid URL format.'); }
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Only http/https URLs are supported.');
      const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, maxRedirects: 5 });
      const contentType = resp.headers['content-type'] || '';
      const size = resp.data.byteLength;
      if (size > 20 * 1024 * 1024) throw new Error('File too large (max 20 MB).');
      const filename = parsedUrl.pathname.split('/').pop() || 'image';
      // Return basic HTTP-level metadata; EXIF requires a native image library not available here
      return {
        result: {
          source_url: url, filename, content_type: contentType,
          file_size_bytes: size, content_length: resp.headers['content-length'] || null,
          server: resp.headers['server'] || null, last_modified: resp.headers['last-modified'] || null,
          etag: resp.headers['etag'] || null, cache_control: resp.headers['cache-control'] || null,
          note: 'HTTP-level metadata extracted. Full EXIF parsing requires server-side image processing.',
        },
        risk_level: 'low', input: url,
      };
    }

    // ── Social: GitHub OSINT ──────────────────────────────────────────────────
    case 'github-osint': {
      const username = String(input.username || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 39);
      if (!username) throw new Error('GitHub username required (alphanumeric, hyphens, underscores).');
      const ghHeaders = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'CyberCord-OSINT/1.0' };
      const userUrl = new URL('https://api.github.com');
      userUrl.pathname = `/users/${username}`;
      const userResp = await axios.get(userUrl.toString(), { headers: ghHeaders, timeout: 10000, validateStatus: (s) => s === 200 || s === 404 || s === 403 });
      if (userResp.status === 404) throw new Error(`GitHub user '${username}' not found.`);
      if (userResp.status === 403) throw new Error('GitHub API rate limit exceeded.');
      const user = userResp.data;
      const reposUrl = new URL('https://api.github.com');
      reposUrl.pathname = `/users/${username}/repos`;
      reposUrl.searchParams.set('sort', 'pushed');
      reposUrl.searchParams.set('per_page', '10');
      const reposResp = await axios.get(reposUrl.toString(), { headers: ghHeaders, timeout: 10000, validateStatus: (s) => s === 200 });
      const repos = reposResp.status === 200 ? reposResp.data : [];
      let accountAgeDays = null;
      if (user.created_at) {
        try { accountAgeDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000); } catch { }
      }
      return {
        result: {
          login: user.login, name: user.name, bio: user.bio, company: user.company, location: user.location,
          email: user.email, blog: user.blog, twitter_username: user.twitter_username,
          created_at: user.created_at, updated_at: user.updated_at, account_age_days: accountAgeDays,
          public_repos: user.public_repos, public_gists: user.public_gists,
          followers: user.followers, following: user.following,
          avatar_url: user.avatar_url, html_url: user.html_url,
          site_admin: user.site_admin, hireable: user.hireable,
          top_repos: repos.map((r) => ({ name: r.name, description: r.description, language: r.language, stars: r.stargazers_count, forks: r.forks_count, last_push: r.pushed_at, url: r.html_url, is_fork: r.fork })),
        },
        risk_level: 'low', input: username,
      };
    }

    // ── Security: password strength ───────────────────────────────────────────
    case 'password-strength': {
      const password = String(input.password || '');
      if (!password) throw new Error('Password is required.');
      const analysis = analyzePassword(password);
      const riskLevel = ['very_weak', 'weak'].includes(analysis.strength_label) ? 'high' : analysis.strength_label === 'moderate' ? 'medium' : 'low';
      return { result: analysis, risk_level: riskLevel, input: '[password hidden]' };
    }

    default:
      throw new Error(`Unknown tool: ${tool_name}`);
  }
}

// ============================================================
// Tool registry (input_schema as flat array, matching frontend Tool type)
// ============================================================

const TOOLS = [
  { tool_name: 'email-breach-check', category: 'email', description: 'Check if an email address has appeared in known data breaches.', risk_level: 'medium', input_schema: [{ name: 'email', type: 'email', required: true, description: 'Email address to check' }], requires_api_key: true },
  { tool_name: 'email-verify', category: 'email', description: 'Verify email deliverability via MX record check.', risk_level: 'low', input_schema: [{ name: 'email', type: 'email', required: true, description: 'Email address to verify' }], requires_api_key: false },
  { tool_name: 'email-headers', category: 'email', description: 'Parse and analyze email headers to trace origin and routing.', risk_level: 'low', input_schema: [{ name: 'headers', type: 'textarea', required: true, description: 'Raw email header text' }], requires_api_key: false },
  { tool_name: 'dns-lookup', category: 'domain', description: 'Perform DNS lookups for A, AAAA, MX, NS, TXT, and CNAME records.', risk_level: 'low', input_schema: [{ name: 'domain', type: 'text', required: true, description: 'Domain name to query' }], requires_api_key: false },
  { tool_name: 'whois', category: 'domain', description: 'Retrieve WHOIS registration data for a domain.', risk_level: 'low', input_schema: [{ name: 'domain', type: 'text', required: true, description: 'Domain to query WHOIS for' }], requires_api_key: false },
  { tool_name: 'ssl-cert', category: 'domain', description: 'Inspect the SSL/TLS certificate of a host for validity and details.', risk_level: 'low', input_schema: [{ name: 'host', type: 'text', required: true, description: 'Hostname or domain' }, { name: 'port', type: 'number', required: false, description: 'Port number, default 443', placeholder: '443' }], requires_api_key: false },
  { tool_name: 'subdomain-enum', category: 'domain', description: 'Enumerate subdomains using certificate transparency logs.', risk_level: 'medium', input_schema: [{ name: 'domain', type: 'text', required: true, description: 'Root domain to enumerate' }], requires_api_key: false },
  { tool_name: 'ip-geolocate', category: 'ip', description: 'Get geolocation data (country, city, coordinates, ASN) for an IP address.', risk_level: 'low', input_schema: [{ name: 'ip', type: 'text', required: true, description: 'IPv4 or IPv6 address' }], requires_api_key: false },
  { tool_name: 'ip-reputation', category: 'ip', description: 'Check an IP address against threat intelligence and abuse databases.', risk_level: 'medium', input_schema: [{ name: 'ip', type: 'text', required: true, description: 'IPv4 or IPv6 address' }], requires_api_key: true },
  { tool_name: 'port-scan', category: 'ip', description: 'Scan common ports on a host to identify open services.', risk_level: 'high', input_schema: [{ name: 'host', type: 'text', required: true, description: 'Hostname or IP address' }, { name: 'ports', type: 'text', required: false, description: 'Comma-separated ports or range e.g. "22,80,443" or "1-1024"', placeholder: '22,80,443' }], requires_api_key: false },
  { tool_name: 'username-check', category: 'username', description: 'Check username presence across major social networks and platforms.', risk_level: 'low', input_schema: [{ name: 'username', type: 'text', required: true, description: 'Username to search for' }], requires_api_key: false },
  { tool_name: 'phone-lookup', category: 'phone', description: 'Look up carrier, region, and line type for a phone number.', risk_level: 'medium', input_schema: [{ name: 'phone', type: 'text', required: true, description: 'Phone number e.g. +14155552671' }, { name: 'country_code', type: 'text', required: false, description: 'ISO country code hint e.g. US', placeholder: 'US' }], requires_api_key: false },
  { tool_name: 'phone-format', category: 'phone', description: 'Parse and format a phone number into international and national formats.', risk_level: 'low', input_schema: [{ name: 'phone', type: 'text', required: true, description: 'Raw phone number string' }, { name: 'country_code', type: 'text', required: false, description: 'ISO country code hint e.g. US', placeholder: 'US' }], requires_api_key: false },
  { tool_name: 'metadata-extract', category: 'metadata', description: 'Extract metadata from an image URL (HTTP headers, content type, size).', risk_level: 'low', input_schema: [{ name: 'url', type: 'text', required: true, description: 'Publicly accessible image URL' }], requires_api_key: false },
  { tool_name: 'github-osint', category: 'social', description: 'Gather OSINT data from a GitHub user profile: repos, stars, orgs, email leaks.', risk_level: 'low', input_schema: [{ name: 'username', type: 'text', required: true, description: 'GitHub username' }], requires_api_key: false },
  { tool_name: 'password-strength', category: 'security', description: 'Analyse password strength, entropy, and pattern weaknesses.', risk_level: 'low', input_schema: [{ name: 'password', type: 'text', required: true, description: 'Password to evaluate' }], requires_api_key: false },
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

    // Resolve canonical tool name from registry to prevent injection
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
      .insert({ user_id: userId, tool_name, input_hash: inputHash, status: 'pending' })
      .select('id')
      .single();

    if (logInsertError) {
      return res.status(500).json({ error: 'Failed to initialise usage log' });
    }

    const logId = logRow?.id;

    try {
      const { result, risk_level, input: toolInput } = await runTool(tool_name, input);
      const executionTimeMs = Date.now() - startTime;

      // Update log to success
      if (logId) {
        await supabase
          .from('tool_usage_logs')
          .update({ status: 'success', execution_time_ms: executionTimeMs })
          .eq('id', logId);
      }

      // Build the ToolResult response matching the frontend interface
      const toolResult = {
        tool: tool_name,
        input: toolInput,
        result,
        risk_level,
        disclaimer: DISCLAIMER,
        timestamp: new Date().toISOString(),
      };

      // If caller provided an investigation_id, auto-save a finding
      if (investigation_id) {
        await supabase.from('investigation_findings').insert({
          investigation_id,
          tool_name,
          input_data: input,
          result_data: toolResult,
          risk_level,
        });
      }

      return res.json(toolResult);
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;

      if (logId) {
        await supabase
          .from('tool_usage_logs')
          .update({ status: 'error', execution_time_ms: executionTimeMs })
          .eq('id', logId);
      }

      const message = err.message || 'Tool execution failed';
      return res.status(400).json({ error: message });
    }
  }
);

module.exports = router;
