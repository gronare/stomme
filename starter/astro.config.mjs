import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';
import stomme from '@gronare/stomme/integration';
import { kit, features } from './src/site.config.ts';

// Output stays static (every page prerenders). The adapter only kicks in for
// routes that opt out via `export const prerender = false` — here just the CMS
// live-preview route /preview, which builds into a serverless function.
// stomme() injects collection-detail routes for enabled features (see site.config).
export default defineConfig({
  site: 'https://example.com',
  adapter: netlify(),
  integrations: [stomme({ features, routes: kit.routes }), sitemap({ filter: (page) => !page.includes('/preview') })],
});
