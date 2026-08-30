export function normalizeNavPath(pathname: string): string {
  const p = String(pathname || '').split('?')[0].split('#')[0].replace(/\/+$/, '');
  return p || '/';
}

// The nav marks the DEEPEST item that owns the page: an exact hit, or a prefix that ends on a segment boundary, so "/news" owns "/news/one" but never "/newsroom" and "/" owns only itself. Feed it locale-stripped paths.
export function currentNavPath(pathname: string, hrefs: readonly string[]): string {
  const path = normalizeNavPath(pathname);
  let best = '';
  for (const raw of hrefs) {
    if (!raw) continue;
    const h = normalizeNavPath(raw);
    if (h !== path && (h === '/' || !path.startsWith(`${h}/`))) continue;
    if (h.length > best.length) best = h;
  }
  return best;
}
