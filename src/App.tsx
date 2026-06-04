import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap, Marker, Polyline, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { DistancePanel } from './DistancePanel';
import { DistanceSummary } from './DistanceSummary';
import {
  loadSession,
  saveSession,
  loadTheme,
  saveTheme,
  loadFavourites,
  saveFavourites,
  loadProfiles,
  saveProfiles,
  loadActiveProfileId,
  saveActiveProfileId,
  type Theme,
  type StoredFavourite,
  type StoredProfile,
} from './sessionStorage';
import { getPersonColor } from './colors';
import './App.css';
import type { CarpoolLeg, CarpoolPool, LatLng, RouteEntry, RouteGeometry } from './types';

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

export type Person = { id: string; name: string; position: LatLng; carpool?: boolean; carpoolId?: string };

const MAX_CARPOOL_SIZE = 4;

function personToStoredPerson(p: Person) {
  return { id: p.id, name: p.name, position: p.position, carpool: p.carpool, carpoolId: p.carpoolId };
}

function restorePerson(p: Person): Person {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    carpool: p.carpool,
    carpoolId: p.carpoolId ?? (p.carpool ? 'legacy-carpool' : undefined),
  };
}

const TILE_URLS: Record<Theme, string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

function MapControls({
  theme,
  onToggleTheme,
  people,
  meetingPoint,
  showPanel,
  onTogglePanel,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  people: Person[];
  meetingPoint: LatLng | null;
  showPanel: boolean;
  onTogglePanel: () => void;
}) {
  const map = useMap();
  const goHome = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView(L.latLng(latitude, longitude), 14);
      },
      () => { }
    );
  }, [map]);
  const centerOnPoints = useCallback(() => {
    const positions: LatLng[] = [...people.map((p) => p.position)];
    if (meetingPoint) positions.push(meetingPoint);
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, people, meetingPoint]);
  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'row',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      {!showPanel && (
        <div
          className="map-theme-control"
          onClick={onTogglePanel}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTogglePanel()}
          title="Show panel"
        >
          ☰
        </div>
      )}
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
        <span>Center</span>
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
        <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
      </div>
    </div>
  );
}

function MapResizer({ showPanel }: { showPanel: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    return () => clearTimeout(timeout);
  }, [showPanel, map]);
  return null;
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

type AddressSearchTarget = { personId: string | null; mode: 'add' | 'move' | 'meeting' };

type SearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

