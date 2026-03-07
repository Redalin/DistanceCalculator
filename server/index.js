import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OSRM_BASE = process.env.OSRM_URL || 'https://router.project-osrm.org';

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
    const r = await fetch(url);
    const data = await r.json();
    if (data.code !== 'Ok') {
      return res.status(502).json({ error: data.message || 'OSRM error' });
    }
    res.json(data);
  } catch (err) {
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
    const r = await fetch(url);
    const data = await r.json();
    if (data.code !== 'Ok') {
      return res.status(502).json({ error: data.message || 'OSRM error' });
    }
    res.json(data);
  } catch (err) {
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
});
