import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';
import stomme from '@gronare/stomme/integration';
import { site, features, listings } from './src/site.config.ts';

// Build target:
//  • Default → Netlify. Every page prerenders; the adapter only powers the one SSR route,
//    /preview (the CMS live-preview), as a serverless function.
//  • `pnpm build:static` (sets STOMME_STATIC=1) → NO adapter, fully static. dist/ is plain
//    HTML/CSS/JS you can drop on any host (GitHub Pages, any webbhotell). /preview is then
//    prerendered instead of SSR. For a GitHub Pages *project* site also set `base: '/<repo>'`
//    and point `site` at the Pages URL.
// stomme() injects collection-detail routes for enabled features (see site.config).
const STATIC = process.env.STOMME_STATIC === '1';

export default defineConfig({
  site: 'https://example.com',
  ...(STATIC ? {} : { adapter: netlify() }),
  vite: { define: { __STOMME_STATIC__: JSON.stringify(STATIC) } },
  integrations: [stomme({ features, routes: site.routes, listings }), sitemap({ filter: (page) => !page.includes('/preview') })],
});
