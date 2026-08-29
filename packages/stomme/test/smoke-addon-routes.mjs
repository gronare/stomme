#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const DIST = resolve(STARTER, 'dist');

const results = [];
const check = (ok, name) => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}`); };

const page = (label) => `---
export const prerender = true;
---
<html><head><title>${label}</title></head><body><main>addon route: ${label}</main></body></html>
`;

// The chrome the real addon pages render into: the header switcher, the hreflang set and the CTA that links back into the addon all come from the site's own layout.
const chromePage = (label, paths) => `---
import Base from '@stomme/base';
export const prerender = true;
${paths ? `export function getStaticPaths() { return ${JSON.stringify(paths)}; }\n` : ''}---
<Base title=${JSON.stringify(label)}><p>addon route: ${label}</p></Base>
`;

function buildStatic(env) {
  const r = spawnSync('pnpm', ['run', 'build:static'], {
    cwd: STARTER,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { ok: r.status === 0, out };
}

const emitted = (route) => existsSync(join(DIST, route, 'index.html'));
const html = (route) => readFileSync(join(DIST, route, 'index.html'), 'utf8');
const alternates = (src) => [...src.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);

// What greenhouse's SiteWirer writes into a booking site's astro.config.mjs (SITEMAP_CONST / SITEMAP_FILTER_GUARDED there) — copied verbatim so this build proves the real expression keeps the locale twins out too.
const SITEMAP_FILTER = "filter: (page) => !page.includes('/preview')";
const SITEMAP_FILTER_GUARDED = "filter: (page) => !page.includes('/preview') && !unreleasedBooking.some((r) => page.includes(r))";
const SITEMAP_CONST = `// Built but not released (a demo, or a service being wound down): the sitemap is the only thing that would link a booking page to someone who was never sent one.
const unreleasedBooking = features.booking && !features.bookingPublic
  ? ['booking', 'bookingConfirmation', 'bookingManage', 'bookingCancel', 'bookingMember', 'bookingTerms'].map((k) => site.routes?.[k]).filter(Boolean)
  : [];