function AddressSearchModal({
  open,
  target,
  query,
  results,
  loading,
  error,
  onQueryChange,
  onSearch,
  onSelect,
  onClose,
}: {
  open: boolean;
  target: AddressSearchTarget | null;
  query: string;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (result: SearchResult) => void;
  onClose: () => void;
}) {
  if (!open || !target) return null;

  const title =
    target.mode === 'add'
      ? 'Add person by address'
      : target.mode === 'meeting'
      ? 'Set meeting point by address'
      : 'Move person by address';

  return (
    <div className="address-search-modal-backdrop" onClick={onClose}>
      <div className="address-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="address-search-modal-header">
          <h2>{title}</h2>
          <button type="button" className="mode-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="address-search-modal-body">
          <form
            className="address-search-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch();
            }}
          >
            <input
              type="search"
              value={query}
              placeholder="Search for an address..."
              onChange={(e) => onQueryChange(e.target.value)}
            />
            <button type="submit" className="mode-btn primary" disabled={!query.trim()}>
              Search
            </button>
          </form>
          {loading && <p>Searching for addresses…</p>}
          {error && <p className="address-search-error">{error}</p>}
          {results.length > 0 && (
            <ul className="address-search-results">
              {results.map((result) => (
                <li key={result.place_id}>
                  <button
                    type="button"
                    className="address-search-item"
                    onClick={() => onSelect(result)}
                  >
                    <strong>{result.display_name}</strong>
                    <span>
                      {result.lat}, {result.lon}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && !error && results.length === 0 && query.trim() && (
            <p style={{ color: 'var(--muted)' }}>
              No results found. Try a different address.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function initialSession(): { people: Person[]; meetingPoint: LatLng | null } {
  const s = loadSession();
  if (!s) return { people: [], meetingPoint: null };
  return {
    people: s.people.map(restorePerson),
    meetingPoint: s.meetingPoint,
  };
}

function initialProfiles(): { profiles: StoredProfile[]; activeProfileId: string } {
  const storedProfiles = loadProfiles();
  const storedActiveId = loadActiveProfileId();
  if (storedProfiles.length > 0) {
    const profiles = storedProfiles.map((profile) => ({
      ...profile,
      people: profile.people.map(restorePerson),
    }));
    const activeId = storedActiveId && storedProfiles.some((profile) => profile.id === storedActiveId)
      ? storedActiveId
      : profiles[0].id;
    return { profiles, activeProfileId: activeId };
  }

  const session = initialSession();
  const defaultProfile: StoredProfile = {
    id: crypto.randomUUID(),
    name: 'Default view',
    people: session.people,
    meetingPoint: session.meetingPoint,
  };
  return { profiles: [defaultProfile], activeProfileId: defaultProfile.id };
}

export default function App() {
  const [{ profiles: initialProfilesState, activeProfileId: initialActiveProfileId }] = useState(() => initialProfiles());
  const [profiles, setProfiles] = useState<StoredProfile[]>(initialProfilesState);
  const [activeProfileId, setActiveProfileId] = useState<string>(initialActiveProfileId);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const people = activeProfile.people;
  const meetingPoint = activeProfile.meetingPoint;
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [mode, setMode] = useState<'person' | 'meeting' | null>(null);
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeGeometries, setRouteGeometries] = useState<RouteGeometry[]>([]);
  const [favourites, setFavourites] = useState<StoredFavourite[]>(() => loadFavourites());
  const [showPanel, setShowPanel] = useState(true);
  const [addressSearchTarget, setAddressSearchTarget] = useState<AddressSearchTarget | null>(null);
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [addressSearchResults, setAddressSearchResults] = useState<SearchResult[]>([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [carpoolPools, setCarpoolPools] = useState<CarpoolPool[]>([]);
  const [carpoolLegs, setCarpoolLegs] = useState<CarpoolLeg[]>([]);
  const [carpoolPassengerGeometries, setCarpoolPassengerGeometries] = useState<Record<string, RouteGeometry>>({});
  const [carpoolDriverGeometries, setCarpoolDriverGeometries] = useState<Record<string, RouteGeometry>>({});

  const clearCarpoolState = useCallback(() => {
    setCarpoolPools([]);
    setCarpoolLegs([]);
    setCarpoolPassengerGeometries({});
    setCarpoolDriverGeometries({});
  }, []);

  const clearCalculatedRoutes = useCallback(() => {
    setRoutes([]);
    setRouteGeometries([]);
    clearCarpoolState();
  }, [clearCarpoolState]);

  const saveActiveProfile = useCallback(
    (updater: (profile: StoredProfile) => StoredProfile) => {
      setProfiles((prev) =>
        prev.map((profile) =>
          profile.id === activeProfileId ? updater(profile) : profile
        )
      );
    },
    [activeProfileId]
  );

  const toggleCarpool = useCallback(
    (id: string) => {
      saveActiveProfile((profile) => ({
        ...profile,
        people: profile.people.map((p) => {
          if (p.id !== id) return p;
          if (p.carpoolId) return { ...p, carpool: false, carpoolId: undefined };
          return { ...p, carpool: true, carpoolId: crypto.randomUUID() };
        }),
      }));
    },
    [saveActiveProfile]
  );

  const movePersonToCarpool = useCallback(
    (personId: string, targetPersonId: string) => {
      if (personId === targetPersonId) return;
      saveActiveProfile((profile) => {
        const source = profile.people.find((p) => p.id === personId);
        const target = profile.people.find((p) => p.id === targetPersonId);
        if (!source || !target) return profile;

        const targetPoolId = target.carpoolId ?? crypto.randomUUID();
        const targetPoolSize = target.carpoolId
          ? profile.people.filter((p) => p.carpoolId === target.carpoolId).length
          : 1;
        const sourceAlreadyInTargetPool = Boolean(target.carpoolId && source.carpoolId === target.carpoolId);
        if (!sourceAlreadyInTargetPool && targetPoolSize >= MAX_CARPOOL_SIZE) {
          window.alert(`Carpools can have a maximum of ${MAX_CARPOOL_SIZE} people.`);
          return profile;
        }

        return {
          ...profile,
          people: profile.people.map((p) => {
            if (p.id === personId || p.id === targetPersonId) return { ...p, carpool: true, carpoolId: targetPoolId };
            return p;
          }),
        };
      });
    },
    [saveActiveProfile]
  );

  useEffect(() => {
    const handleClickOutside = () => setShowProfileMenu(false);
    if (showProfileMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showProfileMenu]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveFavourites(favourites);
  }, [favourites]);

  useEffect(() => {
    saveProfiles(profiles);
    saveActiveProfileId(activeProfileId);
    saveSession({
      people: activeProfile.people.map(personToStoredPerson),
      meetingPoint: activeProfile.meetingPoint,
    });
  }, [profiles, activeProfileId, activeProfile]);

  const addPerson = useCallback(
    (lat: number, lng: number) => {
      saveActiveProfile((profile) => ({
        ...profile,
        people: [
          ...profile.people,
          { id: crypto.randomUUID(), name: `Person ${profile.people.length + 1}`, position: [lat, lng] },
        ],
      }));
      setMode(null);
    },
    [saveActiveProfile]
  );

  const setMeeting = useCallback(
    (lat: number, lng: number) => {
      saveActiveProfile((profile) => ({ ...profile, meetingPoint: [lat, lng] }));
      setMode(null);
    },
    [saveActiveProfile]
  );

  const removePerson = useCallback(
    (id: string) => {
      saveActiveProfile((profile) => ({
        ...profile,
        people: profile.people.filter((x) => x.id !== id),
      }));
      clearCalculatedRoutes();
    },
    [saveActiveProfile, clearCalculatedRoutes]
  );

  const updatePersonName = useCallback(
    (id: string, name: string) => {
      saveActiveProfile((profile) => ({
        ...profile,
        people: profile.people.map((x) => (x.id === id ? { ...x, name } : x)),
      }));
    },
    [saveActiveProfile]
  );

  const movePerson = useCallback(
    (id: string, lat: number, lng: number) => {
      saveActiveProfile((profile) => ({
        ...profile,
        people: profile.people.map((x) => (x.id === id ? { ...x, position: [lat, lng] } : x)),
      }));
    },
    [saveActiveProfile]
  );

  const moveMeetingPoint = useCallback(
    (lat: number, lng: number) => {
      saveActiveProfile((profile) => ({ ...profile, meetingPoint: [lat, lng] }));
    },
    [saveActiveProfile]
  );

  const openAddressSearchForNewPerson = useCallback(() => {
    setMode('person');
    setAddressSearchTarget({ personId: null, mode: 'add' });
    setAddressSearchQuery('');
    setAddressSearchResults([]);
    setAddressSearchError(null);
  }, []);

  const openAddressSearchForPerson = useCallback((id: string) => {
    setAddressSearchTarget({ personId: id, mode: 'move' });
    setAddressSearchQuery('');
    setAddressSearchResults([]);
    setAddressSearchError(null);
  }, []);

  const openAddressSearchForMeeting = useCallback(() => {
    setMode('meeting');
    setAddressSearchTarget({ personId: null, mode: 'meeting' });
    setAddressSearchQuery('');
    setAddressSearchResults([]);
    setAddressSearchError(null);
  }, []);

  const closeAddressSearch = useCallback(() => {
    setAddressSearchTarget(null);
    setAddressSearchQuery('');
    setAddressSearchResults([]);
    setAddressSearchError(null);
  }, []);

  const performAddressSearch = useCallback(async () => {
    const query = addressSearchQuery.trim();
    if (!query) return;
    setAddressSearchLoading(true);
    setAddressSearchError(null);
    setAddressSearchResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error('Search failed');
      const data = (await res.json()) as SearchResult[];
      setAddressSearchResults(data || []);
    } catch (err) {
      console.error(err);
      setAddressSearchError('Unable to search addresses. Please try again.');
    } finally {
      setAddressSearchLoading(false);
    }
  }, [addressSearchQuery]);

  const handleAddressSelect = useCallback(
    (result: SearchResult) => {
      const lat = Number(result.lat);
      const lng = Number(result.lon);
      if (addressSearchTarget?.mode === 'add') {
        addPerson(lat, lng);
      } else if (addressSearchTarget?.mode === 'meeting') {
        setMeeting(lat, lng);
      } else if (addressSearchTarget?.personId) {
        movePerson(addressSearchTarget.personId, lat, lng);
      }
      closeAddressSearch();
    },
    [addressSearchTarget, addPerson, setMeeting, movePerson, closeAddressSearch]
  );

  const routeCache = useRef<
    Map<string, { routes: RouteEntry[]; routeGeometries: RouteGeometry[] }>
  >(new Map());
  const segmentCache = useRef<Map<string, RouteGeometry>>(new Map());
  const MAX_CACHE_SIZE = 30;
  const MAX_SEGMENT_CACHE = 100;

  const fetchDistances = useCallback(async () => {
    if (!meetingPoint || people.length === 0) return;
    const coordsKey = [...people.map((p) => p.position), meetingPoint]
      .map(([lat, lng]) => `${lng},${lat}`)
      .join(';');
    const cached = routeCache.current.get(coordsKey);
    
    let currentRoutes: RouteEntry[];
    let currentGeometries: RouteGeometry[];
    
    setLoading(true);
    try {
      if (cached) {
        currentRoutes = cached.routes;
        currentGeometries = cached.routeGeometries;
        setRoutes(currentRoutes);
        setRouteGeometries(currentGeometries);
      } else {
        setRoutes([]);
        setRouteGeometries([]);
        const res = await fetch(`/api/table?coords=${encodeURIComponent(coordsKey)}`);
        if (!res.ok) throw new Error('Routing failed');
        const data = await res.json();
        const durations = data.durations as number[][];
        const distances = data.distances as number[][];
        if (!durations?.[0] || !distances?.[0]) throw new Error('Invalid response');
        currentRoutes = people.map((p, i) => ({
          personId: p.id,
          distance: distances[i][0] / 1000,
          duration: durations[i][0],
        }));
        setRoutes(currentRoutes);
        const geoms: RouteGeometry[] = [];
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
              const geom = coords ? (coords.map((c: number[]) => [c[1], c[0]]) as RouteGeometry) : [];
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
        currentGeometries = geoms;
        setRouteGeometries(currentGeometries);
        if (routeCache.current.size >= MAX_CACHE_SIZE) {
          const firstKey = routeCache.current.keys().next().value;
          if (firstKey !== undefined) routeCache.current.delete(firstKey);
        }
        routeCache.current.set(coordsKey, { routes: currentRoutes, routeGeometries: currentGeometries });
      }

      const carpoolGroups = people.reduce<Record<string, Person[]>>((groups, person) => {
        if (!person.carpoolId) return groups;
        groups[person.carpoolId] = [...(groups[person.carpoolId] ?? []), person];
        return groups;
      }, {});
      const activeCarpoolGroups = Object.entries(carpoolGroups).filter(([, members]) => members.length >= 2);

      if (activeCarpoolGroups.length > 0) {
        const pools: CarpoolPool[] = [];
        const legs: CarpoolLeg[] = [];
        const passengerGeometries: Record<string, RouteGeometry> = {};
        const driverGeometries: Record<string, RouteGeometry> = {};

        for (const [poolId, carpoolers] of activeCarpoolGroups) {
          const carpoolCoordsKey = carpoolers
          .map((p) => p.position)
          .map(([lat, lng]) => `${lng},${lat}`)
          .join(';');
        
        const carpoolRes = await fetch(`/api/table?all=true&coords=${encodeURIComponent(carpoolCoordsKey)}`);
        if (!carpoolRes.ok) throw new Error('Carpool matrix routing failed');
        const carpoolData = await carpoolRes.json();
        const carpoolDistances = carpoolData.distances as number[][];
        const carpoolDurations = carpoolData.durations as number[][];
        
        if (carpoolDistances && carpoolDurations) {
          // Find the best host index (minimizes total driving distance)
          let bestHostIndex = 0;
          let minTotalDist = Infinity;
          
          for (let h = 0; h < carpoolers.length; h++) {
            const hostId = carpoolers[h].id;
            const hostSoloRoute = currentRoutes.find((r) => r.personId === hostId);
            const hostSoloDist = hostSoloRoute ? hostSoloRoute.distance : 0;
            
            let currentHostTotal = hostSoloDist;
            for (let c = 0; c < carpoolers.length; c++) {
              if (c === h) continue;
              const passenger = carpoolers[c];
              const passengerSoloRoute = currentRoutes.find((r) => r.personId === passenger.id);
              const passengerSoloDist = passengerSoloRoute ? passengerSoloRoute.distance : 0;
              const passengerToHost = carpoolDistances[c][h] / 1000;
              const hostToPassenger = carpoolDistances[h][c] / 1000;
              const driverPickupExtra = hostToPassenger + passengerSoloDist - hostSoloDist;
              currentHostTotal += Math.min(passengerToHost, driverPickupExtra);
            }
            
            if (currentHostTotal < minTotalDist) {
              minTotalDist = currentHostTotal;
              bestHostIndex = h;
            }
          }
          
          const bestHost = carpoolers[bestHostIndex];
          pools.push({ id: poolId, hostId: bestHost.id, memberIds: carpoolers.map((p) => p.id) });
          const driverPickupIndexes: number[] = [];
          
          // Construct driving legs for passengers
          for (let c = 0; c < carpoolers.length; c++) {
            if (c === bestHostIndex) continue;
            const passenger = carpoolers[c];
            const passengerSoloRoute = currentRoutes.find((r) => r.personId === passenger.id);
            const bestHostSoloRoute = currentRoutes.find((r) => r.personId === bestHost.id);
            const passengerSoloDist = passengerSoloRoute ? passengerSoloRoute.distance : 0;
            const passengerToHost = carpoolDistances[c][bestHostIndex] / 1000;
            const passengerToHostDuration = carpoolDurations[c][bestHostIndex];
            const hostToPassenger = carpoolDistances[bestHostIndex][c] / 1000;
            const hostToPassengerDuration = carpoolDurations[bestHostIndex][c];
            const hostSoloDist = bestHostSoloRoute ? bestHostSoloRoute.distance : 0;
            const driverPickupExtra = hostToPassenger + passengerSoloDist - hostSoloDist;
            const driverPicksUp = driverPickupExtra < passengerToHost;
            const legDistance = driverPicksUp ? driverPickupExtra : passengerToHost;
            const legDuration = driverPicksUp ? hostToPassengerDuration : passengerToHostDuration;
            if (driverPicksUp) driverPickupIndexes.push(c);
            
            legs.push({
              poolId,
              hostId: bestHost.id,
              passengerId: passenger.id,
              distance: legDistance,
              duration: legDuration,
              pickupMode: driverPicksUp ? 'driver-picks-up' : 'passenger-meets-driver',
              passengerDriveDistance: driverPicksUp ? 0 : passengerToHost,
              driverDetourDistance: driverPicksUp ? driverPickupExtra : 0,
              pickupDistance: driverPicksUp ? hostToPassenger : passengerToHost,
            });
            
            // Fetch passenger-to-host route geometry for passengers who meet the driver.
            if (!driverPicksUp) {
              const segmentKey = `${passenger.position[1]},${passenger.position[0]};${bestHost.position[1]},${bestHost.position[0]}`;
              const segCached = segmentCache.current.get(segmentKey);
              if (segCached) {
                passengerGeometries[passenger.id] = segCached;
              } else {
                const r = await fetch(`/api/route?coords=${encodeURIComponent(segmentKey)}`);
                if (r.ok) {
                  const routeData = await r.json();
                  const coords = routeData.routes?.[0]?.geometry?.coordinates;
                  const geom = coords ? (coords.map((c: number[]) => [c[1], c[0]]) as RouteGeometry) : [];
                  passengerGeometries[passenger.id] = geom;
                  if (segmentCache.current.size >= MAX_SEGMENT_CACHE) {
                    const firstKey = segmentCache.current.keys().next().value;
                    if (firstKey !== undefined) segmentCache.current.delete(firstKey);
                  }
                  segmentCache.current.set(segmentKey, geom);
                } else {
                  passengerGeometries[passenger.id] = [];
                }
              }
            }
          }

          if (driverPickupIndexes.length > 0 && meetingPoint) {
            const routeDistanceForOrder = (order: number[]) => {
              let total = 0;
              let previousIndex = bestHostIndex;
              for (const pickupIndex of order) {
                total += carpoolDistances[previousIndex][pickupIndex] / 1000;
                previousIndex = pickupIndex;
              }
              const lastPassengerRoute = currentRoutes.find((r) => r.personId === carpoolers[previousIndex].id);
              total += lastPassengerRoute ? lastPassengerRoute.distance : 0;
              return total;
            };

            let bestPickupOrder = driverPickupIndexes;
            let bestPickupDistance = routeDistanceForOrder(driverPickupIndexes);
            const permutePickupOrder = (remaining: number[], order: number[]) => {
              if (remaining.length === 0) {
                const distance = routeDistanceForOrder(order);
                if (distance < bestPickupDistance) {
                  bestPickupDistance = distance;
                  bestPickupOrder = order;
                }
                return;
              }
              remaining.forEach((pickupIndex, index) => {
                permutePickupOrder(
                  remaining.filter((_, remainingIndex) => remainingIndex !== index),
                  [...order, pickupIndex]
                );
              });
            };
            permutePickupOrder(driverPickupIndexes, []);

            const driverRoutePoints = [
              bestHost.position,
              ...bestPickupOrder.map((pickupIndex) => carpoolers[pickupIndex].position),
              meetingPoint,
            ];
            const driverRouteKey = driverRoutePoints
              .map(([lat, lng]) => `${lng},${lat}`)
              .join(';');
            const cachedDriverRoute = segmentCache.current.get(driverRouteKey);
            if (cachedDriverRoute) {
              driverGeometries[poolId] = cachedDriverRoute;
            } else {
              const r = await fetch(`/api/route?coords=${encodeURIComponent(driverRouteKey)}`);
              if (r.ok) {
                const routeData = await r.json();
                const coords = routeData.routes?.[0]?.geometry?.coordinates;
                const geom = coords ? (coords.map((c: number[]) => [c[1], c[0]]) as RouteGeometry) : [];
                driverGeometries[poolId] = geom;
                if (segmentCache.current.size >= MAX_SEGMENT_CACHE) {
                  const firstKey = segmentCache.current.keys().next().value;
                  if (firstKey !== undefined) segmentCache.current.delete(firstKey);
                }
                segmentCache.current.set(driverRouteKey, geom);
              }
            }
          }
          
        } else {
          clearCarpoolState();
          return;
        }
        }
        setCarpoolPools(pools);
        setCarpoolLegs(legs);
        setCarpoolPassengerGeometries(passengerGeometries);
        setCarpoolDriverGeometries(driverGeometries);
      } else {
        clearCarpoolState();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [meetingPoint, people, clearCarpoolState]);

  // Auto-recalculate when people or meeting point change (add, move, or meeting move)
  useEffect(() => {
    if (people.length > 0 && meetingPoint) {
      fetchDistances();
    }
  }, [people, meetingPoint, fetchDistances]);

  const clearMeeting = useCallback(() => {
    saveActiveProfile((profile) => ({ ...profile, meetingPoint: null }));
    clearCalculatedRoutes();
  }, [saveActiveProfile, clearCalculatedRoutes]);

  const clearAllPeople = useCallback(() => {
    saveActiveProfile((profile) => ({ ...profile, people: [] }));
    clearCalculatedRoutes();
  }, [saveActiveProfile, clearCalculatedRoutes]);

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

  const createNewProfile = useCallback(() => {
    const name = window.prompt('New profile name', `View ${profiles.length + 1}`)?.trim();
    if (!name) return;
    const profile: StoredProfile = {
      id: crypto.randomUUID(),
      name,
      people: [],
      meetingPoint: null,
    };
    setProfiles((prev) => [...prev, profile]);
    setActiveProfileId(profile.id);
    clearCalculatedRoutes();
  }, [profiles.length, clearCalculatedRoutes]);

  const cloneProfile = useCallback(() => {
    const name = window.prompt('Clone profile name', `${activeProfile.name} copy`)?.trim();
    if (!name) return;
    const profile: StoredProfile = {
      id: crypto.randomUUID(),
      name,
      people: activeProfile.people.map((person) => ({ ...person })),
      meetingPoint: activeProfile.meetingPoint ? [...activeProfile.meetingPoint] : null,
    };
    setProfiles((prev) => [...prev, profile]);
    setActiveProfileId(profile.id);
    clearCalculatedRoutes();
  }, [activeProfile, clearCalculatedRoutes]);

  const renameProfile = useCallback(() => {
    const name = window.prompt('Rename profile', activeProfile.name)?.trim();
    if (!name || name === activeProfile.name) return;
    setProfiles((prev) =>
      prev.map((profile) =>
        profile.id === activeProfileId ? { ...profile, name } : profile
      )
    );
  }, [activeProfile.name, activeProfileId]);

  const deleteProfile = useCallback(() => {
     if (profiles.length <= 1) return;
     if (!window.confirm(`Delete profile “${activeProfile.name}”?`)) return;
     setProfiles((prev) => prev.filter((profile) => profile.id !== activeProfileId));
     clearCalculatedRoutes();
     const remaining = profiles.filter((profile) => profile.id !== activeProfileId);
     setActiveProfileId(remaining[0].id);
   }, [activeProfile.name, activeProfileId, profiles, clearCalculatedRoutes]);
 
   const switchProfile = useCallback((id: string) => {
     setActiveProfileId(id);
     clearCalculatedRoutes();
   }, [clearCalculatedRoutes]);

  const removeFavourite = useCallback((id: string) => {
    setFavourites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const setMeetingFromFavourite = useCallback((position: LatLng) => {
    saveActiveProfile((profile) => ({ ...profile, meetingPoint: [...position] }));
  }, [saveActiveProfile]);

  const hasMeeting = meetingPoint !== null;
  const tileUrl = TILE_URLS[theme];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        className="app-header"
        style={{
          padding: '12px 20px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div className="app-header-left" style={{ display: 'flex', flex: 1, minWidth: 0, gap: '14px', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, minWidth: 0 }}>
            Meeting Point Distance Calculator
          </h1>
          <div className="app-header-actions" style={{ display: 'flex', flex: 1, minWidth: 0, gap: '10px', alignItems: 'center' }}>
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
          <div className="profile-controls">
            <label htmlFor="profile-select"></label>
            <select
              id="profile-select"
              value={activeProfileId}
              onChange={(e) => switchProfile(e.target.value)}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
            <div className="profile-menu-container">
              <button
                type="button"
                className="mode-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProfileMenu(!showProfileMenu);
                }}
              >
                More ▼
              </button>
              {showProfileMenu && (
                <div className="profile-menu">
                  <button type="button" className="profile-menu-item" onClick={createNewProfile}>
                    New view
                  </button>                  <button type="button" className="profile-menu-item" onClick={cloneProfile}>
                    Duplicate Current View
                  </button>
                  <button type="button" className="profile-menu-item" onClick={renameProfile}>
                    Rename view
                  </button>
                  {profiles.length > 1 && (
                    <button type="button" className="profile-menu-item" onClick={deleteProfile}>
                      Delete view
                    </button>
                  )}
                  {hasMeeting && (
                    <button type="button" className="profile-menu-item" onClick={clearMeeting}>
                      Clear meeting point
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {mode === 'person' && (
        <div className="address-search-note">
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            Click on the map to place a person, or search for an address.
          </p>
          <button type="button" className="mode-btn" onClick={openAddressSearchForNewPerson}>
            Search address
          </button>
        </div>
      )}
      {mode === 'meeting' && (
        <div className="address-search-note">
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            Click on the map to place the meeting point, or search for an address.
          </p>
          <button type="button" className="mode-btn" onClick={openAddressSearchForMeeting}>
            Search address
          </button>
        </div>
      )}

      <AddressSearchModal
        open={Boolean(addressSearchTarget)}
        target={addressSearchTarget}
        query={addressSearchQuery}
        results={addressSearchResults}
        loading={addressSearchLoading}
        error={addressSearchError}
        onQueryChange={setAddressSearchQuery}
        onSearch={performAddressSearch}
        onSelect={handleAddressSelect}
        onClose={closeAddressSearch}
      />

      <div className={`main-content ${showPanel ? '' : 'panel-hidden'}`}>
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
          onClearAllPeople={clearAllPeople}
          showPanel={showPanel}
          onTogglePanel={() => setShowPanel((s) => !s)}
          onToggleCarpool={toggleCarpool}
          onMovePersonToCarpool={movePersonToCarpool}
          carpoolPools={carpoolPools}
          carpoolLegs={carpoolLegs}
        />
        <div className="map-wrapper">
          <MapContainer
            center={[-40.9006, 174.8860]}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url={tileUrl}
            />
            <ZoomControl position="bottomright" />
            <MapControls
              theme={theme}
              onToggleTheme={toggleTheme}
              people={people}
              meetingPoint={meetingPoint}
              showPanel={showPanel}
              onTogglePanel={() => setShowPanel((s) => !s)}
            />
            <MapResizer showPanel={showPanel} />
            <DistanceSummary routes={routes} meetingPoint={meetingPoint} />
            <MapClickHandler onAddPerson={addPerson} onSetMeeting={setMeeting} mode={mode} />
            {people.map((p) => {
              const route = routes.find((r) => r.personId === p.id);
              const carpoolPool = p.carpoolId ? carpoolPools.find((pool) => pool.id === p.carpoolId) : null;
              const isCarpool = Boolean(carpoolPool);
              const isHost = isCarpool && p.id === carpoolPool?.hostId;
              const isPassenger = isCarpool && p.id !== carpoolPool?.hostId;
              const passengerLeg = isPassenger
                ? carpoolLegs.find((leg) => leg.poolId === carpoolPool?.id && leg.passengerId === p.id)
                : null;
              
              return (
                <Marker
                  key={p.id}
                  position={L.latLng(p.position[0], p.position[1])}
                  icon={createPersonIcon(getPersonColor(people, p.id))}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const pos = e.target.getLatLng().wrap();
                      movePerson(p.id, pos.lat, pos.lng);
                    },
                  }}
                >
                  <Popup>
                    <strong>{p.name}</strong>
                    {isHost && <span style={{ color: 'var(--green)', fontSize: '0.8rem', display: 'block', fontWeight: 600 }}>🚗 Carpool Driver / Host</span>}
                    {isPassenger && <span style={{ color: 'var(--accent)', fontSize: '0.8rem', display: 'block', fontWeight: 600 }}>👥 Carpool Passenger</span>}
                    
                    {route && !isPassenger && (
                      <>
                        <br />
                        Distance: {route.distance.toFixed(1)} km
                      </>
                    )}
                    {isPassenger && passengerLeg && (
                      <>
                        <br />
                        {passengerLeg.pickupMode === 'driver-picks-up'
                          ? `Driver picks up: ${passengerLeg.pickupDistance.toFixed(1)} km pickup leg`
                          : `Drives to host: ${passengerLeg.passengerDriveDistance.toFixed(1)} km`}
                        <br />
                        Rides to meeting: {route ? route.distance.toFixed(1) : 0} km
                      </>
                    )}
                    <br />
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Drag to move</span>
                    <br />
                    <button type="button" onClick={() => openAddressSearchForPerson(p.id)}>
                      Search address
                    </button>
                    <br />
                    <button type="button" onClick={() => removePerson(p.id)}>
                      Remove
                    </button>
                  </Popup>
                </Marker>
              );
            })}
            {meetingPoint && (
              <Marker
                position={L.latLng(meetingPoint[0], meetingPoint[1])}
                icon={meetingIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const pos = e.target.getLatLng().wrap();
                    moveMeetingPoint(pos.lat, pos.lng);
                  },
                }}
              >
                <Popup>
                  Meeting point
                  <br />
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Drag to move</span>
                  <br />
                  <button type="button" onClick={openAddressSearchForMeeting}>
                    Search address
                  </button>
                </Popup>
              </Marker>
            )}
            {routeGeometries.map((geom, i) => {
              const person = people[i];
              if (!geom || geom.length <= 1 || !person) return null;

              if (person.carpoolId) {
                const pool = carpoolPools.find((carpoolPool) => carpoolPool.id === person.carpoolId);
                if (pool) {
                  if (person.id === pool.hostId) {
                    const driverGeom = carpoolDriverGeometries[pool.id];
                    const displayGeom = driverGeom && driverGeom.length > 1 ? driverGeom : geom;
                    return (
                      <Polyline
                        key={person.id}
                        positions={displayGeom}
                        color={getPersonColor(people, person.id)}
                        weight={6}
                        opacity={0.9}
                      />
                    );
                  }
                  const passengerLeg = carpoolLegs.find((leg) => leg.poolId === pool.id && leg.passengerId === person.id);
                  if (passengerLeg?.pickupMode === 'driver-picks-up') return null;
                  const passengerGeom = carpoolPassengerGeometries[person.id];
                  if (passengerGeom && passengerGeom.length > 1) {
                    return (
                      <Polyline
                        key={`carpool-${person.id}`}
                        positions={passengerGeom}
                        color={getPersonColor(people, person.id)}
                        weight={3}
                        opacity={0.8}
                        dashArray="5, 5"
                      />
                    );
                  }
                  return null;
                }
              }

              return (
                <Polyline
                  key={person.id}
                  positions={geom}
                  color={getPersonColor(people, person.id)}
                  weight={3}
                  opacity={0.8}
                />
              );
            })}
          </MapContainer>
        </div>
      </div>
      {loading && <div className="toast">Calculating distances...</div>}
    </div>
  );
}
