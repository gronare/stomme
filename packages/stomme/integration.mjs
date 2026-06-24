import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

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

function listingEntrypoint(l) {
  const catalog = l.preset === 'catalog';
  const tmpl = catalog ? 'CatalogPage' : 'PostPage';
  const prop = catalog ? 'entry' : 'post';
  return `---
import Base from '@stomme/base';
import { site } from '@stomme/config';
import Detail from '@gronare/stomme/${tmpl}.astro';
import { getCollection } from 'astro:content';
export async function getStaticPaths() {
  const items = await getCollection(${JSON.stringify(l.id)});
  return items.map((e) => ({ params: { slug: e.id }, props: { entry: e } }));
}
const { entry } = Astro.props;
---
<Base title={entry.data.title} description={entry.data.excerpt ?? entry.data.title}>
  <Detail ${prop}={entry} config={site} />
</Base>
`;
}

export default function stomme(options = {}) {
  const features = options.features || {};
  const routes = options.routes || {};
  const listings = resolveListings(options.listings);
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

        // 1. Fixed feature routes (blog/areas/services).
        const routed = [
          { on: features.blog, prefix: routes.blog || '/blog', entrypoint: '@gronare/stomme/routes/post.astro' },
          { on: features.areas, prefix: routes.towns || '/areas', entrypoint: '@gronare/stomme/routes/town.astro' },
          { on: features.services, prefix: routes.services || '/services', entrypoint: '@gronare/stomme/routes/service.astro' },
        ];
        for (const r of routed) {
          if (!r.on) continue;
          injectRoute({ pattern: `${r.prefix}/[slug]`, entrypoint: r.entrypoint });
          enabled.push(`${r.prefix}/[slug]`);
        }

        // 2. Listing detail routes — one generated, prerendered entrypoint each.
        const outDir = resolve(root, '.astro/stomme/listings');
        for (const l of listings) {
          const file = resolve(outDir, `${l.id}.astro`);
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