`;

const OWNED = ['src/site.config.ts', 'src/content/navigation/nav.md', 'astro.config.mjs'];
const saved = new Map(OWNED.map((f) => [f, readFileSync(resolve(STARTER, f), 'utf8')]));
const restore = () => { for (const [f, body] of saved) { try { writeFileSync(resolve(STARTER, f), body); } catch {} } };

let stub;
try {
  stub = mkdtempSync(join(tmpdir(), 'stomme-addon-routes-'));
  writeFileSync(join(stub, 'on.astro'), page('addon-on'));
  writeFileSync(join(stub, 'off.astro'), page('addon-off'));
  writeFileSync(join(stub, 'configured.astro'), page('addon-configured'));
  writeFileSync(join(stub, 'collections.mjs'), 'export const collections = {};\n');
  writeFileSync(join(stub, 'routes.mjs'), `export const routes = ({ routes }) => [
  { feature: 'faq', pattern: '/addon-on', entrypoint: ${JSON.stringify(join(stub, 'on.astro'))} },
  { feature: 'blog', pattern: '/addon-off', entrypoint: ${JSON.stringify(join(stub, 'off.astro'))} },
  { feature: 'faq', pattern: '/addon-missing', entrypoint: ${JSON.stringify(join(stub, 'does-not-exist.astro'))} },
  { feature: 'faq', pattern: \`\${routes.formSuccess}-addon\`, entrypoint: ${JSON.stringify(join(stub, 'configured.astro'))} },
];
`);

  console.log('· static build WITH STOMME_SLOTS_DIR (stub)…');
  rmSync(DIST, { recursive: true, force: true });
  const withStub = buildStatic({ STOMME_SLOTS_DIR: stub });
  check(withStub.ok, 'build succeeds with a stub whose manifest has a missing-entrypoint entry');
  if (!withStub.ok) console.error(withStub.out);
  check(emitted('addon-on'), "'/addon-on' injected (feature 'faq' is ON) — dist/addon-on emitted");
  check(!emitted('addon-off'), "'/addon-off' NOT injected (feature 'blog' is OFF)");
  check(!emitted('addon-missing'), "'/addon-missing' NOT injected (entrypoint file does not exist)");
  check(/addon routes: skipped .*addon-missing/.test(withStub.out), 'build warns that the missing-entrypoint entry was skipped');
  check(emitted('thanks-addon'), "the manifest function is called with the site's own routes — '/thanks-addon' (routes.formSuccess) emitted");

  console.log('· static build WITHOUT STOMME_SLOTS_DIR…');
  rmSync(DIST, { recursive: true, force: true });
  const noStub = buildStatic({ STOMME_SLOTS_DIR: '' });
  check(noStub.ok, 'build succeeds without STOMME_SLOTS_DIR');
  if (!noStub.ok) console.error(noStub.out);
  check(!emitted('addon-on') && !emitted('addon-off') && !emitted('addon-missing'), 'no addon routes injected without a slots dir');

  console.log('· static build with three languages and an addon manifest…');
  writeFileSync(join(stub, 'index.astro'), chromePage('booking-index'));
  writeFileSync(join(stub, 'object.astro'), chromePage('booking-object', [{ params: { slug: 'stugan' } }]));
  writeFileSync(join(stub, 'manage.astro'), chromePage('booking-manage'));
  writeFileSync(join(stub, 'routes.mjs'), `export const routes = ({ routes }) => [
  { feature: 'booking', pattern: routes.booking, entrypoint: ${JSON.stringify(join(stub, 'index.astro'))} },
  { feature: 'booking', pattern: \`\${routes.booking}/[slug]\`, entrypoint: ${JSON.stringify(join(stub, 'object.astro'))} },
  { feature: 'booking', pattern: routes.bookingManage, entrypoint: ${JSON.stringify(join(stub, 'manage.astro'))} },
];
`);
  writeFileSync(resolve(STARTER, 'src/site.config.ts'),
    saved.get('src/site.config.ts')
      .replace('  faq: true,', '  faq: true,\n  booking: true,\n  bookingPublic: false,')
      .replace("    formSuccess: '/thanks',", "    formSuccess: '/thanks',\n    booking: '/bokning',\n    bookingManage: '/min-bokning',\n    bookingAction: 'boka',")
      .replace("  locale: 'en-US',\n  cmsLocale: 'en',", "  locale: 'sv-SE',\n  cmsLocale: 'sv',\n  locales: ['sv', 'en', 'no'],\n  noindex: ['/min-bokning'],"));
  writeFileSync(resolve(STARTER, 'src/content/navigation/nav.md'),
    saved.get('src/content/navigation/nav.md').replace('cta:\n  label: Contact\n  link:\n    page: /contact', 'cta:\n  label: Boka\n  link:\n    page: /bokning'));
  writeFileSync(resolve(STARTER, 'astro.config.mjs'),
    saved.get('astro.config.mjs')
      .replace('export default defineConfig({', `${SITEMAP_CONST}export default defineConfig({`)
      .replace(SITEMAP_FILTER, SITEMAP_FILTER_GUARDED));

  rmSync(DIST, { recursive: true, force: true });
  const multi = buildStatic({ STOMME_SLOTS_DIR: stub });
  check(multi.ok, 'the site builds with an addon manifest and three languages');
  if (!multi.ok) console.error(multi.out);

  check(emitted('bokning') && emitted('en/bokning') && emitted('no/bokning'),
    'the addon index answers under every locale prefix, from the one entrypoint');
  check(emitted('bokning/stugan') && emitted('en/bokning/stugan') && emitted('no/bokning/stugan'),
    "a dynamic addon route's static paths are built under the prefix too — /en/bokning/stugan");
  check(emitted('min-bokning') && emitted('en/min-bokning'), 'a guest page on its own top-level path gets its twins as well');

  check(/<a class="btn nav-cta" href="\/bokning">/.test(html('')), 'the booking CTA in the default language is the bare path');
  check(/<a class="btn nav-cta" href="\/en\/bokning">/.test(html('en')), 'and on an /en/ page it sends the guest to /en/bokning');
  check(/<a class="btn nav-cta" href="\/no\/bokning">/.test(html('no/about')),
    'a page deep inside a locale links into the addon under that locale, not back to the default language');

  const twin = html('en/bokning');
  const row = (href) => new RegExp(`<a class="lang-switch__row[^"]*"[^>]*href="${href}"`).test(twin);
  check(row('/bokning') && row('/en/bokning') && row('/no/bokning'),
    'the switcher on the twin offers the same addon path in each language');
  check(!/<a class="lang-switch__row[^"]*"[^>]*href="\/(en|no)\/"/.test(twin),
    'no row falls back to a locale front page — every language really serves this path');
  const alts = alternates(twin);
  check(JSON.stringify(alts) === JSON.stringify([
    ['sv-SE', 'https://example.com/bokning/'], ['en', 'https://example.com/en/bokning/'],
    ['no', 'https://example.com/no/bokning/'], ['x-default', 'https://example.com/bokning/'],
  ]), 'the twin names every language and x-default in its head', JSON.stringify(alts));

  check(/<meta name="robots" content="noindex, nofollow"/.test(html('min-bokning'))
    && /<meta name="robots" content="noindex, nofollow"/.test(html('en/min-bokning')),
    'an unlisted guest page is unlisted in every language — the noindex list is read against the unprefixed path');

  const sitemap = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
  check(sitemap.includes('https://example.com/en/about/'), 'the sitemap does carry the locale twins it should');
  check(!/\/bokning/.test(sitemap) && !/\/min-bokning/.test(sitemap),
    "the unreleased booking pages are excluded in every language — the wirer's page.includes(route) matches the prefixed URL");
  restore();

  // A manifest that refuses the config must FAIL the build — a warning would ship a site where one page silently shadows another.
  console.log('· static build with a manifest that throws…');
  rmSync(DIST, { recursive: true, force: true });
  writeFileSync(join(stub, 'routes.mjs'), "export const routes = () => { throw new Error('colliding paths'); };\n");
  const refused = buildStatic({ STOMME_SLOTS_DIR: stub });
  check(!refused.ok, 'build FAILS when the routes manifest rejects the config');
  check(/rejected this site's config: colliding paths/.test(refused.out), "the failure names the manifest's own reason");
} finally {
  restore();
  if (stub) { try { rmSync(stub, { recursive: true, force: true }); } catch {} }
  try { rmSync(DIST, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error(`\n✗ addon route-manifest injection smoke FAILED:`);
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ addon route-manifest injection intact.');
