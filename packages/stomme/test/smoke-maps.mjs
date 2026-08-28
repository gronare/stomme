#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const DIST = resolve(STARTER, 'dist');
const CONFIG = resolve(STARTER, 'src/site.config.ts');
const ADMIN = resolve(STARTER, 'public/admin');
const PAGE = resolve(STARTER, 'src/content/pages/probe-map.md');
const KEY = 'AIzaSyProbeKeyNotReal000000000000000000';
const EMBED_HOST = 'https://www.google.com/maps/embed';

const results = [];
const check = (ok, name) => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}`); };

function buildStatic() {
  const r = spawnSync('pnpm', ['run', 'build:static'], {
    cwd: STARTER, encoding: 'utf8', env: { ...process.env, STOMME_SLOTS_DIR: '' },
  });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const html = (...parts) => {
  const file = join(DIST, ...parts);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

// A substitution that matches nothing would build the ORIGINAL starter and pass every "no key" check while proving nothing about the key one.
const splice = (src, re, replacement, what) => {
  if (!re.test(src)) throw new Error(`smoke-maps: ${what} — anchor ${re} not found in src/site.config.ts`);
  return src.replace(re, replacement);
};

const MAP_PAGE = `---
title: "Probe Map"
seo:
  title: "Probe Map"
  description: "A map block with coordinates."
blocks:
  - type: map
    address: Storgatan 1, Grönköping
    note: Parking behind the house
    coords:
      lat: 59.3293
      lng: 18.0686
published: true
---
`;

const config = readFileSync(CONFIG, 'utf8');
// stomme-gen rewrites public/admin from the pages that exist, so the probe page lands in the committed CMS config unless the originals are put back.
const admin = readdirSync(ADMIN).map((f) => [join(ADMIN, f), readFileSync(join(ADMIN, f))]);
const restore = () => {
  writeFileSync(CONFIG, config);
  for (const [file, body] of admin) writeFileSync(file, body);
  rmSync(PAGE, { force: true });
};

try {
  writeFileSync(PAGE, MAP_PAGE);

  console.log('· static build with NO maps key…');
  rmSync(DIST, { recursive: true, force: true });
  const off = buildStatic();
  check(off.ok, 'build succeeds without a maps key');
  if (!off.ok) console.error(off.out);

  const bare = html('probe-map', 'index.html');
  check(bare.includes('data-stomme-block="map"'), 'the map block still renders');
  check(bare.includes('mapblock__img'), 'the static image is what a keyless site shows');
  check(!bare.includes('data-stomme-map-embed'), 'no embed button without a key');
  check(!bare.includes(EMBED_HOST), 'no embed url anywhere without a key');
  check(!bare.includes('mapblock__embednote'), 'no consent line without a key');

  console.log('· static build WITH a maps key…');
  writeFileSync(CONFIG, splice(config, /export const site: SiteConfig = \{/,
    `export const site: SiteConfig = {\n  maps: { key: ${JSON.stringify(KEY)} },`, 'the maps key'));
  rmSync(DIST, { recursive: true, force: true });
  const on = buildStatic();
  check(on.ok, 'build succeeds with a maps key');
  if (!on.ok) console.error(on.out);

  const keyed = html('probe-map', 'index.html');
  check(keyed.includes('data-stomme-map-embed'), 'the embed button is mounted from the block');
  check(keyed.includes(KEY), 'the configured key reaches the page');
  check(keyed.includes('mapblock__embednote'), 'the page says the map loads from Google on click');
  check(keyed.includes('mapblock__img'), 'the static image is still what the page shows at rest');

  // THE WHOLE POINT OF THE TWO-CLICK PATTERN: nothing may reach a Google host before the visitor asks for it.
  check(!/<iframe[^>]*google/i.test(keyed), 'no iframe points at Google before the click');
  check(!/<(script|link|img)[^>]+(src|href)=["'][^"']*google\.com/i.test(keyed),
    'no script, stylesheet or image is fetched from Google at rest');
  // The match must stay inside ONE script element: a regex that may cross </script> starts at the first script in the document and swallows the block's own markup, so every "outside the handler" check then passes on an empty page.
  const handler = keyed.match(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?data-stomme-map-embed(?:(?!<\/script>)[\s\S])*?<\/script>/)?.[0] ?? '';
  check(handler.includes(EMBED_HOST), 'the embed host is named inside the click handler');
  check(handler.includes("addEventListener('click'"), 'the embed is built on click, not on load');
  check(handler.includes("createElement('iframe')"), 'the frame is created by the handler, never served in the page');

  const outside = keyed.replace(handler, '');
  const embedHits = outside.split(EMBED_HOST).length - 1;
  check(embedHits === 0, `the embed host appears ${embedHits} times outside the handler`);
  check(new RegExp(`data-key="${KEY}"`).test(outside), 'the key travels as a data attribute, not as a request');
} finally {
  restore();
  try { rmSync(DIST, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ maps embed smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ two-click Google map intact.');
