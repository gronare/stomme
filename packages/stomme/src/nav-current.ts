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

// A bare fragment ("#pricing") jumps within the page it sits on; it never names a page, so it is never the current one.
export function namesPage(href: string): boolean {
  return !!href && !String(href).startsWith('#');
}

// The anchor a bare fragment names lives on the front page, so off it the item has to travel there first.
export function fragmentHref(href: string, homeHref: string, onHome: boolean): string {
  if (onHome || !href || !String(href).startsWith('#') || href === '#') return href;
  return `${homeHref}${href}`;
}
