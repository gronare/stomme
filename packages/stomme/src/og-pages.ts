// Which pages get a generated OG card (settings.og, Phase 2), and at what slug.
//
// ONE enumeration shared by the two consumers so they can never disagree:
//   - routes/og.ts       → getStaticPaths for /og/<slug>.png (emits the cards)
//   - Head.astro         → points og:image at /og/<slug>.png ONLY for enumerated
//                          pages (everything else keeps the Phase-1 raw image), so
//                          a rendered page never references a card that wasn't built.
//
// The set mirrors what the site actually renders: home, published pages, feature
// collections (towns/services), and every listing item (blog folded in as an article
// listing, same as integration.mjs). Pages flagged `seo.ogRaw` are EXCLUDED — Head
// then falls back to the raw image, which is exactly the requested bypass.
//
// Callers pass the site's { features, routes, listings } (from @stomme/config) — this
// module deliberately doesn't import the alias itself, so it stays importable outside
// an integration build (tests).
import { getCollection, getEntry } from 'astro:content';
import { resolveFeatures, resolveListings, type StommeFeatures, type Listing, type SiteConfig } from './config.ts';

export interface OgPage {
  slug: string; // /og/<slug> — carries the .png (rest-param route, astro-og-canvas style)
  path: string; // the page's own pathname, normalized (no trailing slash; '/' for home)
  title: string;
  image?: string; // card background source; unset → brand background
}

export interface OgConfig {
  features?: StommeFeatures;
  routes?: SiteConfig['routes'];
  listings?: Listing[];
}

// '/about/' → '/about', '' → '/', decode %-escapes so non-ASCII ids match.
export function normalizePath(pathname: string): string {
  let p = pathname || '/';
  try { p = decodeURIComponent(p); } catch { /* keep raw */ }
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

const slugFor = (path: string) => (path === '/' ? 'index' : path.replace(/^\//, '')) + '.png';

// Blog is an article listing in all but name — same folding as integration.mjs (kept
// in sync by hand; integration.mjs is ESM-only and can't import this TS module).
function effectiveListings(cfg: OgConfig) {
  const features = resolveFeatures(cfg.features);
  const listings = resolveListings(cfg.listings);
  if (features.blog && !listings.some((l) => l.id === 'posts')) {
    listings.unshift({ id: 'posts', route: cfg.routes?.blog || '/blog', label: 'Blog', preset: 'article', specs: [] });
  }
  return listings;
}

async function enumerate(cfg: OgConfig): Promise<OgPage[]> {
  const features = resolveFeatures(cfg.features);
  const routes = cfg.routes || {};
  const out: OgPage[] = [];
  const add = (path: string, title: string, image?: string) =>
    out.push({ slug: slugFor(path), path, title, image: image || undefined });

  const home = await getEntry('home', 'home');
  if (home && !home.data.seo?.ogRaw) add('/', home.data.seo.title, home.data.seo.image);

  // Unpublished pages aren't built (see the scaffold [...slug].astro) — skip them too.
  for (const p of await getCollection('pages')) {
    if (p.data.published === false || p.data.seo?.ogRaw) continue;
    add(`/${p.id}`, p.data.title || p.data.seo.title, p.data.seo.image);
  }

  if (features.areas) {
    for (const t of await getCollection('towns')) {
      if (t.data.seo?.ogRaw) continue;
      add(`${routes.towns || '/areas'}/${t.id}`, t.data.title ?? t.data.name, t.data.seo?.image ?? t.data.image);
    }
  }
  if (features.services) {
    for (const s of await getCollection('services')) {
      if (s.data.seo?.ogRaw) continue;
      add(`${routes.services || '/services'}/${s.id}`, s.data.title, s.data.seo?.image ?? s.data.image ?? s.data.hero?.image);
    }
  }
  for (const l of effectiveListings(cfg)) {
    for (const e of await getCollection(l.id as 'posts')) {
      const d = e.data as { title: string; cover?: string; gallery?: { image: string }[] };
      add(`${l.route}/${e.id}`, d.title, d.cover ?? d.gallery?.[0]?.image);
    }
  }
  return out;
}

// Memoized per build (content is frozen there); recomputed per call in dev/SSR so
// content edits are picked up without a restart.
let cache: Promise<OgPage[]> | null = null;
export function ogPages(cfg: OgConfig): Promise<OgPage[]> {
  if (import.meta.env?.PROD) return (cache ??= enumerate(cfg));
  return enumerate(cfg);
}

// The card href for a rendered page, or null when the page has no card (not
// enumerated, or opted out via seo.ogRaw) — the caller then uses the raw image.
export async function ogCardFor(pathname: string, cfg: OgConfig): Promise<string | null> {
  const path = normalizePath(pathname);
  const hit = (await ogPages(cfg)).find((p) => p.path === path);
  return hit ? `/og/${hit.slug}` : null;
}
