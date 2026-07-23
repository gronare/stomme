#!/usr/bin/env node
/*
 * stomme — build-level smoke for the addon route-manifest injection (integration.mjs,
 * "1b. Addon routes"). The slots dir may ship a `routes.mjs` exporting
 * [{ feature, pattern, entrypoint }]; each is injected only when the site's flag is on,
 * and only when the entry is well-formed and its entrypoint file exists.
 *
 * Pure static builds of the `starter` site with a throwaway STOMME_SLOTS_DIR stub (removed
 * in finally) — no browser. Run with:  pnpm --filter @gronare/stomme test:addon-routes
 *
 * ASSERTS
 *   1. WITH the stub + STOMME_SLOTS_DIR set, static-building the starter:
 *        · '/addon-on'      (feature 'faq', ON  in the starter) → dist/addon-on/  emitted.
 *        · '/addon-off'     (feature 'blog', OFF in the starter) → NOT emitted (feature-gated).
 *        · '/addon-missing' (feature ON but a non-existent entrypoint) → NOT emitted, and the
 *          build still SUCCEEDS (the invalid entry is skipped with a warning, not fatal).
 *   2. WITHOUT STOMME_SLOTS_DIR, the same build emits none of the addon routes (no injection).
 *
 * The stub reuses the starter's REAL feature flags (faq:true, blog:false in
 * src/site.config.ts) so no tracked file is touched. Injection is asserted by dist output
 * (a prerendered page), not by scraping logs.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..'); // packages/stomme/test → repo root
const STARTER = resolve(REPO_ROOT, 'starter');
const DIST = resolve(STARTER, 'dist');

const results = [];
const check = (ok, name) => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}`); };

// A self-contained prerendered page — no engine aliases needed, so the entrypoint renders
// on its own. Presence of its emitted HTML proves the route was injected.
const page = (label) => `---
export const prerender = true;
---
<html><head><title>${label}</title></head><body><main>addon route: ${label}</main></body></html>
`;

// Build the starter statically. Returns { ok, out } — ok=false when the build exits non-zero.
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

let stub;
try {
  // ── throwaway slots dir: routes.mjs + its entrypoints + a (valid) collections.mjs ──
  stub = mkdtempSync(join(tmpdir(), 'stomme-addon-routes-'));
  writeFileSync(join(stub, 'on.astro'), page('addon-on'));
  writeFileSync(join(stub, 'off.astro'), page('addon-off'));
  writeFileSync(join(stub, 'collections.mjs'), 'export const collections = {};\n');
  writeFileSync(join(stub, 'routes.mjs'), `export const routes = [
  { feature: 'faq', pattern: '/addon-on', entrypoint: ${JSON.stringify(join(stub, 'on.astro'))} },
  { feature: 'blog', pattern: '/addon-off', entrypoint: ${JSON.stringify(join(stub, 'off.astro'))} },
  { feature: 'faq', pattern: '/addon-missing', entrypoint: ${JSON.stringify(join(stub, 'does-not-exist.astro'))} },
];
`);

  // ── 1. build WITH the stub ────────────────────────────────────────────────────────
  console.log('· static build WITH STOMME_SLOTS_DIR (stub)…');
  rmSync(DIST, { recursive: true, force: true });
  const withStub = buildStatic({ STOMME_SLOTS_DIR: stub });
  check(withStub.ok, 'build succeeds with a stub whose manifest has a missing-entrypoint entry');
  if (!withStub.ok) console.error(withStub.out);
  check(emitted('addon-on'), "'/addon-on' injected (feature 'faq' is ON) — dist/addon-on emitted");
  check(!emitted('addon-off'), "'/addon-off' NOT injected (feature 'blog' is OFF)");
  check(!emitted('addon-missing'), "'/addon-missing' NOT injected (entrypoint file does not exist)");
  check(/addon routes: skipped .*addon-missing/.test(withStub.out), 'build warns that the missing-entrypoint entry was skipped');

  // ── 2. build WITHOUT the stub ───────────────────────────────────────────────────────
  console.log('· static build WITHOUT STOMME_SLOTS_DIR…');
  rmSync(DIST, { recursive: true, force: true });
  const noStub = buildStatic({ STOMME_SLOTS_DIR: '' });
  check(noStub.ok, 'build succeeds without STOMME_SLOTS_DIR');
  if (!noStub.ok) console.error(noStub.out);
  check(!emitted('addon-on') && !emitted('addon-off') && !emitted('addon-missing'), 'no addon routes injected without a slots dir');
} finally {
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
