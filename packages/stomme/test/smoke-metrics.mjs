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
const TOWN = resolve(STARTER, 'src/content/towns/probe-town.md');
const ENDPOINT = 'https://metrics.invalid.example/beacon';

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

// A substitution that matches nothing would build the ORIGINAL starter and pass every "no endpoint" check while proving nothing about the endpoint one.
const splice = (src, re, replacement, what) => {
  if (!re.test(src)) throw new Error(`smoke-metrics: ${what} — anchor ${re} not found in src/site.config.ts`);
  return src.replace(re, replacement);
};

const config = readFileSync(CONFIG, 'utf8');
const admin = readdirSync(ADMIN).map((f) => [join(ADMIN, f), readFileSync(join(ADMIN, f))]);
const restore = () => {
  writeFileSync(CONFIG, config);
  for (const [file, body] of admin) writeFileSync(file, body);
  rmSync(TOWN, { force: true });
};

try {
  writeFileSync(CONFIG, splice(
    splice(config, /\bareas: false\b/, 'areas: true', 'the town route needs the areas feature'),
    /export const site: SiteConfig = \{/,
    `export const site: SiteConfig = {\n  metrics: { endpoint: ${JSON.stringify(ENDPOINT)} },`,
    'the metrics endpoint',
  ));
  writeFileSync(TOWN, '---\nname: Probe Town\n---\n');

  console.log('· static build WITH site.metrics.endpoint…');
  rmSync(DIST, { recursive: true, force: true });
  const on = buildStatic();
  check(on.ok, 'build succeeds with a metrics endpoint');
  if (!on.ok) console.error(on.out);

  const home = html('index.html');
  check(home.includes('data-stomme-metrics'), 'the beacon script is mounted from the engine footer');
  check(home.includes(ENDPOINT), 'the configured endpoint reaches the page');
  check(home.includes('sendBeacon'), 'the beacon code itself is in the page');
  const tag = home.match(/<script[^>]*data-stomme-metrics[^>]*>/)?.[0] ?? '';
  check(tag !== '' && !/\bsrc=/.test(tag), 'the beacon is inline, never an external file');
  check(/data-stomme-block="hero"/.test(home) && /data-stomme-block="faq"/.test(home), 'block wrappers carry data-stomme-block');

  const town = html('areas', 'probe-town', 'index.html');
  check(/data-stomme-page="town"/.test(town), 'a town page carries data-stomme-page="town"');
  check(/data-stomme-entry="probe-town"/.test(town), 'the town page names its entry');
  check(town.includes(ENDPOINT), 'the town page beacons too');

  console.log('· static build with the default starter config…');
  restore();
  rmSync(DIST, { recursive: true, force: true });
  const off = buildStatic();
  check(off.ok, 'build succeeds with no metrics endpoint');
  if (!off.ok) console.error(off.out);

  const bare = html('index.html');
  check(bare.length > 0, 'the default starter still builds a home page');
  check(!bare.includes('data-stomme-metrics'), 'no beacon script without an endpoint');
  check(!bare.includes(ENDPOINT), 'no endpoint anywhere in the default build');
  check(!bare.includes('sendBeacon'), 'no beacon code at all without an endpoint');
  check(/data-stomme-block="hero"/.test(bare), 'the block markers are unconditional');
} finally {
  restore();
  try { rmSync(DIST, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ metrics beacon smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ metrics beacon intact.');
