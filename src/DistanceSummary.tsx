import { formatDuration, formatKm } from './format';
import type { LatLng, RouteEntry } from './types';

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
        bottom: '24px',
        left: '12px',
        zIndex: 400,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '10px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        minWidth: 'fit-content',
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
    </div>
  );
}
