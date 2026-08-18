import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, cpSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { previewEntrypoint, listingEntrypoint, lookbookDataModule, lookbookEntrypoint, lookbookBlockEntrypoint, REVEAL } from './src/entrypoints.mjs';
import { publicIndexPlugin } from './src/vite-public-index.mjs';

function resolveListings(l) {
  return (Array.isArray(l) ? l : [])
    .filter((x) => x && x.id && x.route && (x.preset === 'article' || x.preset === 'catalog'))
    .map((x) => ({ ...x, route: x.route.startsWith('/') ? x.route : `/${x.route}` }));
}

// sha256 of every first-party is:inline script body in the given trees, for /preview's CSP: the Astro compiler emits those bodies byte-for-byte (compressHTML on), so a source hash matches the rendered element and the script runs without 'unsafe-inline'. Deliberately skipped, and so CSP-blocked in preview: set:html (dynamic content), define:vars (the compiler rewrites the body), src= (external file).
function inlineScriptHashes(dirs) {
  const hashes = new Set();
  const stack = dirs.filter((d) => d && existsSync(d));
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const p = resolve(cur, ent.name);
      if (ent.isDirectory()) { stack.push(p); continue; }
      if (!ent.name.endsWith('.astro')) continue;
      let src;
      try { src = readFileSync(p, 'utf8'); } catch { continue; }
      for (const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (!/\bis:inline\b/.test(m[1])) continue;
        if (/set:html|define:vars|\bsrc\s*=/.test(m[1])) continue;
        if (!m[2]) continue;
        hashes.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
      }
    }
  }
  return [...hashes].sort();
}

// Optional theme "style": splices a theme's tokens.css + theme.css into the site's global.css immediately after the engine stylesheet @import, giving the cascade engine < tokens < theme < site with no !important. A named style whose theme.css is missing throws at build — a silent neutral fallback would ship unstyled pixels.
const STYLE_IMPORT_RE = /@import\s+["'](?:@[\w-]+\/)?stomme\/styles\.css["'];?/;
const GLOBAL_CSS_RE = /(^|\/)global\.css$/;
// A custom property, not a CSS comment: it survives minification, so the astro:build:done guard can prove the theme layer actually reached the emitted CSS.
const STYLE_SENTINEL = '--stomme-style';

function styleThemePlugin(style, styleDir) {
  const tokensPath = resolve(styleDir, 'tokens.css');
  const themePath = resolve(styleDir, 'theme.css');
  return {
    name: 'stomme:style',
    enforce: 'pre',
    transform(code, id) {
      // Identify the seam by the engine @import it carries plus a global.css basename, never an exact filesystem path: Vite resolves module ids to their realpath, which diverges from a resolve(config.root, …) path under symlinked / pnpm checkouts, and a path-equality check then silently no-ops and ships the site unthemed with a green build.
      const bare = id.split('?')[0].replace(/\\/g, '/');
      if (!GLOBAL_CSS_RE.test(bare)) return null;
      if (!STYLE_IMPORT_RE.test(code)) return null;
      if (existsSync(tokensPath)) this.addWatchFile(tokensPath);
      this.addWatchFile(themePath);
      const tokens = existsSync(tokensPath) ? readFileSync(tokensPath, 'utf8') : '';
      const theme = readFileSync(themePath, 'utf8');
      const injected =
        `\n:root{${STYLE_SENTINEL}:${JSON.stringify(style)}}` +
        `\n/* stomme style "${style}" — tokens (fonts + shape vars) */\n${tokens}` +
        `\n/* stomme style "${style}" — theme (component layer) */\n${theme}\n`;
      return { code: code.replace(STYLE_IMPORT_RE, (m) => m + injected), map: null };
    },
  };
}

function emittedCssHasStyle(dir) {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const p = resolve(cur, ent.name);
      if (ent.isDirectory()) { stack.push(p); continue; }
      if (!/\.(css|html)$/i.test(ent.name)) continue;
      try { if (readFileSync(p, 'utf8').includes(STYLE_SENTINEL)) return true; } catch { }
    }
  }
  return false;
}

