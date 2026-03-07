import type { LatLng } from './types';

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

export function DistanceSummary({
  routes,
  meetingPoint,
}: {
  routes: RouteEntry[];
  meetingPoint: LatLng | null;
}) {
  if (routes.length === 0 || !meetingPoint) return null;

  const totalKm = routes.reduce((a, r) => a + r.distance, 0);
  const maxRoute = routes.length
    ? routes.reduce((a, b) => (b.distance > a.distance ? b : a))
    : null;
  const longestDuration = routes.length
    ? routes.reduce((a, b) => (b.duration > a.duration ? b : a))
    : null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 1000,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        minWidth: '200px',
        fontSize: '0.9rem',
      }}
    >
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Combined total</span>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent)' }}>
          {formatKm(totalKm)}
        </div>
      </div>
      {maxRoute && (
        <div>
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Longest drive</span>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--orange)' }}>
            {formatKm(maxRoute.distance)}
          </div>
          {longestDuration && (
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              ~{formatDuration(longestDuration.duration)} drive
            </div>
          )}
        </div>
      )}
      <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: '8px 0 0' }}>
        Times are based on speed limits; live traffic is not included.
      </p>
    </div>
  );
}