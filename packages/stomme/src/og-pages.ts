// One module shared by routes/og.ts (emits the cards) and Head.astro (resolves og:image) so the two can never disagree; the site's { features, routes, listings } arrive as an argument rather than through the @stomme/config alias, so this stays importable outside an integration build (tests).
import { getCollection, getEntry } from 'astro:content';
import { resolveFeatures, resolveListings, type StommeFeatures, type Listing, type SiteConfig } from './config.ts';

export interface OgPage {
  slug: string; // /og/<slug> — carries the .png (rest-param route, astro-og-canvas style)
  path: string | null; // the page's pathname (normalized); null for the site-default card
  card: boolean; // true → emit a PNG at slug (generate a card); false → use `raw`
  raw?: string; // when !card: the raw URL this page's og:image should point at
  typeKey?: string; // 'towns' | 'services' | <listing id> — which settings.og.types config
  image?: string; // card background source; unset → brand background
  headlineDefault?: string; // field key the headline falls back to when the type sets none
  sublineDefault?: string; // field key ('none' allowed) the second line falls back to
  vars?: Record<string, string>; // the item's known field values (+ business) by field key
}

export interface OgConfig {
  features?: StommeFeatures;
  routes?: SiteConfig['routes'];
  listings?: Listing[];
}

// Decode %-escapes so non-ASCII ids match the paths built from entry ids.
export function normalizePath(pathname: string): string {
  let p = pathname || '/';
  try { p = decodeURIComponent(p); } catch { /* keep raw */ }
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

const slugFor = (path: string) => (path === '/' ? 'index' : path.replace(/^\//, '')) + '.png';

// One chain across every collection shape: catalog cover/gallery, article cover, services hero, towns/services media.
type ItemData = {
  cover?: string;
  gallery?: { image: string }[];
  hero?: { image?: string };
  media?: { image?: string };
};
const mainImage = (d: ItemData) => d.cover ?? d.gallery?.[0]?.image ?? d.hero?.image ?? d.media?.image ?? undefined;

// Blog is an article listing in all but name — folded the same way in integration.mjs, by hand: that file is ESM-only and can't import this TS module.
function effectiveListings(cfg: OgConfig) {
  const features = resolveFeatures(cfg.features);
  const listings = resolveListings(cfg.listings);
  if (features.blog && !listings.some((l) => l.id === 'posts')) {
    listings.unshift({ id: 'posts', route: cfg.routes?.blog || '/blog', label: 'Blog', preset: 'article', specs: [] });
  }
  return listings;
}

async function homeHeroImage(): Promise<string | undefined> {
  const home = await getEntry('home', 'home');
  const blocks = (home?.data?.blocks ?? []) as { type?: string; media?: { image?: string } }[];
  const hit = blocks.find((b) => (b.type === 'hero' || b.type === 'coverHero') && !!b.media?.image);
  return hit?.media?.image || undefined;
}

// Uploaded default → home-hero photo → /og/default.png, the brand card enumerate() emits in exactly this case.
async function siteDefault(settings: { ogImage?: string }): Promise<string> {
  if (settings.ogImage) return settings.ogImage;
  const hero = await homeHeroImage();
  if (hero) return hero;
  return '/og/default.png';
}

// Must match the field selects gen-admin-blocks.mjs emits; 'business' (the site name) is added at resolve.
export type OgTypeKind = 'article' | 'catalog' | 'towns' | 'services';
export const TYPE_FIELDS: Record<OgTypeKind, string[]> = {
  article: ['title', 'date', 'excerpt'],
  catalog: ['title', 'price', 'status', 'category', 'date'],
  towns: ['name', 'title', 'heroSubtitle'],
  services: ['title', 'navLabel', 'summary'],
};
// Per-type fallbacks when the CMS never saved a pick (mirror the selects' defaults).
export const HEADLINE_DEFAULT: Record<OgTypeKind, string> = { article: 'title', catalog: 'title', towns: 'name', services: 'title' };
export const SUBLINE_DEFAULT: Record<OgTypeKind, string> = { article: 'none', catalog: 'price', towns: 'none', services: 'none' };

// `title` always resolves (towns fall back to `name`) so the headline fallback chain never dead-ends.
function itemVars(kind: OgTypeKind, d: Record<string, unknown>, name: string): Record<string, string> {
  const s = (v: unknown) => (v == null ? '' : String(v));
  const vars: Record<string, string> = { business: name };
  for (const f of TYPE_FIELDS[kind]) vars[f] = s(d[f]);
  if (!vars.title) vars.title = s((d as { name?: string }).name);
  return vars;
}

async function addCollection(
  out: OgPage[],
  opts: {
    collection: string;
    routeBase: string;
    typeKey: string;
    kind: OgTypeKind;
    typeEnabled: boolean;
    fallback: string; // the site-default URL (used when the type is off, no override)
    name: string; // business name → the 'business' field
  },
) {
  const { collection, routeBase, typeKey, kind, typeEnabled, fallback, name } = opts;
  for (const e of await getCollection(collection as 'posts')) {
    const d = e.data as ItemData & Record<string, unknown> & { seo?: { image?: string; ogRaw?: boolean } };
    const path = normalizePath(`${routeBase}/${e.id}`);
    const override = d.seo?.image;
    if (override) { out.push({ slug: slugFor(path), path, card: false, raw: override }); continue; }
    if (d.seo?.ogRaw) { out.push({ slug: slugFor(path), path, card: false, raw: mainImage(d) ?? fallback }); continue; }
    if (typeEnabled) {
      out.push({
        slug: slugFor(path), path, card: true, typeKey,
        image: mainImage(d), headlineDefault: HEADLINE_DEFAULT[kind], sublineDefault: SUBLINE_DEFAULT[kind],
        vars: itemVars(kind, d, name),
      });
    } else {
      // Resolved concretely here so Head never has to re-derive the default.
      out.push({ slug: slugFor(path), path, card: false, raw: fallback });
    }
  }
}

async function enumerate(cfg: OgConfig): Promise<OgPage[]> {
  const settings = ((await getEntry('settings', 'site'))?.data ?? {}) as {
    name?: string; ogImage?: string; og?: { enabled?: boolean; types?: Record<string, { enabled?: boolean }> };
  };
  const og = settings.og ?? {};
  if (!og.enabled) return [];
  const types = og.types ?? {};
  const features = resolveFeatures(cfg.features);
  const routes = cfg.routes || {};
  const name = settings.name || '';
  const out: OgPage[] = [];

  // The brand card is emitted once, site-wide, and only when siteDefault resolved to it.
  const fallback = await siteDefault(settings);
  if (fallback === '/og/default.png') {
    out.push({ slug: 'default.png', path: null, card: true, typeKey: '', vars: { business: name, title: name } });
  }

  if (features.areas) {
    await addCollection(out, { collection: 'towns', routeBase: routes.towns || '/areas', typeKey: 'towns', kind: 'towns', typeEnabled: !!types.towns?.enabled, fallback, name });
  }
  if (features.services) {
    await addCollection(out, { collection: 'services', routeBase: routes.services || '/services', typeKey: 'services', kind: 'services', typeEnabled: !!types.services?.enabled, fallback, name });
  }
  for (const l of effectiveListings(cfg)) {
    await addCollection(out, { collection: l.id, routeBase: l.route, typeKey: l.id, kind: l.preset, typeEnabled: !!types[l.id]?.enabled, fallback, name });
  }
  return out;
}

// Memoized per build (content is frozen there); recomputed per call in dev/SSR so content edits need no restart.
let cache: Promise<OgPage[]> | null = null;
export function ogPages(cfg: OgConfig): Promise<OgPage[]> {
  if (import.meta.env?.PROD) return (cache ??= enumerate(cfg));
  return enumerate(cfg);
}

// Relative URL — Head makes it absolute. `override` is the page's own seo.image (the image prop routes pass for home/pages).
export async function resolveShareImage(pathname: string, override: string | undefined, cfg: OgConfig): Promise<string | null> {
  const settings = ((await getEntry('settings', 'site'))?.data ?? {}) as { ogImage?: string; og?: { enabled?: boolean } };
  if (!settings.og?.enabled) return override ?? settings.ogImage ?? null;
  const path = normalizePath(pathname);
  const hit = (await ogPages(cfg)).find((p) => p.path === path);
  if (hit) return hit.card ? `/og/${hit.slug}` : hit.raw ?? null;
  return override ?? (await siteDefault(settings));
}