export default function stomme(options = {}) {
  const features = options.features || {};
  const routes = options.routes || {};
  const listings = resolveListings(options.listings);
  const style = options.style || process.env.STOMME_STYLE;
  if (features.blog && !listings.some((l) => l.id === 'posts')) {
    listings.unshift({ id: 'posts', route: routes.blog || '/blog', label: 'Blog', preset: 'article' });
  }
  const layout = options.layout || 'src/layouts/Base.astro';
  const configPath = options.config || 'src/site.config.ts';

  return {
    name: 'stomme',
    hooks: {
      'astro:config:setup': async ({ command, config, injectRoute, injectScript, updateConfig, logger }) => {
        const root = fileURLToPath(config.root);
        const pkgDir = dirname(fileURLToPath(import.meta.url));

        // Mirror served public/media → gitignored src/assets/media so Astro can optimize it (src/ only), before Vite resolves the globs.
        try {
          const mediaSrc = resolve(root, 'public/media');
          const mediaDest = resolve(root, 'src/assets/media');
          rmSync(mediaDest, { recursive: true, force: true });
          if (existsSync(mediaSrc)) {
            cpSync(mediaSrc, mediaDest, { recursive: true });
            mkdirSync(mediaDest, { recursive: true });
            writeFileSync(resolve(mediaDest, '.gitignore'), '*\n');

            logger?.info('media: synced public/media → src/assets/media (build-bridge)');
          }
        } catch (e) {
          logger?.warn(`media build-bridge skipped: ${e?.message || e}`);
        }
        const siteRenderer = resolve(root, 'src/blocks/BlockRenderer.astro');

        const SLOT_NAMES = ['footer-end', 'header-start', 'header-nav-end', 'header-end'];
        const slotsDir = process.env.STOMME_SLOTS_DIR;
        const slotNoop = resolve(pkgDir, 'src/SlotNoop.astro');
        const slotAlias = {};
        const slotsOn = [];
        for (const name of SLOT_NAMES) {
          const file = slotsDir ? resolve(slotsDir, `${name}.astro`) : null;
          const on = !!(file && existsSync(file));
          slotAlias[`@stomme/slot-${name}`] = on ? file : slotNoop;
          if (on) slotsOn.push(name);
        }

        const addonCollectionsFile = slotsDir ? resolve(slotsDir, 'collections.mjs') : null;
        const addonCollectionsOn = !!(addonCollectionsFile && existsSync(addonCollectionsFile));
        slotAlias['@stomme/addon-collections'] = addonCollectionsOn
          ? addonCollectionsFile
          : resolve(pkgDir, 'src/addon-collections-noop.mjs');

        const addonBlocksFile = slotsDir ? resolve(slotsDir, 'blocks.mjs') : null;
        const addonBlocksOn = !!(addonBlocksFile && existsSync(addonBlocksFile));
        slotAlias['@stomme/addon-blocks'] = addonBlocksOn
          ? addonBlocksFile
          : resolve(pkgDir, 'src/addon-blocks-noop.mjs');

        const addonCatalogFile = slotsDir ? resolve(slotsDir, 'block-catalog.mjs') : null;
        const addonCatalogOn = !!(addonCatalogFile && existsSync(addonCatalogFile));
        slotAlias['@stomme/addon-catalog'] = addonCatalogOn
          ? addonCatalogFile
          : resolve(pkgDir, 'src/addon-catalog-noop.mjs');

        const addonPreviewFile = slotsDir ? resolve(slotsDir, 'preview.astro') : null;
        const addonPreviewOn = !!(addonPreviewFile && existsSync(addonPreviewFile));
        slotAlias['@stomme/addon-preview'] = addonPreviewOn
          ? addonPreviewFile
          : resolve(pkgDir, 'src/AddonPreviewNoop.astro');

        updateConfig({
          vite: {
            plugins: [ publicIndexPlugin(fileURLToPath(config.publicDir)) ],
            resolve: {
              alias: {
                '@stomme/base': resolve(root, layout),
                '@stomme/config': resolve(root, configPath),
                '@stomme/catalog': resolve(root, 'src/blocks/schema.ts'),
                '@stomme/renderer': existsSync(siteRenderer) ? siteRenderer : resolve(pkgDir, 'src/BlockRenderer.astro'),
                ...slotAlias,
              },
            },
            // fs.allow REPLACES the default list rather than extending it, so the project root must be listed beside slotsDir — a site's own src/styles/global.css 403s otherwise, with slots wired.
            ...(slotsDir ? { server: { fs: { allow: [slotsDir, root] } } } : {}),
            // Never inline hoisted component <script> chunks into the HTML (Astro inlines chunks under 4 KB by default): as external /_astro/*.js files they fall under the /preview CSP's script-src 'self', while inlined they would need per-build hashes the SSR route cannot know. Non-JS assets return undefined, so Vite's default limit still applies.
            build: { assetsInlineLimit: (path) => (/\.m?js$/.test(path) ? false : undefined) },
          },
        });

        injectScript('page', REVEAL);

        const enabled = [];
        for (const name of slotsOn) enabled.push(`slot:${name}`);
        const outDir = resolve(root, '.astro/stomme');

        if (style) {
          const themesDir = process.env.STOMME_THEMES_DIR;
          if (!themesDir) {
            throw new Error(
              `stomme: style "${style}" is set but STOMME_THEMES_DIR is not. ` +
              `Point it at the directory that holds your theme folders — ` +
              `a missing theme would silently ship unstyled pixels.`,
            );
          }
          const styleDir = resolve(themesDir, style);
          const themeCssPath = resolve(styleDir, 'theme.css');
          if (!existsSync(themeCssPath)) {
            throw new Error(
              `stomme: style "${style}" has no theme.css at ${themeCssPath}. ` +
              `Check STOMME_THEMES_DIR and the style name — ` +
              `a missing theme would silently ship unstyled pixels.`,
            );
          }
          updateConfig({ vite: { plugins: [styleThemePlugin(style, styleDir)] } });
          enabled.push(`style:${style}`);
        }

        const isStatic = (process.env.STOMME_TARGET || 'netlify') === 'static';

        // Contact endpoint on adapter builds only: an SSR route without an adapter fails the whole build, so a static target must stay adapterless.
        const siteContact = resolve(root, 'src/pages/api/contact.ts');
        if (!isStatic && !existsSync(siteContact)) {
          injectRoute({ pattern: '/api/contact', entrypoint: resolve(pkgDir, 'routes/contact.ts') });
          enabled.push('/api/contact');
        }
        const sitePreview = ['preview.astro', 'preview.ts', 'preview.js', 'preview.mdx']
          .some((f) => existsSync(resolve(root, 'src/pages', f)));
        if (sitePreview) {
          logger.info("using the site's own /preview (skipped the generated one)");
        } else {
          const previewFile = resolve(outDir, 'preview.astro');
          mkdirSync(outDir, { recursive: true });
          const cspHashes = inlineScriptHashes([pkgDir, resolve(root, 'src'), slotsDir]);
          writeFileSync(previewFile, previewEntrypoint(isStatic, cspHashes));
          injectRoute({ pattern: '/preview', entrypoint: previewFile });
          enabled.push(`/preview${isStatic ? ' (static)' : ''}`);
        }

        const site404 = ['404.astro', '404.md', '404.mdx', '404.html']
          .some((f) => existsSync(resolve(root, 'src/pages', f)));
        if (site404) {
          logger.info("using the site's own /404 (skipped the generated one)");
        } else {
          injectRoute({ pattern: '/404', entrypoint: '@gronare/stomme/routes/notfound.astro' });
          enabled.push('/404');
        }

        // The OG renderer must NOT go through the site bundle — its deps are native (satori/resvg/sharp) — so the endpoint runtime-imports it from its real package location via this define.
        updateConfig({ vite: { define: { __STOMME_OG_RENDERER__: JSON.stringify(pathToFileURL(resolve(pkgDir, 'src/og.mjs')).href) } } });
        injectRoute({ pattern: '/og/[...slug]', entrypoint: '@gronare/stomme/routes/og.ts' });
        enabled.push('/og/[...slug]');

        if (command === 'dev' || process.env.STOMME_LOOKBOOK) {
          mkdirSync(outDir, { recursive: true });
          writeFileSync(resolve(outDir, 'lookbook-data.mjs'), lookbookDataModule());
          const lookbookFile = resolve(outDir, 'lookbook.astro');
          writeFileSync(lookbookFile, lookbookEntrypoint());
          injectRoute({ pattern: '/lookbook', entrypoint: lookbookFile });
          const lookbookBlockFile = resolve(outDir, 'lookbook-block.astro');
          writeFileSync(lookbookBlockFile, lookbookBlockEntrypoint());
          injectRoute({ pattern: '/lookbook/[slug]', entrypoint: lookbookBlockFile });
          enabled.push('/lookbook', '/lookbook/[slug]');
        }

        const routed = [
          { on: features.areas, prefix: routes.towns || '/areas', entrypoint: '@gronare/stomme/routes/town.astro' },
          { on: features.services, prefix: routes.services || '/services', entrypoint: '@gronare/stomme/routes/service.astro' },
        ];
        for (const r of routed) {
          if (!r.on) continue;
          injectRoute({ pattern: `${r.prefix}/[slug]`, entrypoint: r.entrypoint });
          enabled.push(`${r.prefix}/[slug]`);
        }

        if (slotsDir) {
          const routesManifest = resolve(slotsDir, 'routes.mjs');
          if (existsSync(routesManifest)) {
            let mod;
            try {
              mod = await import(pathToFileURL(routesManifest).href);
            } catch (e) {
              throw new Error(
                `stomme: failed to load routes manifest from STOMME_SLOTS_DIR (${routesManifest}): ${e?.message || e}`,
              );
            }
            const declared = mod.routes ?? mod.default;
            let addonRoutes;
            try {
              addonRoutes = typeof declared === 'function'
                ? declared({ routes, features })
                : declared;
            } catch (e) {
              throw new Error(
                `stomme: the routes manifest in STOMME_SLOTS_DIR (${routesManifest}) rejected this site's config: ${e?.message || e}`,
              );
            }
            if (!Array.isArray(addonRoutes)) addonRoutes = [];
            for (const r of addonRoutes) {
              if (!r || typeof r.feature !== 'string' || !r.feature) {
                logger.warn('addon routes: skipped an entry with a missing/invalid "feature" (expected a non-empty string)');
                continue;
              }
              if (typeof r.pattern !== 'string' || !r.pattern.startsWith('/')) {
                logger.warn(`addon routes: skipped "${r.feature}" — "pattern" must be a non-empty string starting with "/"`);
                continue;
              }
              if (typeof r.entrypoint !== 'string' || !r.entrypoint || !existsSync(r.entrypoint)) {
                logger.warn(`addon routes: skipped "${r.pattern}" — entrypoint not found (${r.entrypoint || 'missing'})`);
                continue;
              }
              if (!features[r.feature]) continue;
              injectRoute({ pattern: r.pattern, entrypoint: r.entrypoint });
              enabled.push(r.pattern);
            }
          }
        }

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

      'astro:build:done': ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        try {
          const iconsDir = resolve(outDir, 'media/icons');
          if (existsSync(iconsDir)) {
            for (const f of readdirSync(iconsDir)) {
              const s = resolve(iconsDir, f);
              if (statSync(s).isFile()) cpSync(s, resolve(outDir, f));
            }
          }
        } catch (e) {
          logger?.warn(`media icons→root skipped: ${e?.message || e}`);
        }
        if (!style) return;
        if (emittedCssHasStyle(outDir)) {
          logger?.info(`style "${style}" verified in emitted CSS`);
          return;
        }
        throw new Error(
          `stomme: style "${style}" is configured but the theme layer is missing from the ` +
          `emitted CSS (no "${STYLE_SENTINEL}" sentinel under ${outDir}). The style splice ` +
          `silently failed — the site would ship unstyled. Failing the build.`,
        );
      },
    },
  };
}
