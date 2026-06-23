import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// stomme Astro integration — turns collection-detail routes on per the site's
// feature flags. Add to astro.config and pass the resolved features + route
// prefixes from site.config:
//
//   import stomme from '@gronare/stomme/integration';
//   import { kit, features } from './src/site.config.ts';
//   integrations: [stomme({ features, routes: kit.routes })]
//
// For each enabled, route-backed feature it injects a /<prefix>/[slug] route from a
// package entrypoint, rendered inside the SITE's Base (wired via aliases) so chrome
// + theme match. A feature that's off (or absent — features default to false)
// injects nothing, so that route simply doesn't exist. Block-only features
// (testimonials, faq) need no routes. Adding new features here never affects an
// existing site until it flips the flag.
export default function stomme(options = {}) {
  const features = options.features || {};
  const routes = options.routes || {};
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

        const routed = [
          { on: features.blog, prefix: routes.blog || '/blog', entrypoint: '@gronare/stomme/routes/post.astro' },
          { on: features.areas, prefix: routes.towns || '/areas', entrypoint: '@gronare/stomme/routes/town.astro' },
          { on: features.services, prefix: routes.services || '/services', entrypoint: '@gronare/stomme/routes/service.astro' },
        ];
        const enabled = [];
        for (const r of routed) {
          if (!r.on) continue;
          injectRoute({ pattern: `${r.prefix}/[slug]`, entrypoint: r.entrypoint });
          enabled.push(`${r.prefix}/[slug]`);
        }
        logger?.info(enabled.length ? `routes: ${enabled.join(', ')}` : 'no feature routes enabled');
      },
    },
  };
}
