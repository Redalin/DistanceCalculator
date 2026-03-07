import express from 'express';
import dns from 'dns';
import { URL } from 'url';
import https from 'https';

const dnsPromises = dns.promises;

// Perform an HTTPS GET using an IPv4-only DNS lookup while preserving TLS SNI (servername).
// Returns parsed JSON.
async function fetchPreferIPv4Json(rawUrl, timeoutMs = 15000) {
  const u = new URL(rawUrl);
  const host = u.hostname;
  if (u.protocol !== 'https:') {
    // fallback to global fetch for non-HTTPS
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(timeoutMs) });
    return await res.json();
  }

  // Try resolving IPv4 first
  let addresses = [];
  try {
    const r = await dnsPromises.lookup(host, { all: true, family: 4 });
    addresses = r.map((x) => x.address);
  } catch (e) {
    // ignore and fall back to system resolver
  }
  // Prefer the first IPv4 address if available; otherwise use the hostname.
  const ip = addresses.length > 0 ? addresses[0] : null;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: ip || host,
        path: u.pathname + u.search,
        method: 'GET',
        headers: { Host: host },
        servername: host,
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            resolve(parsed);
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('request timeout'));
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OSRM_BASE = process.env.OSRM_URL || 'https://router.project-osrm.org';

// Prefer IPv4 address order to avoid IPv6 resolution/connect issues in some hosts
try {
  if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // ignore if not supported
}

const app = express();
app.use(cors());

// API: get driving distance/duration matrix from OSRM
// GET /api/table?coords=lon1,lat1;lon2,lat2;lon3,lat3
// coords: person1, person2, ..., meetingPoint (last coord is destination)
app.get('/api/table', async (req, res) => {
  const { coords } = req.query;
  if (!coords || typeof coords !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid coords (lon,lat;lon,lat;...)' });
  }
  const points = coords.split(';').map(s => s.trim()).filter(Boolean);
  if (points.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 points' });
  }
  const coordsParam = points.join(';');
  const sources = Array.from({ length: points.length - 1 }, (_, i) => i).join(';');
  const destinations = String(points.length - 1);
  const url = `${OSRM_BASE}/table/v1/driving/${coordsParam}?sources=${sources}&destinations=${destinations}&annotations=duration,distance`;
  try {
    const data = await fetchPreferIPv4Json(url, 15000);
    if (data.code !== 'Ok') {
      console.error('[OSRM table]', data.code, data.message || '', 'coords:', coordsParam.slice(0, 80) + '...');
      return res.status(502).json({ error: data.message || data.code || 'OSRM error' });
    }
    res.json(data);
  } catch (err) {
    console.error('[OSRM table] fetch failed', err.stack || err, 'url:', url.slice(0, 100) + '...');
    res.status(502).json({ error: err.message || 'Routing service unavailable' });
  }
});

// API: get single route geometry (for drawing lines on map)
// GET /api/route?coords=lon1,lat1;lon2,lat2
app.get('/api/route', async (req, res) => {
  const { coords } = req.query;
  if (!coords || typeof coords !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid coords' });
  }
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const data = await fetchPreferIPv4Json(url, 15000);
    if (data.code !== 'Ok') {
      console.error('[OSRM route]', data.code, data.message || '', 'coords:', coords.slice(0, 60) + '...');
      return res.status(502).json({ error: data.message || data.code || 'OSRM error' });
    }
    res.json(data);
  } catch (err) {
    console.error('[OSRM route] fetch failed', err.stack || err, 'url:', url.slice(0, 100) + '...');
    res.status(502).json({ error: err.message || 'Routing service unavailable' });
  }
});

// Serve built frontend
const dist = join(__dirname, '..', 'dist');
app.use(express.static(dist));
app.get('*', (_, res) => res.sendFile(join(dist, 'index.html')));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
  console.log(`OSRM backend: ${OSRM_BASE}`);
});
