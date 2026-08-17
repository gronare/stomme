#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const DIST = resolve(STARTER, 'dist');
const PAGE = resolve(STARTER, 'src/pages/addon-block-probe.astro');

const results = [];
const check = (ok, name) => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}`); };

const probePage = `---
export const prerender = true;
import Base from '@stomme/base';
import BlockRenderer from '@stomme/renderer';
const blocks = [
  { type: 'addonProbe', label: 'from the addon' },
  { type: 'noSuchBlockType' },
];
---
<Base title="addon block probe"><BlockRenderer blocks={blocks} /></Base>
`;

function buildStatic(env) {
  const r = spawnSync('pnpm', ['run', 'build:static'], {
    cwd: STARTER,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const html = () => {
  const file = join(DIST, 'addon-block-probe', 'index.html');
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

let stub;
try {
  stub = mkdtempSync(join(tmpdir(), 'stomme-addon-blocks-'));
  writeFileSync(join(stub, 'AddonProbe.astro'),
    '---\nconst { label } = Astro.props;\n---\n<p class="addon-probe">addon block: {label}</p>\n');
  writeFileSync(join(stub, 'blocks.mjs'),
    "import AddonProbe from './AddonProbe.astro';\nexport const blocks = { addonProbe: AddonProbe };\n");
  writeFileSync(PAGE, probePage);

  console.log('· static build WITH STOMME_SLOTS_DIR (stub)…');
  rmSync(DIST, { recursive: true, force: true });
  const withStub = buildStatic({ STOMME_SLOTS_DIR: stub });
  check(withStub.ok, 'build succeeds with an addon block registry');
  if (!withStub.ok) console.error(withStub.out);
  check(/addon block: from the addon/.test(html()), "the addon's own block type renders");
  check(/Unknown block/.test(html()), 'an unknown type still shows the renderer notice');

  console.log('· static build WITHOUT STOMME_SLOTS_DIR…');
  rmSync(DIST, { recursive: true, force: true });
  const noStub = buildStatic({ STOMME_SLOTS_DIR: '' });
  check(noStub.ok, 'build succeeds without a slots dir');
  if (!noStub.ok) console.error(noStub.out);
  check(!/addon block: from the addon/.test(html()), 'no addon block without a slots dir');
  check(/Unknown block/.test(html()), 'the addon type is simply unknown then');
} finally {
  try { rmSync(PAGE, { force: true }); } catch {}
  if (stub) { try { rmSync(stub, { recursive: true, force: true }); } catch {} }
  try { rmSync(DIST, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ addon block registry smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ addon block registry intact.');
