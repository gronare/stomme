#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
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

  // A manifest that refuses the config must FAIL the build — a warning would ship a site where one page silently shadows another.
  console.log('· static build with a manifest that throws…');
  rmSync(DIST, { recursive: true, force: true });
  writeFileSync(join(stub, 'routes.mjs'), "export const routes = () => { throw new Error('colliding paths'); };\n");
  const refused = buildStatic({ STOMME_SLOTS_DIR: stub });
  check(!refused.ok, 'build FAILS when the routes manifest rejects the config');
  check(/rejected this site's config: colliding paths/.test(refused.out), "the failure names the manifest's own reason");
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
