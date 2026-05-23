import { useState, useRef, useEffect } from 'react';
import type { Person } from './App';
import { getPersonColor } from './colors';
import { formatDuration, formatKm } from './format';
import type { CarpoolLeg, CarpoolPool, LatLng, RouteEntry } from './types';
import type { StoredFavourite } from './sessionStorage';

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
  onClearAllPeople,
  showPanel,
  onTogglePanel,
  onToggleCarpool,
  onMovePersonToCarpool,
  carpoolPools,
  carpoolLegs,
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
  onClearAllPeople?: () => void;
  showPanel?: boolean;
  onTogglePanel?: () => void;
  onToggleCarpool: (id: string) => void;
  onMovePersonToCarpool: (personId: string, targetPersonId: string) => void;
  carpoolPools?: CarpoolPool[];
  carpoolLegs?: CarpoolLeg[];
}) {
  const [sortByDistance, setSortByDistance] = useState(false);
  const [width, setWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [draggedPersonId, setDraggedPersonId] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  useEffect(() => {
    // horizontal resize (pointer events)
    const handlePointerMove = (e: PointerEvent) => {
      if (!isResizing || !panelRef.current) return;
      e.preventDefault();
      const newWidth = e.clientX;
      const clampedWidth = Math.max(200, Math.min(500, newWidth));
      setWidth(clampedWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerUp);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleSaveFavourite = () => {
    const name = window.prompt('Name this meeting place');
    if (name?.trim()) onAddFavourite(name.trim());
  };

  // const totalKm = routes.reduce((a, r) => a + r.distance, 0);
  const maxRoute = routes.length
    ? routes.reduce((a, b) => (b.distance > a.distance ? b : a))
    : null;
  const maxDistance = maxRoute?.distance ?? 0;
  // const longestDuration = routes.length
  //   ? routes.reduce((a, b) => (b.duration > a.duration ? b : a))
  //   : null;

  const activeCarpoolPools = carpoolPools ?? [];
  const hasCarpool = activeCarpoolPools.length > 0;

  let totalSavedDistance = 0;
  const hostNames: string[] = [];
  if (hasCarpool) {
    activeCarpoolPools.forEach((pool) => {
      const host = people.find((p) => p.id === pool.hostId);
      if (host) hostNames.push(host.name);

      pool.memberIds.forEach((personId) => {
        if (personId === pool.hostId) return;
        const soloRoute = routes.find((r) => r.personId === personId);
        const passengerLeg = carpoolLegs?.find((l) => l.poolId === pool.id && l.passengerId === personId);
        if (soloRoute && passengerLeg) {
          totalSavedDistance += (soloRoute.distance - passengerLeg.distance);
        }
      });
    });
  }

  const displayPeople =
    sortByDistance && routes.length > 0
      ? [...people].sort((a, b) => {
          const distA = routes.find((r) => r.personId === a.id)?.distance ?? 0;
          const distB = routes.find((r) => r.personId === b.id)?.distance ?? 0;
          return distA - distB;
        })
      : people;

  const poolIds = [
    ...new Set(displayPeople.filter((person) => person.carpoolId).map((person) => person.carpoolId as string)),
  ];
  const poolMemberCounts = people.reduce<Record<string, number>>((counts, person) => {
    if (!person.carpoolId) return counts;
    counts[person.carpoolId] = (counts[person.carpoolId] ?? 0) + 1;
    return counts;
  }, {});
  const groupedPoolIds = new Set(
    Object.entries(poolMemberCounts)
      .filter(([, count]) => count > 1)
      .map(([poolId]) => poolId)
  );

  const getPoolIndex = (poolId: string) => poolIds.indexOf(poolId) + 1;
  const getPoolColor = (poolId: string) => {
    const activePool = activeCarpoolPools.find((pool) => pool.id === poolId);
    const anchorId = activePool?.hostId ?? people.find((person) => person.carpoolId === poolId)?.id ?? poolId;
    return getPersonColor(people, anchorId);
  };

  const renderPersonCard = (p: Person, index: number, inPoolCard = false) => {
    const route = routes.find((r) => r.personId === p.id);
    const activePool = p.carpoolId ? activeCarpoolPools.find((pool) => pool.id === p.carpoolId) : null;
    const poolIndex = p.carpoolId ? getPoolIndex(p.carpoolId) : 0;
    const rank = sortByDistance && route ? index + 1 : null;
    const progressPercent =
      maxDistance > 0 && route ? (route.distance / maxDistance) * 100 : 0;
    const color = getPersonColor(people, p.id);
    const poolColor = p.carpoolId ? getPoolColor(p.carpoolId) : color;

    return (
      <li
        key={p.id}
        draggable
        onDragStart={(e) => {
          setDraggedPersonId(p.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', p.id);
        }}
        onDragEnd={() => setDraggedPersonId(null)}
        onDragOver={(e) => {
          if (draggedPersonId && draggedPersonId !== p.id) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const sourceId = e.dataTransfer.getData('text/plain') || draggedPersonId;
          setDraggedPersonId(null);
          if (sourceId && sourceId !== p.id) onMovePersonToCarpool(sourceId, p.id);
        }}
        style={{
          position: 'relative',
          padding: '10px 28px 10px 12px',
          background: draggedPersonId && draggedPersonId !== p.id ? 'var(--surface)' : 'var(--bg)',
          borderRadius: '8px',
          marginBottom: inPoolCard ? '6px' : '8px',
          border: `1px solid ${draggedPersonId && draggedPersonId !== p.id ? 'var(--accent)' : p.carpoolId ? poolColor : 'var(--border)'}`,
          borderLeftWidth: '4px',
          borderLeftColor: color,
          boxShadow: p.carpoolId && !inPoolCard ? `0 0 0 2px ${poolColor}55, inset 0 0 0 1px ${poolColor}33` : undefined,
          cursor: 'grab',
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
          x
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
              minWidth: 0,
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', margin: '6px 0' }}>
          <button
            type="button"
            onClick={() => onToggleCarpool(p.id)}
            title={p.carpoolId ? 'Remove from carpool' : 'Start a carpool'}
            style={{
              background: p.carpoolId ? 'var(--accent-dim)' : 'var(--surface)',
              border: '1px solid ' + (p.carpoolId ? 'var(--accent)' : 'var(--border)'),
              borderRadius: '12px',
              padding: '3px 8px',
              fontSize: '0.72rem',
              fontWeight: 500,
              color: p.carpoolId ? 'var(--accent)' : 'var(--muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-5h14v5z"/>
              <circle cx="7.5" cy="14.5" r="1.5"/>
              <circle cx="16.5" cy="14.5" r="1.5"/>
            </svg>
            {p.carpoolId ? `Pool ${poolIndex || ''}`.trim() : 'Start Carpool'}
          </button>
        </div>
        {route && (() => {
          const isCarpool = Boolean(activePool);
          const isHost = isCarpool && p.id === activePool?.hostId;
          const isPassenger = isCarpool && p.id !== activePool?.hostId;
          const passengerLeg = isPassenger ? carpoolLegs?.find((l) => l.poolId === activePool?.id && l.passengerId === p.id) : null;
          const hostName = activePool
            ? people.find((person) => person.id === activePool.hostId)?.name ?? 'driver'
            : 'driver';

          if (isPassenger && passengerLeg) {
            const savedDist = route.distance - passengerLeg.distance;
            const pickupText = passengerLeg.pickupMode === 'driver-picks-up'
              ? `${hostName} picks up on the way`
              : `Drives ${formatKm(passengerLeg.passengerDriveDistance)} to ${hostName}`;
            const pickupDetail = passengerLeg.pickupMode === 'driver-picks-up'
              ? passengerLeg.driverDetourDistance >= 0
                ? `Driver detour ${formatKm(passengerLeg.driverDetourDistance)}`
                : `Driver route reduced by ${formatKm(Math.abs(passengerLeg.driverDetourDistance))}`
              : `Pickup leg ${formatKm(passengerLeg.pickupDistance)}`;
            return (
              <div style={{ marginTop: '6px' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600, background: 'rgba(88, 166, 255, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>Passenger</span>
                  <span>{pickupText}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                  {pickupDetail}
                </div>
                <div style={{ fontSize: '0.8rem', color: savedDist >= 0 ? 'var(--green)' : 'var(--orange)', marginTop: '2px', fontWeight: 500 }}>
                  {savedDist >= 0 ? `Saved ${formatKm(savedDist)} of driving!` : `Drives ${formatKm(Math.abs(savedDist))} extra`}
                </div>
              </div>
            );
          }

          if (isHost) {
            return (
              <>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '3px',
                    background: 'var(--border)',
                    overflow: 'hidden',
                    marginBottom: '6px',
                    marginTop: '6px'
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
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--green)', fontWeight: 600, background: 'rgba(63, 185, 80, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>Driver / Host</span>
                  <span>{formatKm(route.distance)} · ~{formatDuration(route.duration)} drive</span>
                </div>
              </>
            );
          }

          return (
            <>
              <div
                style={{
                  height: '6px',
                  borderRadius: '3px',
                  background: 'var(--border)',
                  overflow: 'hidden',
                  marginBottom: '6px',
                  marginTop: '6px'
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
          );
        })()}
      </li>
    );
  };

  return (
    <aside
      ref={panelRef}
      className={`distance-panel ${isResizing ? 'resizing' : ''}`}
      style={
        showPanel === false
          ? { display: 'none' }
          : { width: `${width}px` }
      }
    >
      {/* horizontal resize handle (right edge) */}
      <div
        className="resize-handle"
        onPointerDown={handlePointerDown}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '8px',
          cursor: 'ew-resize',
          zIndex: 10,
          background: isResizing ? 'var(--accent)' : 'transparent',
          touchAction: 'none'
        }}
      />
      {/* panel-level toggle for desktop/mobile: top-right */}
      {onTogglePanel && (
        <button
          type="button"
          className="mode-btn panel-toggle-top"
          onClick={onTogglePanel}
          title="Toggle panel"
          style={{ position: 'absolute', top: 10, right: 10 }}
        >
          {showPanel === false ? '^' : 'X'}
        </button>
      )}
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
      <div className="people-controls" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {routes.length > 0 && (
            <button
              type="button"
              onClick={() => setSortByDistance((s) => !s)}
              className="mode-btn"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              {sortByDistance ? 'Show original order' : 'Rank by distance'}
            </button>
          )}
        </div>
        {people.length > 0 && (
          <div style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Remove all people? This cannot be undone.')) {
                  onClearAllPeople?.();
                }
              }}
              className="mode-btn clear-btn"
              title="Remove all people"
            >
              Clear all people
            </button>
          </div>
        )}
      </div>
      {hasCarpool && (
        <div
          className="carpool-opt-card"
          style={{
            background: 'linear-gradient(135deg, var(--surface) 0%, rgba(88, 166, 255, 0.08) 100%)',
            border: '1px solid var(--accent)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(88, 166, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.2rem' }} aria-hidden>🚗</span>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent)' }}>
              Carpool Optimization
            </h3>
          </div>
          <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: 'var(--text)' }}>
            Recommended drivers: <strong style={{ color: 'var(--accent)' }}>{hostNames.join(', ')}</strong>
          </p>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            {activeCarpoolPools.length} active {activeCarpoolPools.length === 1 ? 'carpool' : 'carpools'} · Total driving saved:{' '}
            <strong style={{ color: totalSavedDistance < 0 ? '#f85149' : 'var(--green)' }}>
              {totalSavedDistance < 0 ? '-' : ''}{formatKm(Math.abs(totalSavedDistance))}
            </strong>
          </div>
        </div>
      )}
      {!meetingPoint && (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
          Set a meeting point on the map to calculate distances automatically.
        </p>
      )}
      {people.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
          Click &quot;Add person&quot; then click on the map to place people, or search for an address.
        </p>
      )}
      {people.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
          {(() => {
            const renderedPoolIds = new Set<string>();

            return displayPeople.map((p, index) => {
              if (!p.carpoolId || !groupedPoolIds.has(p.carpoolId)) {
                return renderPersonCard(p, index);
              }

              if (renderedPoolIds.has(p.carpoolId)) return null;
              renderedPoolIds.add(p.carpoolId);

              const poolPeople = displayPeople.filter((person) => person.carpoolId === p.carpoolId);
              const poolIndex = getPoolIndex(p.carpoolId);
              const poolColor = getPoolColor(p.carpoolId);
              const host = activeCarpoolPools.find((pool) => pool.id === p.carpoolId);
              const hostName = host
                ? people.find((person) => person.id === host.hostId)?.name
                : undefined;

              return (
                <li
                  key={p.carpoolId}
                  style={{
                    listStyle: 'none',
                    padding: '12px',
                    marginBottom: '12px',
                    borderRadius: '8px',
                    border: `1px solid ${poolColor}`,
                    background: `linear-gradient(135deg, ${poolColor}24 0%, var(--bg) 78%)`,
                    boxShadow: `0 0 0 2px ${poolColor}33`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: poolColor }}>
                        Pool {poolIndex}
                      </h3>
                      {hostName && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
                          Driver: {hostName}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        padding: '3px 8px',
                        borderRadius: '999px',
                        border: `1px solid ${poolColor}`,
                        color: poolColor,
                        background: 'var(--surface)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                    >
                      {poolPeople.length} {poolPeople.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {poolPeople.map((poolPerson) =>
                      renderPersonCard(poolPerson, displayPeople.indexOf(poolPerson), true)
                    )}
                  </ul>
                </li>
              );
            });
          })()}
        </ul>
      )}
    </aside>
  );
}
