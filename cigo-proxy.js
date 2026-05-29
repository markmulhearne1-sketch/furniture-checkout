/**
 * Cigo API Proxy — cigo-proxy.js
 * ─────────────────────────────────────────────────────────────
 * Runs locally on your machine and forwards requests from the
 * checkout demo page to the Cigo API, adding CORS headers so
 * the browser stops blocking them.
 *
 * HOW TO RUN:
 *   1. Open Terminal
 *   2. cd ~/Desktop/cigo-marketing/cigo-marketing
 *   3. node cigo-proxy.js
 *   4. You should see: ✅ Cigo proxy running at http://localhost:3001
 *
 * Then in the checkout page Developer settings:
 *   → Change Environment to:  http://localhost:3001
 *   → Click Test & Apply
 *
 * REQUIRES: Node.js  (check by running: node --version in Terminal)
 * If you don't have Node: https://nodejs.org → click "LTS" → install
 * ─────────────────────────────────────────────────────────────
 */

const http  = require('http');
const https = require('https');
const url   = require('url');

const PORT = 3001;

// Exact allowed paths
const ALLOWED_PATHS = [
  '/available-booking-dates',
  '/available-slots',
  '/api/v1/available-booking-dates',
  '/api/v1/available-slots',
  '/api/v1/jobs',
  '/api/v1/itineraries',
];

// Prefix-matched paths (for routes with dynamic IDs/dates)
const ALLOWED_PREFIXES = [
  '/api/v1/itineraries/',  // covers /date/{date} and /{id}
];

const server = http.createServer((req, res) => {

  // ── CORS headers ─────────────────────────────────────────
  // These let the browser talk to this local proxy from any origin
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  // Preflight request — browser sends this before the real request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Route check ───────────────────────────────────────────
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  const allowed = ALLOWED_PATHS.includes(pathname)
    || ALLOWED_PREFIXES.some(p => pathname.startsWith(p));
  if (!allowed) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Unknown path: ${pathname}` }));
    return;
  }

  // ── Read target base URL from query param _base ───────────
  // The checkout page passes its Environment URL as _base=...
  // We strip it before forwarding to Cigo.
  const queryParams = { ...parsed.query };
  const cigoBase    = queryParams._base || 'https://app.cigotracker.com';
  delete queryParams._base;

  const forwardQuery = new URLSearchParams(queryParams).toString();
  const targetUrl    = `${cigoBase}${pathname}${forwardQuery ? '?' + forwardQuery : ''}`;

  // ── Forward Authorization header from browser → Cigo ──────
  const authHeader = req.headers['authorization'] || '';
  const method     = req.method; // GET or POST

  console.log(`→ ${new Date().toLocaleTimeString()}  ${method} ${pathname}`);
  console.log(`  Full URL: ${targetUrl}`);
  console.log(`  Auth:   ${authHeader ? 'provided ✓' : 'MISSING ✗'}`);

  // ── Collect request body (for POST) ───────────────────────
  let bodyData = '';
  req.on('data', chunk => { bodyData += chunk.toString(); });
  req.on('end', () => {

    // ── Make the request to Cigo ─────────────────────────────
    const cigoUrl    = new URL(targetUrl);
    const reqHeaders = {
      'Authorization': authHeader,
      'Accept':        'application/json',
    };
    if (method === 'POST') {
      reqHeaders['Content-Type']   = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const reqOptions = {
      hostname: cigoUrl.hostname,
      path:     cigoUrl.pathname + (cigoUrl.search || ''),
      method,
      headers:  reqHeaders,
    };

    const cigoReq = https.request(reqOptions, (cigoRes) => {
      console.log(`  Status: ${cigoRes.statusCode}`);
      res.writeHead(cigoRes.statusCode, { 'Content-Type': 'application/json' });
      cigoRes.pipe(res);
    });

    cigoReq.on('error', (err) => {
      console.error(`  Error: ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy could not reach Cigo API', detail: err.message }));
    });

    if (method === 'POST' && bodyData) {
      cigoReq.write(bodyData);
    }
    cigoReq.end();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('✅ Cigo proxy running at http://localhost:' + PORT);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open furniture-checkout-demo.html in your browser');
  console.log('  2. Open Developer settings in the page');
  console.log('  3. Switch to Live API');
  console.log('  4. Change Environment to:  http://localhost:' + PORT);
  console.log('  5. Enter your API Key + Secret → click Test & Apply');
  console.log('');
  console.log('Request log:');
  console.log('─────────────────────────────────────────────────────');
});
