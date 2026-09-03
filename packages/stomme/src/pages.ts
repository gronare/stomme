import { pagePathMap, normalizeParentPath } from './page-paths.mjs';

export { normalizeParentPath };

export interface PageEntry {
  id: string;
  data?: Record<string, unknown>;
}

export interface PageStep<T extends PageEntry = PageEntry> {
  entry: T;
  path: string;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const rank = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export function normalizePagePath(path: string): string {
  const p = String(path || '/').split('?')[0].split('#')[0].replace(/\/+$/, '');
  if (!p) return '/';
  return p.startsWith('/') ? p : `/${p}`;
}

export function pagePaths(pages: readonly PageEntry[]): Map<string, string> {
  return pagePathMap(pages.map((p) => ({ id: p.id, parent: p.data?.parent })));
}

export function pagePath(entry: PageEntry, pages: readonly PageEntry[] = []): string {
  const all = pages.some((p) => p.id === entry.id) ? pages : [...pages, entry];
  return pagePaths(all).get(entry.id) as string;
}

const LOCALE_TAIL = /\.([a-z]{2,3}(?:-[a-z0-9]{2,8})?)$/i;

export function writtenPages<T extends PageEntry>(pages: readonly T[]): T[] {
  const ids = new Set(pages.map((p) => p.id));
  return pages.filter((p) => {
    const m = p.id.match(LOCALE_TAIL);
    return !(m && ids.has(p.id.slice(0, -m[0].length)));
  });
}

export function pageByPath<T extends PageEntry>(path: string, pages: readonly T[]): T | undefined {
  const want = normalizePagePath(path);
  const paths = pagePaths(pages);
  return pages.find((p) => paths.get(p.id) === want);
}

export function pageTitle(entry: PageEntry): string {
  return text(entry.data?.title) || entry.id;
}

const parentOf = (path: string): string => path.slice(0, path.lastIndexOf('/'));

export function pageChildren<T extends PageEntry>(path: string, pages: readonly T[]): T[] {
  const want = normalizePagePath(path);
  const under = want === '/' ? '' : want;
  const paths = pagePaths(pages);
  return pages
    .filter((p) => !!p.data?.published)
    .filter((p) => {
      const own = paths.get(p.id);
      return !!own && parentOf(own) === under;
    })
    .sort((a, b) => rank(a.data?.order) - rank(b.data?.order) || pageTitle(a).localeCompare(pageTitle(b)));
}

export function pageTrail<T extends PageEntry>(entry: T, pages: readonly T[]): PageStep<T>[] {
  const paths = pagePaths(pages.some((p) => p.id === entry.id) ? pages : [...pages, entry]);
  const byPath = new Map<string, T>();
  for (const p of pages) {
    const own = paths.get(p.id);
    if (own) byPath.set(own, p);
  }
  const trail: PageStep<T>[] = [];
  const walked = new Set<string>();
  let at = normalizeParentPath(entry.data?.parent);
  while (at && !walked.has(at)) {
    walked.add(at);
    const ancestor = byPath.get(at);
    if (!ancestor) break;
    trail.unshift({ entry: ancestor, path: at });
    at = normalizeParentPath(ancestor.data?.parent);
  }
  return trail;
}
