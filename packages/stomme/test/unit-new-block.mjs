#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/new-block.mjs');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

function run(args) {
  const dir = mkdtempSync(join(tmpdir(), 'stomme-new-block-'));
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: 'utf8' });
  const blocks = join(dir, 'src/blocks');
  const files = existsSync(blocks) ? readdirSync(blocks, { all: true }) : [];
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, files };
}

let r = run(['PromoBanner']);
check(r.status === 0 && r.files.join() === 'PromoBanner.astro', 'a bare name creates src/blocks/PromoBanner.astro', JSON.stringify(r));

r = run(['--', 'PromoBanner']);
check(r.status === 0 && r.files.join() === 'PromoBanner.astro', 'a name after `--` (pnpm block:new -- Name) creates the same file', JSON.stringify(r));

r = run(['promo-banner']);
check(r.status === 0 && r.files.join() === 'PromoBanner.astro', 'a kebab-case name is turned into PascalCase', JSON.stringify(r));

for (const args of [[], ['--'], ['---'], ['42']]) {
  r = run(args);
  check(r.status !== 0 && r.files.length === 0, `no usable name (${JSON.stringify(args)}) creates no file and exits non-zero`, JSON.stringify(r));
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
