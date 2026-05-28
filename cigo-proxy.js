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

// Allowed Cigo endpoints to proxy
const ALLOWED_PATHS = [
  '/available-booking-dates',
  '/available-slots',
  '/api/v1/available-booking-dates',
  '/api/v1/available-slots',
];

const server = http.createServer((req, res) => {

  // ── CORS headers ─────────────────────────────────────────
  // These let the browser talk to this local proxy from any origin
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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

  if (!ALLOWED_PATHS.includes(pathname)) {
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
  const targetUrl    = `${cigoBase}${pathname}?${forwardQuery}`;

  // ── Forward Authorization header from browser → Cigo ──────
  const authHeader = req.headers['authorization'] || '';

  console.log(`→ ${new Date().toLocaleTimeString()}  GET ${pathname}`);
  console.log(`  Full URL: ${targetUrl}`);
  console.log(`  Auth:   ${authHeader ? 'provided ✓' : 'MISSING ✗'}`);

  // ── Make the request to Cigo ───────────────────────────────
  const cigoUrl    = new URL(targetUrl);
  const reqOptions = {
    hostname: cigoUrl.hostname,
    path:     cigoUrl.pathname + '?' + cigoUrl.searchParams.toString(),
    method:   'GET',
    headers: {
      'Authorization': authHeader,
      'Accept':        'application/json',
    }
  };

  const cigoReq = https.request(reqOptions, (cigoRes) => {
    console.log(`  Status: ${cigoRes.statusCode}`);

    // Pass Cigo's status + JSON back to the browser
    res.writeHead(cigoRes.statusCode, {
      'Content-Type': 'application/json',
    });
    cigoRes.pipe(res);
  });

  cigoReq.on('error', (err) => {
    console.error(`  Error: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy could not reach Cigo API', detail: err.message }));
  });

  cigoReq.end();
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
