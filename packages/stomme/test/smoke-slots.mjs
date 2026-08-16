#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const DIST = resolve(STARTER, 'dist');
const INTEGRATION = resolve(HERE, '../integration.mjs');

const results = [];
const check = (ok, name) => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}`); };

const SLOT_NAMES = JSON.parse(
  readFileSync(INTEGRATION, 'utf8')
    .match(/const SLOT_NAMES = (\[[^\]]*\])/)[1]
    .replace(/'/g, '"'),
);

const marker = (name) => `stomme-slot-${name}-here`;

function buildStatic(env) {
  const r = spawnSync('pnpm', ['run', 'build:static'], {
    cwd: STARTER, encoding: 'utf8', env: { ...process.env, ...env },
  });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const html = () => (existsSync(join(DIST, 'index.html')) ? readFileSync(join(DIST, 'index.html'), 'utf8') : '');

let stub;
try {
  stub = mkdtempSync(join(tmpdir(), 'stomme-slots-'));
  for (const name of SLOT_NAMES) {
    writeFileSync(join(stub, `${name}.astro`), `<span data-slot="${marker(name)}"></span>\n`);
  }

  console.log(`· static build WITH STOMME_SLOTS_DIR (${SLOT_NAMES.length} slots stubbed)…`);
  rmSync(DIST, { recursive: true, force: true });
  const withStub = buildStatic({ STOMME_SLOTS_DIR: stub });
  check(withStub.ok, 'build succeeds with every slot supplied');
  if (!withStub.ok) console.error(withStub.out);
  const built = html();
  for (const name of SLOT_NAMES) {
    check(built.includes(marker(name)), `slot '${name}' is mounted in the chrome, not only aliased`);
  }

  console.log('· static build WITHOUT STOMME_SLOTS_DIR…');
  rmSync(DIST, { recursive: true, force: true });
  const noStub = buildStatic({ STOMME_SLOTS_DIR: '' });
  check(noStub.ok, 'build succeeds without a slots dir');
  const bare = html();
  check(SLOT_NAMES.every((name) => !bare.includes(marker(name))), 'no slot renders without a slots dir');
} finally {
  if (stub) { try { rmSync(stub, { recursive: true, force: true }); } catch {} }
  try { rmSync(DIST, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ component slot smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
