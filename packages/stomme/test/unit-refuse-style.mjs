#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import stomme from '../integration.mjs';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const thrown = (fn) => { try { fn(); return null; } catch (e) { return e; } };

check(!thrown(() => stomme({})), 'a site without a style builds');
const err = thrown(() => stomme({ style: 'sparet' }));
check(err && /no longer loads themes/.test(err.message) && /src\/styles\/global\.css/.test(err.message), 'a site that still sets style stops with a message that says where the theme goes', err?.message);
process.env.STOMME_STYLE = 'sparet';
check(thrown(() => stomme({})), 'STOMME_STYLE stops the build too');
delete process.env.STOMME_STYLE;

const root = mkdtempSync(join(tmpdir(), 'stomme-style-'));
try {
  for (const d of ['src/styles', 'src/blocks', 'public/admin']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'src/blocks/schema.ts'), 'export const BLOCKS = [];\n');
  writeFileSync(join(root, 'public/admin/config.yml'), 'collections: []\n');
  writeFileSync(join(root, 'src/styles/global.css'), '@import "@gronare/stomme/styles.css";\n');
  writeFileSync(join(root, 'src/site.config.ts'), "export const site = { style: 'sparet' };\nexport const features = {};\n");
  const run = spawnSync(process.execPath, [join(PKG, 'bin/gen-admin-blocks.mjs')], { cwd: root, encoding: 'utf8', env: { ...process.env, STOMME_STYLE: '' } });
  check(run.status !== 0 && /stomme-gen: `style: "sparet"` is set/.test(run.stderr), 'stomme-gen refuses a site config that sets style', run.stderr.slice(0, 300));
} finally {
  rmSync(root, { recursive: true, force: true });
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
