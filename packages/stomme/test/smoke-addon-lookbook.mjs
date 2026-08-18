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
const CONFIG = resolve(STARTER, 'src/site.config.ts');

const results = [];
const check = (ok, name) => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}`); };

function buildLookbook(env) {
  const r = spawnSync('pnpm', ['run', 'build:static'], {
    cwd: STARTER,
    encoding: 'utf8',
    env: { ...process.env, STOMME_LOOKBOOK: '1', ...env },
  });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const book = () => {
  const file = join(DIST, 'lookbook', 'index.html');
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

const originalConfig = readFileSync(CONFIG, 'utf8');
let stub;
try {
  stub = mkdtempSync(join(tmpdir(), 'stomme-addon-lookbook-'));
  writeFileSync(join(stub, 'AddonSample.astro'),
    '---\nconst { heading } = Astro.props;\n---\n<p class="addon-sample">addon sample: {heading}</p>\n');
  writeFileSync(join(stub, 'blocks.mjs'),
    "import AddonSample from './AddonSample.astro';\nexport const blocks = { addonSample: AddonSample };\n");
  writeFileSync(join(stub, 'block-catalog.mjs'),
    "export const BLOCKS = [{ type: 'addonSample', label: 'Addon sample', fields: [{ name: 'heading', label: 'Heading', widget: 'string', required: false }], sample: { heading: 'from the catalog' } }];\n");

  console.log('· lookbook WITHOUT the addon feature…');
  rmSync(DIST, { recursive: true, force: true });
  const off = buildLookbook({ STOMME_SLOTS_DIR: stub });
  check(off.ok, 'lookbook builds with an addon catalog mounted but the feature off');
  if (!off.ok) console.error(off.out);
  check(!/addon sample: from the catalog/.test(book()),
    'a site that renders no addon surface keeps the lookbook it had');

  console.log('· lookbook WITH the addon feature on…');
  writeFileSync(CONFIG, originalConfig.replace(/export const features: StommeFeatures = \{/, 'export const features: StommeFeatures = {\n  booking: true,'));
  rmSync(DIST, { recursive: true, force: true });
  const on = buildLookbook({ STOMME_SLOTS_DIR: stub });
  check(on.ok, 'lookbook builds with the addon feature on');
  if (!on.ok) console.error(on.out);
  check(/addon sample: from the catalog/.test(book()), "the addon catalog's own block is a lookbook section");
  check(/addonSample/.test(book()), 'the section is labelled by block type, like every engine section');

  console.log('· lookbook WITHOUT a slots dir…');
  rmSync(DIST, { recursive: true, force: true });
  const bare = buildLookbook({ STOMME_SLOTS_DIR: '' });
  check(bare.ok, 'lookbook builds with no addon layer at all');
  if (!bare.ok) console.error(bare.out);
  check(!/addon sample: from the catalog/.test(book()), 'no addon section without a slots dir');
} finally {
  writeFileSync(CONFIG, originalConfig);
  if (stub) { try { rmSync(stub, { recursive: true, force: true }); } catch {} }
  try { rmSync(DIST, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ addon lookbook smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ addon catalog reaches the lookbook only where the feature is on.');
