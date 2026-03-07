import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import { DistancePanel } from './DistancePanel';
import {
  loadSession,
  saveSession,
  loadTheme,
  saveTheme,
  loadFavourites,
  saveFavourites,
  type Theme,
  type StoredFavourite,
} from './sessionStorage';
import { getPersonColor } from './colors';
import './App.css';
import type { LatLng } from './types';

function createPersonIcon(color: string) {
  return L.divIcon({
    className: 'person-marker',
    html: `<div style="background-color:${color};width:24px;height:24px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

const meetingIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export type Person = { id: string; name: string; position: LatLng };

const TILE_URLS: Record<Theme, string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

function MapControls({
  theme,
  onToggleTheme,
  people,
  meetingPoint,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  people: Person[];
  meetingPoint: LatLng | null;
}) {
  const map = useMap();
  const goHome = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 14);
      },
      () => {}
    );
  }, [map]);
  const centerOnPoints = useCallback(() => {
    const positions: LatLng[] = [...people.map((p) => p.position)];
    if (meetingPoint) positions.push(meetingPoint);
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map(([lat, lng]) => [lat, lng] as L.LatLngTuple));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, people, meetingPoint]);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        right: '12px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'row',
        gap: '8px',
      }}
    >
      <div
        className="map-theme-control"
        onClick={goHome}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && goHome()}
        title="Center map on my location"
      >
        <span aria-hidden>⌂</span>
        <span>Home</span>
      </div>
      <div
        className="map-theme-control"
        onClick={centerOnPoints}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && centerOnPoints()}
        title="Zoom map to show all people and meeting point"
      >
        <span aria-hidden>◎</span>
        <span>Center map</span>
      </div>
      <div
        className="map-theme-control"
        onClick={onToggleTheme}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggleTheme()}
        title={theme === 'dark' ? 'Switch to light map' : 'Switch to dark map'}
      >
        <span aria-hidden>{theme === 'dark' ? '☀️' : '🌙'}</span>
        <span>{theme === 'dark' ? 'Light map' : 'Dark map'}</span>
      </div>
    </div>
  );
}

function MapClickHandler({
  onAddPerson,
  onSetMeeting,
  mode,
}: {
  onAddPerson: (lat: number, lng: number) => void;
  onSetMeeting: (lat: number, lng: number) => void;
  mode: 'person' | 'meeting' | null;
}) {
  useMapEvents({
    click(e) {
      if (!mode) return;
      const { lat, lng } = e.latlng;
      if (mode === 'person') onAddPerson(lat, lng);
      else if (mode === 'meeting') onSetMeeting(lat, lng);
    },
  });
  return null;
}

function initialSession(): { people: Person[]; meetingPoint: LatLng | null } {
  const s = loadSession();
  if (!s) return { people: [], meetingPoint: null };
  return {
    people: s.people.map((p) => ({ id: p.id, name: p.name, position: p.position })),
    meetingPoint: s.meetingPoint,
  };
}

export default function App() {
  const [people, setPeople] = useState<Person[]>(() => initialSession().people);
  const [meetingPoint, setMeetingPoint] = useState<LatLng | null>(() => initialSession().meetingPoint);
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [mode, setMode] = useState<'person' | 'meeting' | null>(null);
  const [routes, setRoutes] = useState<{ personId: string; distance: number; duration: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeGeometries, setRouteGeometries] = useState<[number, number][][]>([]);
  const [favourites, setFavourites] = useState<StoredFavourite[]>(() => loadFavourites());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveFavourites(favourites);
  }, [favourites]);

  useEffect(() => {
    saveSession({
      people: people.map((p) => ({ id: p.id, name: p.name, position: p.position })),
      meetingPoint,
    });
  }, [people, meetingPoint]);

  const addPerson = useCallback((lat: number, lng: number) => {
    const name = `Person ${people.length + 1}`;
    setPeople((p) => [...p, { id: crypto.randomUUID(), name, position: [lat, lng] }]);
    setMode(null);
  }, [people.length]);

  const setMeeting = useCallback((lat: number, lng: number) => {
    setMeetingPoint([lat, lng]);
    setMode(null);
  }, []);

  const removePerson = useCallback((id: string) => {
    setPeople((p) => p.filter((x) => x.id !== id));
    setRoutes((r) => r.filter((x) => x.personId !== id));
    setRouteGeometries([]);
  }, []);

  const updatePersonName = useCallback((id: string, name: string) => {
    setPeople((p) => p.map((x) => (x.id === id ? { ...x, name } : x)));
  }, []);

  const movePerson = useCallback((id: string, lat: number, lng: number) => {
    setPeople((p) => p.map((x) => (x.id === id ? { ...x, position: [lat, lng] } : x)));
  }, []);

  const moveMeetingPoint = useCallback((lat: number, lng: number) => {
    setMeetingPoint([lat, lng]);
  }, []);

  const routeCache = useRef<
    Map<string, { routes: { personId: string; distance: number; duration: number }[]; routeGeometries: [number, number][][] }>
  >(new Map());
  const segmentCache = useRef<Map<string, [number, number][]>>(new Map());
  const MAX_CACHE_SIZE = 30;
  const MAX_SEGMENT_CACHE = 100;

  const fetchDistances = useCallback(async () => {
    if (!meetingPoint || people.length === 0) return;
    const coordsKey = [...people.map((p) => p.position), meetingPoint]
      .map(([lat, lng]) => `${lng},${lat}`)
      .join(';');
    const cached = routeCache.current.get(coordsKey);
    if (cached) {
      setRoutes(cached.routes);
      setRouteGeometries(cached.routeGeometries);
      return;
    }
    setLoading(true);
    setRoutes([]);
    setRouteGeometries([]);
    try {
      const res = await fetch(`/api/table?coords=${encodeURIComponent(coordsKey)}`);
      if (!res.ok) throw new Error('Routing failed');
      const data = await res.json();
      const durations = data.durations as number[][];
      const distances = data.distances as number[][];
      if (!durations?.[0] || !distances?.[0]) throw new Error('Invalid response');
      const routes = people.map((p, i) => ({
        personId: p.id,
        distance: distances[i][0] / 1000,
        duration: durations[i][0],
      }));
      setRoutes(routes);
      const geoms: [number, number][][] = [];
      for (let i = 0; i < people.length; i++) {
        const coordStr = `${people[i].position[1]},${people[i].position[0]};${meetingPoint[1]},${meetingPoint[0]}`;
        const segCached = segmentCache.current.get(coordStr);
        if (segCached) {
          geoms.push(segCached);
        } else {
          const r = await fetch(`/api/route?coords=${encodeURIComponent(coordStr)}`);
          if (r.ok) {
            const routeData = await r.json();
            const coords = routeData.routes?.[0]?.geometry?.coordinates;
            const geom = coords ? (coords.map((c: number[]) => [c[1], c[0]]) as [number, number][]) : [];
            geoms.push(geom);
            if (segmentCache.current.size >= MAX_SEGMENT_CACHE) {
              const firstKey = segmentCache.current.keys().next().value;
              if (firstKey !== undefined) segmentCache.current.delete(firstKey);
            }
            segmentCache.current.set(coordStr, geom);
          } else {
            geoms.push([]);
          }
        }
      }
      setRouteGeometries(geoms);
      if (routeCache.current.size >= MAX_CACHE_SIZE) {
        const firstKey = routeCache.current.keys().next().value;
        if (firstKey !== undefined) routeCache.current.delete(firstKey);
      }
      routeCache.current.set(coordsKey, { routes, routeGeometries: geoms });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [meetingPoint, people]);

  // Auto-recalculate when people or meeting point change (add, move, or meeting move)
  useEffect(() => {
    if (people.length > 0 && meetingPoint) {
      fetchDistances();
    }
  }, [people, meetingPoint, fetchDistances]);

  const clearMeeting = useCallback(() => {
    setMeetingPoint(null);
    setRoutes([]);
    setRouteGeometries([]);
  }, []);

  const clearAllPeople = useCallback(() => {
    setPeople([]);
    setRoutes([]);
    setRouteGeometries([]);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const addFavourite = useCallback(
    (name: string) => {
      if (!meetingPoint || favourites.length >= 9) return;
      setFavourites((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name, position: [...meetingPoint] },
      ]);
    },
    [meetingPoint, favourites.length]
  );

  const removeFavourite = useCallback((id: string) => {
    setFavourites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const setMeetingFromFavourite = useCallback((position: LatLng) => {
    setMeetingPoint([...position]);
  }, []);

  const hasMeeting = meetingPoint !== null;
  const canCalculate = hasMeeting && people.length > 0;
  const tileUrl = TILE_URLS[theme];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          padding: '12px 20px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
          Meeting Point Distance Calculator
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="mode-btn"
            data-active={mode === 'person'}
            onClick={() => setMode(mode === 'person' ? null : 'person')}
          >
            Add person
          </button>
          <button
            type="button"
            className="mode-btn"
            data-active={mode === 'meeting'}
            onClick={() => setMode(mode === 'meeting' ? null : 'meeting')}
          >
            Set meeting point
          </button>
          {canCalculate && (
            <button
              type="button"
              className="mode-btn primary"
              onClick={fetchDistances}
              disabled={loading}
            >
              {loading ? 'Calculating…' : 'Calculate distances'}
            </button>
          )}
          {hasMeeting && (
            <button type="button" className="mode-btn" onClick={clearMeeting}>
              Clear meeting point
            </button>
          )}
          {people.length > 0 && (
            <button type="button" className="mode-btn" onClick={clearAllPeople}>
              Clear all people
            </button>
          )}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            center={[51.505, -0.09]}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url={tileUrl}
            />
            <MapControls
              theme={theme}
              onToggleTheme={toggleTheme}
              people={people}
              meetingPoint={meetingPoint}
            />
            <MapClickHandler onAddPerson={addPerson} onSetMeeting={setMeeting} mode={mode} />
            {people.map((p) => (
              <Marker
                key={p.id}
                position={p.position}
                icon={createPersonIcon(getPersonColor(people, p.id))}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const pos = e.target.getLatLng();
                    movePerson(p.id, pos.lat, pos.lng);
                  },
                }}
              >
                <Popup>
                  <strong>{p.name}</strong>
                  <br />
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Drag to move</span>
                  <br />
                  <button type="button" onClick={() => removePerson(p.id)}>
                    Remove
                  </button>
                </Popup>
              </Marker>
            ))}
            {meetingPoint && (
              <Marker
                position={meetingPoint}
                icon={meetingIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const pos = e.target.getLatLng();
                    moveMeetingPoint(pos.lat, pos.lng);
                  },
                }}
              >
                <Popup>
                  Meeting point
                  <br />
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Drag to move</span>
                </Popup>
              </Marker>
            )}
            {routeGeometries.map(
              (geom, i) =>
                geom.length > 1 &&
                people[i] && (
                  <Polyline
                    key={people[i].id}
                    positions={geom}
                    color={getPersonColor(people, people[i].id)}
                    weight={3}
                    opacity={0.8}
                  />
                )
            )}
          </MapContainer>
        </div>
        <DistancePanel
          people={people}
          routes={routes}
          meetingPoint={meetingPoint}
          favourites={favourites}
          onRemovePerson={removePerson}
          onUpdateName={updatePersonName}
          onAddFavourite={addFavourite}
          onRemoveFavourite={removeFavourite}
          onSetMeetingFromFavourite={setMeetingFromFavourite}
        />
      </div>
    </div>
  );
}
