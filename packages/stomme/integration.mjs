import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

// stomme Astro integration — injects collection-detail routes.
//
//   import stomme from '@gronare/stomme/integration';
//   import { site, features, listings } from './src/site.config.ts';
//   integrations: [stomme({ features, routes: site.routes, listings })]
//
// Two route sources, both rendered inside the SITE's Base (wired via aliases) so chrome
// + theme match:
//  1. Feature flags (blog/areas/services) — fixed package entrypoints, as before.
//  2. `listings` — for each, a prerendered detail entrypoint is generated into .astro/ and
//     injected at `<route>/[slug]`. The entrypoint hardcodes the listing's collection +
//     preset template (PostPage for `article`, CatalogPage for `catalog`). The index page
//     is a seeded managed page (stomme-gen), so only detail routes are injected here.
function resolveListings(l) {
  return (Array.isArray(l) ? l : [])
    .filter((x) => x && x.id && x.route && (x.preset === 'article' || x.preset === 'catalog'))
    .map((x) => ({ ...x, route: x.route.startsWith('/') ? x.route : `/${x.route}` }));
}

// Live-preview target, injected at /preview (generated so prerender is a literal
// Astro can statically resolve — a Vite `define` is substituted too late for the
// route scanner, which then prerenders the route and freezes it with empty blocks).
// SSR on server targets so the CMS draft (?data=) renders the real components;
// prerendered on `static` builds, where SSR (and thus live preview) isn't available.
function previewEntrypoint(isStatic) {
  return `---
export const prerender = ${isStatic ? 'true' : 'false'};
import Base from '@stomme/base';
import { site } from '@stomme/config';
import BlockRenderer from '@gronare/stomme/BlockRenderer.astro';
import Header from '@gronare/stomme/Header.astro';
import Footer from '@gronare/stomme/Footer.astro';

const kind = Astro.url.searchParams.get('kind');
const raw = Astro.url.searchParams.get('data');
function decode() {
  if (!raw) return null;
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); }
  catch { return null; }
}
const draft = decode();
let blocks = [];
if (!kind && Array.isArray(draft)) blocks = draft;
const navDraft = kind === 'header' && draft && typeof draft === 'object' ? draft : undefined;
const footerDraft = kind === 'footer' && draft && typeof draft === 'object' ? draft : undefined;
---
{kind === 'header' ? (
  <Base title="Preview" chrome={false}><Header nav={navDraft} /></Base>
) : kind === 'footer' ? (
  <Base title="Preview" chrome={false}><Footer footer={footerDraft} /></Base>
) : (
  <Base title="Preview"><div id="preview-root"><BlockRenderer blocks={blocks} config={site} /></div></Base>
)}
<script is:inline>
  // Each edit re-points this iframe at a new ?data=, so it reloads. Persist + restore
  // the scroll position so the preview doesn't jump back to the top on every keystroke.
  (function () {
    var KEY = 'stomme:previewScroll';
    try {
      var saved = sessionStorage.getItem(KEY);
      if (saved) window.addEventListener('load', function () { window.scrollTo(0, +saved); });
      window.addEventListener('scroll', function () { sessionStorage.setItem(KEY, String(window.scrollY)); }, { passive: true });
    } catch (e) {}
  })();
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'stomme:preview' && typeof e.data.data === 'string') {
      const u = new URL(location.href);
      u.searchParams.set('data', e.data.data);
      location.replace(u.toString());
    }
  });
</script>
`;
}

function listingEntrypoint(l) {
  const catalog = l.preset === 'catalog';
  const tmpl = catalog ? 'CatalogPage' : 'PostPage';
  const prop = catalog ? 'entry' : 'post';
  return `---
import Base from '@stomme/base';
import { site, listings } from '@stomme/config';
import Detail from '@gronare/stomme/${tmpl}.astro';
import { getCollection } from 'astro:content';
export async function getStaticPaths() {
  const items = await getCollection(${JSON.stringify(l.id)});
  return items.map((e) => ({ params: { slug: e.id }, props: { entry: e } }));
}
const { entry } = Astro.props;
---
<Base title={entry.data.title} description={entry.data.excerpt ?? entry.data.title}>
  <Detail ${prop}={entry} config={{ ...site, listings }} />
</Base>
`;
}

export default function stomme(options = {}) {
  const features = options.features || {};
  const routes = options.routes || {};
  const listings = resolveListings(options.listings);
  // The blog is an article listing in all but name — fold it in so detail routes go
  // through the same generated entrypoint (PostPage) as any listing.
  if (features.blog && !listings.some((l) => l.id === 'posts')) {
    listings.unshift({ id: 'posts', route: routes.blog || '/blog', label: 'Blog', preset: 'article' });
  }
  const layout = options.layout || 'src/layouts/Base.astro';
  const configPath = options.config || 'src/site.config.ts';

  return {
    name: 'stomme',
    hooks: {
      'astro:config:setup': ({ config, injectRoute, updateConfig, logger }) => {
        const root = fileURLToPath(config.root);
        // Let the package route entrypoints import the SITE's Base + config.
        updateConfig({
          vite: {
            resolve: {
              alias: {
                '@stomme/base': resolve(root, layout),
                '@stomme/config': resolve(root, configPath),
              },
            },
          },
        });

        const enabled = [];
        const outDir = resolve(root, '.astro/stomme');

        // 0. Live-preview route — generated with a literal prerender per target.
        // Skip it if the site ships its own src/pages/preview.astro (a richer preview
        // that can use the site's renderer + custom blocks); that one wins, no collision.
        const isStatic = (process.env.STOMME_TARGET || 'netlify') === 'static';
        const sitePreview = ['preview.astro', 'preview.ts', 'preview.js', 'preview.mdx']
          .some((f) => existsSync(resolve(root, 'src/pages', f)));
        if (sitePreview) {
          logger.info("using the site's own /preview (skipped the generated one)");
        } else {
          const previewFile = resolve(outDir, 'preview.astro');
          mkdirSync(outDir, { recursive: true });
          writeFileSync(previewFile, previewEntrypoint(isStatic));
          injectRoute({ pattern: '/preview', entrypoint: previewFile });
          enabled.push(`/preview${isStatic ? ' (static)' : ''}`);
        }

        // 1. Fixed feature routes (areas/services). Blog is handled as a listing below.
        const routed = [
          { on: features.areas, prefix: routes.towns || '/areas', entrypoint: '@gronare/stomme/routes/town.astro' },
          { on: features.services, prefix: routes.services || '/services', entrypoint: '@gronare/stomme/routes/service.astro' },
        ];
        for (const r of routed) {
          if (!r.on) continue;
          injectRoute({ pattern: `${r.prefix}/[slug]`, entrypoint: r.entrypoint });
          enabled.push(`${r.prefix}/[slug]`);
        }

        // 2. Listing detail routes — one generated, prerendered entrypoint each.
        const listingsDir = resolve(outDir, 'listings');
        for (const l of listings) {
          const file = resolve(listingsDir, `${l.id}.astro`);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, listingEntrypoint(l));
          injectRoute({ pattern: `${l.route}/[slug]`, entrypoint: file });
          enabled.push(`${l.route}/[slug]`);
        }

        logger?.info(enabled.length ? `routes: ${enabled.join(', ')}` : 'no feature/listing routes enabled');
      },
    },
  };
}
