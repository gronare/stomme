// One formatter and one grammar for both ends of the map proxy: a coordinate the block prints into a src must be one the endpoint will accept, or the still 404s on a site nobody is watching.
export const MAP_POINT_RE = /^-?\d{1,2}\.\d{1,6},-?\d{1,3}\.\d{1,6}$/;

function fixed(v: number): string {
  const s = v.toFixed(6).replace(/0+$/, '');
  return s.endsWith('.') ? `${s}0` : s;
}

export function mapPoint(lat: unknown, lng: unknown): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const point = `${fixed(lat)},${fixed(lng)}`;
  return MAP_POINT_RE.test(point) ? point : null;
}

export function parseMapPoint(raw: unknown): string | null {
  if (typeof raw !== 'string' || !MAP_POINT_RE.test(raw)) return null;
  const [lat, lng] = raw.split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return raw;
}
