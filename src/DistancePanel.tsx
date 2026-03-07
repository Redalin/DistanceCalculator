import { useState } from 'react';
import type { Person } from './App';
import { getPersonColor } from './colors';
import type { LatLng } from './types';
import type { StoredFavourite } from './sessionStorage';

type RouteEntry = { personId: string; distance: number; duration: number };

function formatKm(km: number): string {
  if (km >= 1) return `${km.toFixed(1)} km`;
  return `${Math.round(km * 1000)} m`;
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.ceil(seconds / 60);
  if (totalMinutes >= 60) {
    const h = Math.floor(totalMinutes / 60);
    const min = totalMinutes % 60;
    return min ? `${h}h ${min}m` : `${h}h`;
  }
  return `${totalMinutes}m`;
}

const MAX_FAVOURITES = 9;

export function DistancePanel({
  people,
  routes,
  meetingPoint,
  favourites,
  onRemovePerson,
  onUpdateName,
  onAddFavourite,
  onRemoveFavourite,
  onSetMeetingFromFavourite,
}: {
  people: Person[];
  routes: RouteEntry[];
  meetingPoint: LatLng | null;
  favourites: StoredFavourite[];
  onRemovePerson: (id: string) => void;
  onUpdateName: (id: string, name: string) => void;
  onAddFavourite: (name: string) => void;
  onRemoveFavourite: (id: string) => void;
  onSetMeetingFromFavourite: (position: LatLng) => void;
}) {
  const [sortByDistance, setSortByDistance] = useState(false);

  const handleSaveFavourite = () => {
    const name = window.prompt('Name this meeting place');
    if (name?.trim()) onAddFavourite(name.trim());
  };

  const totalKm = routes.reduce((a, r) => a + r.distance, 0);
  const maxRoute = routes.length
    ? routes.reduce((a, b) => (b.distance > a.distance ? b : a))
    : null;
  const maxDistance = maxRoute?.distance ?? 0;
  const longestDuration = routes.length
    ? routes.reduce((a, b) => (b.duration > a.duration ? b : a))
    : null;

  const displayPeople =
    sortByDistance && routes.length > 0
      ? [...people].sort((a, b) => {
          const distA = routes.find((r) => r.personId === a.id)?.distance ?? 0;
          const distB = routes.find((r) => r.personId === b.id)?.distance ?? 0;
          return distA - distB;
        })
      : people;

  return (
    <aside
      style={{
        width: '320px',
        minWidth: '280px',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <h2 style={{ margin: '0 0 8px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted)' }}>
        Favourite meeting places
      </h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
        {favourites.map((f) => (
          <li
            key={f.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              background: 'var(--bg)',
              borderRadius: '6px',
              marginBottom: '6px',
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={() => onSetMeetingFromFavourite(f.position)}
              style={{
                flex: 1,
                textAlign: 'left',
                background: 'none',
                border: 'none',
                color: 'var(--text)',
                fontSize: '0.9rem',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {f.name}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFavourite(f.id);
              }}
              style={{
                fontSize: '0.75rem',
                color: 'var(--muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
              title="Remove favourite"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {meetingPoint && favourites.length < MAX_FAVOURITES && (
        <button
          type="button"
          onClick={handleSaveFavourite}
          style={{
            marginBottom: '16px',
            padding: '6px 12px',
            fontSize: '0.85rem',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--accent)',
            cursor: 'pointer',
          }}
        >
          Save current location as favourite
        </button>
      )}
      {favourites.length >= MAX_FAVOURITES && (
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0 0 16px' }}>
          Maximum {MAX_FAVOURITES} favourites. Remove one to add another.
        </p>
      )}

      <h2 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600 }}>
        People & distances
      </h2>
      {routes.length > 0 && (
        <button
          type="button"
          onClick={() => setSortByDistance((s) => !s)}
          style={{
            marginBottom: '12px',
            padding: '6px 12px',
            fontSize: '0.85rem',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: sortByDistance ? 'var(--accent-dim)' : 'var(--bg)',
            color: sortByDistance ? 'var(--accent)' : 'var(--text)',
            cursor: 'pointer',
          }}
        >
          {sortByDistance ? 'Show original order' : 'Rank by distance'}
        </button>
      )}
      {!meetingPoint && (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
          Set a meeting point on the map, then click &quot;Calculate distances&quot;.
        </p>
      )}
      {people.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
          Click &quot;Add person&quot; then click on the map to place people.
        </p>
      )}
      {people.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
          {displayPeople.map((p, index) => {
            const route = routes.find((r) => r.personId === p.id);
            const rank = sortByDistance && route ? index + 1 : null;
            const progressPercent =
              maxDistance > 0 && route ? (route.distance / maxDistance) * 100 : 0;
            const color = getPersonColor(people, p.id);
            return (
              <li
                key={p.id}
                style={{
                  position: 'relative',
                  padding: '10px 28px 10px 12px',
                  background: 'var(--bg)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  border: '1px solid var(--border)',
                  borderLeftWidth: '4px',
                  borderLeftColor: color,
                }}
              >
                <button
                  type="button"
                  onClick={() => onRemovePerson(p.id)}
                  title="Remove"
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    lineHeight: 1,
                    color: 'var(--muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  ✕
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  {rank != null && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color,
                        minWidth: '1.25rem',
                      }}
                    >
                      #{rank}
                    </span>
                  )}
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => onUpdateName(p.id, e.target.value)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text)',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                    }}
                  />
                </div>
                {route && (
                  <>
                    <div
                      style={{
                        height: '6px',
                        borderRadius: '3px',
                        background: 'var(--border)',
                        overflow: 'hidden',
                        marginBottom: '6px',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${progressPercent}%`,
                          borderRadius: '3px',
                          background: color,
                          minWidth: progressPercent > 0 ? '4px' : 0,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                      {formatKm(route.distance)} · ~{formatDuration(route.duration)} drive
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {routes.length > 0 && (
        <div
          style={{
            padding: '12px',
            background: 'var(--bg)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Combined total</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--accent)' }}>
              {formatKm(totalKm)}
            </div>
          </div>
          {maxRoute && (
            <div>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Longest drive</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--orange)' }}>
                {formatKm(maxRoute.distance)}
              </div>
              {longestDuration && (
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  ~{formatDuration(longestDuration.duration)} drive
                </div>
              )}
            </div>
          )}
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '12px 0 0' }}>
            Times are based on speed limits; live traffic is not included.
          </p>
        </div>
      )}
    </aside>
  );
}
