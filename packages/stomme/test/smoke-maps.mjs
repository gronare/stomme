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
const GOOGLE = 'https://www.google.com/maps/embed';
const OSM = 'https://www.openstreetmap.org/export/embed.html';
const STATIC_HOST = 'maps.googleapis.com';
const LAT = 59.3293;
const LNG = 18.0686;

const results = [];
const check = (ok, name, detail = '') => {
  results.push([!!ok, name]);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
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
      lat: ${LAT}
      lng: ${LNG}
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

// A substitution that matches nothing would build the ORIGINAL starter and pass every "no embed" check while proving nothing about the others.
const splice = (src, re, replacement, what) => {
  if (!re.test(src)) throw new Error(`smoke-maps: ${what} — anchor ${re} not found in src/site.config.ts`);
  return src.replace(re, replacement);
};

const SITE_OPEN = /export const site: SiteConfig = \{/;

// Each case is a whole build: the resolution rules live in the block's frontmatter, and only a real build proves what a site actually ships.
function build(maps) {
  writeFileSync(CONFIG, maps === null ? config
    : splice(config, SITE_OPEN, `export const site: SiteConfig = {\n  maps: ${maps},`, 'the maps config'));
  rmSync(DIST, { recursive: true, force: true });
  const r = spawnSync('pnpm', ['run', 'build:static'], {
    cwd: STARTER, encoding: 'utf8', env: { ...process.env, STOMME_SLOTS_DIR: '' },
  });
  if (r.status !== 0) {
    console.error(`${r.stdout || ''}${r.stderr || ''}`);
    return { ok: false, html: '', section: '', handler: '', outside: '' };
  }
  const file = join(DIST, 'probe-map', 'index.html');
  const html = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const section = html.match(/<section data-stomme-block="map"[\s\S]*?<\/section>/)?.[0] ?? '';
  // The match must stay inside ONE script element: a regex that may cross </script> starts at the first script in the document and swallows the block's own markup, so every "outside the handler" check then passes on an empty page.
  const handler = html.match(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?data-stomme-map-embed(?:(?!<\/script>)[\s\S])*?<\/script>/)?.[0] ?? '';
  return { ok: true, html, section, handler, outside: handler ? html.replace(handler, '') : html };
}

const keyless = (b, label) => {
  check(b.section.includes('data-stomme-block="map"'), `${label}: the map block still renders`);
  check(b.section.includes('mapblock__img'), `${label}: the static image is what the page shows`);
  check(!b.section.includes('data-stomme-map-embed'), `${label}: no chip`);
  check(!b.html.includes(GOOGLE) && !b.html.includes(OSM), `${label}: no embed url anywhere on the page`);
};

const noRequestsTo = (b, host, label) => {
  check(!new RegExp(`<iframe[^>]*${host}`, 'i').test(b.html), `${label}: no iframe points at the provider before the click`);
  check(!new RegExp(`<(script|link|img)[^>]+(src|href)=["'][^"']*${host}`, 'i').test(b.html),
    `${label}: no script, stylesheet or image is fetched from the provider at rest`);
};

// The directions link is the one google.com the page is allowed to carry: it is an href the visitor decides to follow, and it fetches nothing where it sits.
const noGoogleAtRest = (b, label) => {
  check(!b.html.includes(STATIC_HOST), `${label}: the static-map host is named nowhere on the page`);
  const urls = [...b.outside.matchAll(/https?:\/\/[^"'\s]*google\.com[^"'\s]*/g)].map((m) => m[0]);
  check(urls.every((u) => u.startsWith('https://www.google.com/maps/dir/')),
    `${label}: outside the click handler the only google.com url is the directions link`,
    urls.filter((u) => !u.startsWith('https://www.google.com/maps/dir/')).slice(0, 3).join(' '));
};

// The chip is one button, so every assertion about the resting copy reads the same element the visitor clicks.
const chipOf = (section) => section.match(/<button[^>]*class="mapchip"[\s\S]*?<\/button>/)?.[0] ?? '';
const inside = (chip, tag) => chip.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? '';

try {
  writeFileSync(PAGE, MAP_PAGE);

  console.log('· no maps config at all…');
  const bare = build(null);
  check(bare.ok, 'no maps config: build succeeds');
  keyless(bare, 'no maps config');
  noGoogleAtRest(bare, 'no maps config');

  console.log('· provider google with NO key…');
  const unkeyed = build("{ provider: 'google' }");
  check(unkeyed.ok, 'google without a key: build succeeds');
  keyless(unkeyed, 'google without a key');
  noGoogleAtRest(unkeyed, 'google without a key');
  check(unkeyed.section === bare.section,
    'google without a key renders the very same markup as no maps config — a keyed embed that could only error is never offered');

  console.log('· a key with no provider…');
  const google = build(`{ key: ${JSON.stringify(KEY)} }`);
  check(google.ok, 'a bare key: build succeeds');
  const googleChip = chipOf(google.section);
  check(googleChip.includes('data-stomme-map-embed'), 'a bare key: the chip is mounted');
  check(/data-provider="google"/.test(googleChip), 'a bare key resolves to google, so a keyed site changes nothing');
  check(googleChip.includes(KEY), 'a bare key: the configured key reaches the page');
  check(inside(googleChip, 'b') !== '' && !/Google|OpenStreetMap/.test(inside(googleChip, 'b')),
    `a bare key: the chip label promises the map, not a provider (${inside(googleChip, 'b')})`);
  check(/Google/.test(inside(googleChip, 'small')), 'a bare key: the note under the label names Google');
  check(/Google/.test(googleChip.match(/data-loading-label="([^"]*)"/)?.[1] ?? ''),
    'a bare key: the loading copy the chip swaps to travels with it');
  check(/<svg[\s\S]*<\/svg>/.test(googleChip), 'a bare key: the chip carries its own inline icon, so it fetches nothing to draw itself');
  noRequestsTo(google, 'google\\.com', 'a bare key');
  noGoogleAtRest(google, 'a bare key');
  check(google.handler.includes(GOOGLE), 'a bare key: the google host is named inside the click handler');
  check(google.outside.split(GOOGLE).length - 1 === 0, 'a bare key: the google embed host appears nowhere outside the handler');
  // The proxy endpoint only exists on adapter builds, so a static site must keep the uploaded picture rather than link a still nothing will serve.
  check(!/src="\/map\//.test(google.section),
    'a bare key on the STATIC target: no first-party still is requested, because no endpoint was injected to answer it');
  check(/class="mapblock__img[^"]*"/.test(google.section),
    'a bare key on the STATIC target: the uploaded still is what the block falls back to');

  console.log('· provider osm, no key…');
  const osm = build("{ provider: 'osm' }");
  check(osm.ok, 'osm: build succeeds');
  const osmChip = chipOf(osm.section);
  check(osmChip.includes('data-stomme-map-embed'), 'osm: the chip is mounted with no key at all');
  check(/data-provider="osm"/.test(osm.section), 'osm: the block names its provider');
  check(inside(osmChip, 'b') === inside(googleChip, 'b'),
    'osm: the chip label is the same sentence as google\'s — only the note below it names the provider');
  check(/OpenStreetMap/.test(inside(osmChip, 'small')), 'osm: the note under the label names OpenStreetMap');
  check(/OpenStreetMap/.test(osmChip.match(/data-loading-label="([^"]*)"/)?.[1] ?? ''),
    'osm: the loading copy names OpenStreetMap too');
  check(/data-title="[^"]*OpenStreetMap[^"]*"/.test(osm.section), 'osm: the frame title names OpenStreetMap');
  const bbox = osm.section.match(/data-bbox="([^"]*)"/)?.[1] ?? '';
  const parts = bbox.split(',').map(Number);
  check(parts.length === 4 && Math.abs(parts[0] - (LNG - 0.008)) < 1e-6 && Math.abs(parts[1] - (LAT - 0.004)) < 1e-6
    && Math.abs(parts[2] - (LNG + 0.008)) < 1e-6 && Math.abs(parts[3] - (LAT + 0.004)) < 1e-6,
    `osm: the bbox frames the point at ±0.008 lon by ±0.004 lat (${bbox})`);
  noRequestsTo(osm, 'openstreetmap\\.org', 'osm');
  check(osm.handler.includes(OSM), 'osm: the openstreetmap host is named inside the click handler');
  check(osm.outside.split('openstreetmap.org').length - 1 === 0, 'osm: openstreetmap.org appears nowhere outside the handler');
  check(!osm.section.includes(KEY) && !/data-key="[^"]+"/.test(osm.section), 'osm: no key is carried, because none is needed');

  noGoogleAtRest(osm, 'osm');
  check(osm.handler === google.handler, 'both providers share ONE handler implementation — the provider only picks the url and the copy');
} finally {
  restore();
  try { rmSync(DIST, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ map embed smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ two-click map intact for both providers.');
