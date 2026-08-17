import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import stomme from '@gronare/stomme/integration';
import { site, features, listings } from './src/site.config.ts';

// Build target, picked with STOMME_TARGET — see the README for what each one produces. Only the target you actually build needs its adapter installed.
const TARGET = process.env.STOMME_TARGET || 'netlify';
const STATIC = TARGET === 'static';
const ADAPTERS = { netlify: '@astrojs/netlify', cloudflare: '@astrojs/cloudflare', vercel: '@astrojs/vercel', node: '@astrojs/node' };

async function loadAdapter() {
  if (STATIC) return undefined;
  const pkg = ADAPTERS[TARGET];
  if (!pkg) throw new Error(`Unknown STOMME_TARGET "${TARGET}". Use one of: ${Object.keys(ADAPTERS).join(', ')}, static.`);
  try {
    const mod = await import(pkg);
    return TARGET === 'node' ? mod.default({ mode: 'standalone' }) : mod.default();
  } catch (e) {
    if (e?.code === 'ERR_MODULE_NOT_FOUND') throw new Error(`Build target "${TARGET}" needs its adapter — run:  pnpm add ${pkg}`);
    throw e;
  }
}
const adapter = await loadAdapter();

export default defineConfig({
  site: 'https://example.com',
  ...(adapter ? { adapter } : {}),
  integrations: [stomme({ features, routes: site.routes, listings, style: site.style }), sitemap({ filter: (page) => !page.includes('/preview') })],
});
