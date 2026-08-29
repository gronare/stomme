#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const DIST = resolve(STARTER, 'dist');
const CONFIG = resolve(STARTER, 'src/site.config.ts');
const ADMIN = resolve(STARTER, 'public/admin');
const PAGE = resolve(STARTER, 'src/content/pages/probe-map.md');
const CONTACT = resolve(STARTER, 'src/content/contact/contact.md');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const PORT = Number(opt('--port', '8804'));
const NO_BUILD = args.includes('--no-build');
const base = `http://127.0.0.1:${PORT}`;

const KEY = 'AIzaSyProbeKeyNotReal000000000000000000';
const LAT = 59.3293;
const LNG = 18.0686;
const POINT = `${LAT},${LNG}`;

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
  - type: findUs
    heading: Find us
  - type: contactCard
    label: Direct contact
    show:
      - phone
      - map
published: true
---
`;

const ADDRESS = /^address:\n(?:  \w+: .*\n)+/m;
const ADDRESS_WITH_POINT = `address:
  street: "Storgatan 1"
  postcode: "111 22"
  city: "Stockholm"
  country: ""
  lat: ${LAT}
  lng: ${LNG}
`;

const config = readFileSync(CONFIG, 'utf8');
const contact = readFileSync(CONTACT, 'utf8');
if (!ADDRESS.test(contact)) throw new Error('smoke-map-proxy: the contact address block was not found in src/content/contact/contact.md');
// stomme-gen rewrites public/admin from the pages that exist, so the probe page lands in the committed CMS config unless the originals are put back.
const admin = readdirSync(ADMIN).map((f) => [join(ADMIN, f), readFileSync(join(ADMIN, f))]);
const restore = () => {
  writeFileSync(CONFIG, config);
  writeFileSync(CONTACT, contact);
  for (const [file, body] of admin) writeFileSync(file, body);
  rmSync(PAGE, { force: true });
};

const SITE_OPEN = /export const site: SiteConfig = \{/;
if (!SITE_OPEN.test(config)) throw new Error('smoke-map-proxy: anchor for the maps config not found in src/site.config.ts');

let child = null;
// Own process group: wrangler forks workerd, and a TERM to wrangler alone leaves workerd holding the port.
const cleanup = () => {
  if (!child) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
  child = null;
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); restore(); process.exit(130); });

async function waitFor(url, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function portBusy() {
  try { await fetch(`${base}/`); return true; } catch { return false; }
}

// The match must stay inside ONE script element, or it starts at the first script in the document and swallows the block's own markup.
const handlersOf = (html) =>
  [...html.matchAll(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?data-stomme-map-embed(?:(?!<\/script>)[\s\S])*?<\/script>/g)].map((m) => m[0]);

const sectionOf = (html, type) =>
  html.match(new RegExp(`<section data-stomme-block="${type}"[\\s\\S]*?</section>`))?.[0] ?? '';

async function main() {
  // Without this the run passes against a leftover server, and every assertion below reads a stale build.
  if (await portBusy()) {
    check(false, `nothing is already listening on ${base}`);
    return;
  }

  writeFileSync(PAGE, MAP_PAGE);
  writeFileSync(CONTACT, contact.replace(ADDRESS, ADDRESS_WITH_POINT));
  writeFileSync(CONFIG, config.replace(SITE_OPEN, `export const site: SiteConfig = {\n  maps: { key: ${JSON.stringify(KEY)} },`));

  if (!NO_BUILD) {
    console.log('· building the starter for cloudflare…');
    rmSync(DIST, { recursive: true, force: true });
    const r = spawnSync('pnpm', ['run', 'build:cloudflare'], {
      cwd: STARTER, encoding: 'utf8', env: { ...process.env, STOMME_SLOTS_DIR: '' },
    });
    if (r.status !== 0) {
      console.error(`${r.stdout || ''}${r.stderr || ''}`);
      check(false, 'the cloudflare build succeeds');
      return;
    }
  }
  const wranglerConfig = resolve(DIST, 'server/wrangler.json');
  if (!existsSync(wranglerConfig)) {
    check(false, 'the build produced dist/server/wrangler.json (a Workers build)');
    return;
  }

  const wrangler = [resolve(STARTER, 'node_modules/.bin/wrangler'), resolve(REPO_ROOT, 'node_modules/.bin/wrangler')]
    .find(existsSync) || 'wrangler';
  const workerLog = [];
  child = spawn(wrangler, ['dev', '--config', wranglerConfig, '--port', String(PORT), '--ip', '127.0.0.1'],
    { cwd: STARTER, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  child.stdout.on('data', (d) => workerLog.push(d.toString()));
  child.stderr.on('data', (d) => workerLog.push(d.toString()));
  if (!(await waitFor(`${base}/`, 60000))) {
    console.error(workerLog.join(''));
    check(false, 'workerd becomes ready');
    return;
  }
  console.log('· workerd ready');

  const page = await fetch(`${base}/probe-map/`);
  const html = await page.text();
  check(page.status === 200, `/probe-map/ answers 200 (got ${page.status})`);
  check(new RegExp(`<img[^>]+src="/map/${POINT}\\.png"`).test(html),
    'the resting still is requested from the site\'s own origin, at the coordinate the block was given',
    html.match(/<img[^>]*mappanel__img[^>]*>/)?.[0] ?? 'no map panel image at all');
  const findus = sectionOf(html, 'findUs');
  const card = sectionOf(html, 'contactCard');
  check(new RegExp(`<img[^>]+src="/map/${POINT}\\.png"`).test(findus),
    'the find-us map draws the SAME first-party still, at the coordinate the contact settings carry',
    findus.match(/<img[^>]*>/)?.[0] ?? 'no image on the find-us surface at all');
  check(new RegExp(`<img[^>]+src="/map/${POINT}\\.png"`).test(card),
    'and so does the contact card\'s mini map',
    card.match(/<img[^>]*>/)?.[0] ?? 'no image on the contact card at all');
  const handlers = handlersOf(html);
  check(handlers.length === 3 && new Set(handlers).size === 1,
    `all three surfaces ship ONE handler, byte for byte (${handlers.length} scripts, ${new Set(handlers).size} distinct)`);
  const chip = html.match(/<button[^>]*class="mapchip"[\s\S]*?<\/button>/)?.[0] ?? '';
  check(/<b>(Show interactive map|Visa interaktiv karta)<\/b>/.test(chip),
    'the chip is the only way to the interactive map',
    chip.slice(0, 160));
  check(/<small>[^<]*(Google)[^<]*<\/small>/.test(chip), 'the chip names Google as what the click will load');

  let outside = html;
  for (const one of handlers) outside = outside.replace(one, '');
  check(!outside.includes('googleapis'), 'the static-map host is named nowhere the browser could read it as a request');
  const urls = [...outside.matchAll(/https?:\/\/[^"'\s]*google\.com[^"'\s]*/g)].map((m) => m[0]);
  check(urls.every((u) => u.startsWith('https://www.google.com/maps/dir/')),
    'outside the click handler the only google.com url is the directions link the visitor chooses to follow',
    urls.filter((u) => !u.startsWith('https://www.google.com/maps/dir/')).slice(0, 3).join(' '));

  const bad = await fetch(`${base}/map/abc.png`);
  check(bad.status === 404, `a point that is not a coordinate is refused (got ${bad.status})`);
  check(bad.headers.get('cache-control') === 'no-store',
    `the refusal is never stored (cache-control: ${bad.headers.get('cache-control')})`);

  // The key is fake, so Google answers 403 and the endpoint must turn that into its own refusal without leaking either.
  const still = await fetch(`${base}/map/${POINT}.png`);
  const body = await still.text();
  check(still.status === 502, `an upstream that refuses becomes a 502 (got ${still.status})`);
  check(still.headers.get('cache-control') === 'no-store',
    `the 502 is never stored (cache-control: ${still.headers.get('cache-control')})`);
  check(!body.includes(KEY), 'the failure body does not carry the site key');
  check(!/googleapis|maps\.google/.test(body), 'nor the upstream url', body.slice(0, 200));
}

try {
  await main();
} catch (e) {
  check(false, `the run completes without crashing — ${String(e && e.message).split('\n')[0]}`);
} finally {
  cleanup();
  restore();
  rmSync(DIST, { recursive: true, force: true });
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ map proxy smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ the map still is served first-party, and a refusal is never stored.');
