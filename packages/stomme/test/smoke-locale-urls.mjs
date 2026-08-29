#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const DIST = resolve(STARTER, 'dist');
const PAGES = resolve(STARTER, 'src/content/pages');

const results = [];
const check = (ok, name, detail = '') => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`); };

const OWNED = ['src/site.config.ts', 'src/content/settings/site.md', 'public/admin/config.yml'];
const saved = new Map(OWNED.map((f) => [f, readFileSync(resolve(STARTER, f), 'utf8')]));
const added = [];

const page = (title, url) => `---
title: ${JSON.stringify(title)}
${url ? `url: ${url}\n` : ''}published: true
seo:
  title: ${JSON.stringify(title)}
  description: ${JSON.stringify(`${title} — locale route fixture.`)}
blocks:
  - type: prose
    body: ${JSON.stringify(title)}
---
`;

function write(rel, body) {
  const file = resolve(STARTER, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  added.push(file);
}

function buildStatic() {
  const r = spawnSync('pnpm', ['run', 'build:static'], { cwd: STARTER, encoding: 'utf8', env: process.env });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const emitted = (route) => existsSync(join(DIST, route, 'index.html'));
const html = (route) => readFileSync(join(DIST, route, 'index.html'), 'utf8');
const alternates = (src) => [...src.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);

try {
  writeFileSync(resolve(STARTER, 'src/site.config.ts'),
    saved.get('src/site.config.ts')
      .replace("  locale: 'en-US',\n  cmsLocale: 'en',", "  locale: 'sv-SE',\n  cmsLocale: 'sv',\n  locales: ['sv', 'en', 'no'],"));
  write('src/content/pages/omradet.md', page('Området'));
  write('src/content/pages/omradet.en.md', page('The area', 'the-area'));
  write('src/content/pages/omradet.no.md', page('Området', 'omraadet'));

  console.log('· static build with three languages, the switcher left at its default…');
  rmSync(DIST, { recursive: true, force: true });
  const globe = buildStatic();
  check(globe.ok, 'the site builds with a page that answers on a different address per language');
  if (!globe.ok) console.error(globe.out);

  check(emitted('omradet'), 'the default language serves the page under its filename — /omradet');
  check(emitted('en/the-area'), "the English address is the one the translation names — /en/the-area");
  check(emitted('no/omraadet'), 'and the Norwegian one its own — /no/omraadet');
  check(!emitted('en/omradet'), 'the filename is not also served under /en/ — one page, one address per language');
  check(emitted('about') && emitted('en/about') && emitted('no/about'),
    'a page no translation renamed still answers on the filename in every language');

  const alts = alternates(html('omradet'));
  check(JSON.stringify(alts) === JSON.stringify([['sv-SE', 'https://example.com/omradet/'], ['en', 'https://example.com/en/the-area/'], ['no', 'https://example.com/no/omraadet/'], ['x-default', 'https://example.com/omradet/']]),
    'the head names every language by the URL that language answers on', JSON.stringify(alts));
  check(JSON.stringify(alternates(html('en/the-area'))) === JSON.stringify(alts),
    'the translated page tells a crawler the same three URLs');

  const sitemap = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
  check(!sitemap.includes('xhtml:link'),
    'the sitemap writes no alternates at all — its prefix substitution would name /en/omradet, which nothing serves');

  const nav = html('omradet');
  check(/<details class="lang-switch"/.test(nav), 'the header carries the globe switcher by default');
  check(nav.includes('>Svenska<') && nav.includes('>English<') && nav.includes('>Norsk<'),
    'each language is offered in its own words');
  check(/<a class="lang-switch__row"[^>]*href="\/en\/the-area"/.test(nav),
    "the switcher's own targets are the translated addresses");
  check(/aria-label="Byt språk"/.test(nav), 'the control says what it does, in the language of the page');

  console.log('· the same site with the switcher set to flags…');
  writeFileSync(resolve(STARTER, 'src/content/settings/site.md'),
    saved.get('src/content/settings/site.md').replace(/^name:/m, 'languageSwitcher: flags\nname:'));
  rmSync(DIST, { recursive: true, force: true });
  const flags = buildStatic();
  check(flags.ok, 'the site builds with the flags variant');
  if (!flags.ok) console.error(flags.out);
  const flagged = html('omradet');
  check(/<span class="lang-flags" role="group"/.test(flagged), 'the header carries the flag row instead');
  check(!flagged.includes('lang-switch__panel'), 'and no dropdown — the two variants never both render');
  check((flagged.match(/class="lang-flag[ "]/g) || []).length === 3, 'one flag per language');
  check(/<a class="lang-flag is-current"[^>]*aria-label="Svenska"/.test(flagged),
    'the language being read is the lit one, and every flag says which language it is');
  check(/<a class="lang-flag"[^>]*href="\/en\/the-area"/.test(flagged), 'the flags point at the same addresses the globe did');

  console.log('· a page whose address is not an address…');
  writeFileSync(resolve(PAGES, 'omradet.en.md'), page('The area', 'The Area'));
  rmSync(DIST, { recursive: true, force: true });
  const refused = buildStatic();
  check(!refused.ok, 'the build FAILS rather than serving a URL nobody can link to');
  check(/omradet\.en\.md/.test(refused.out), 'and the failure names the file to fix', refused.out.slice(-400));
} finally {
  for (const f of added) { try { rmSync(f, { force: true }); } catch {} }
  for (const [f, body] of saved) { try { writeFileSync(resolve(STARTER, f), body); } catch {} }
  try { rmSync(DIST, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.error('\n✗ locale-url smoke FAILED'); process.exit(1); }
