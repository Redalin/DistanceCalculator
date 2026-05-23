export function formatKm(km: number): string {
  if (km >= 1) return `${km.toFixed(1)} km`;
  return `${Math.round(km * 1000)} m`;
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.ceil(seconds / 60);
  if (totalMinutes >= 60) {
    const h = Math.floor(totalMinutes / 60);
    const min = totalMinutes % 60;
    return min ? `${h}h ${min}m` : `${h}h`;
  }
  return `${totalMinutes}m`;
}
