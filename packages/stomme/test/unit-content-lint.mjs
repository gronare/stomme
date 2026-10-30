#!/usr/bin/env node
import { readFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createJiti } from 'jiti';
import { lintBlock, lintText, catalogMap, legacyIndex } from '../src/content-lint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const FIXTURE = resolve(HERE, 'fixtures/content-lint');
const BIN = resolve(PKG, 'bin/lint-content.mjs');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const { defaultBlocks } = await createJiti(import.meta.url).import(resolve(PKG, 'catalog.ts'));
const catalog = catalogMap(defaultBlocks);
const registry = JSON.parse(readFileSync(resolve(PKG, 'block-migrations.json'), 'utf8'));
const legacy = legacyIndex(registry);

console.log('· a field left out');
const noisy = defaultBlocks.filter((b) => lintBlock({ type: b.type }, catalog, legacy).length);
check(noisy.length === 0, 'a bare block of every library type reports nothing, since a field left out renders as its CMS default', noisy.map((b) => b.type).join(', '));

console.log('· unknown and older fields');
const hero = lintBlock({ type: 'hero', heading: 'x', ctaLabel: 'Go', ctaHref: '/x', anchor: 'top', colour: 'red', layout: { height: 'tall', glow: true } }, catalog, legacy);
eq(hero.filter((f) => f.kind === 'legacy').map((f) => [f.path, f.to]), [['ctaLabel', 'cta'], ['ctaHref', 'cta']], 'a flat button pair from block-migrations.json is named as an older field with its new home');
eq(hero.filter((f) => f.kind === 'unknown').map((f) => f.path), ['layout.glow', 'colour'], 'a field the catalog does not declare is reported, inside a group too');
check(!hero.some((f) => f.path === 'anchor'), 'anchor is accepted on every block');
eq(lintBlock({ type: 'featureGrid', items: [{ title: 't', body: 'b', linkLabel: 'More', link: '/x' }] }, catalog, legacy).filter((f) => f.kind === 'legacy').map((f) => f.path), ['items[0].linkLabel', 'items[0].link'], 'an older field on a list item is matched through the registry\'s list name');
eq(lintBlock({ type: 'contactSwitch', items: [{ label: 'A', colour: 'red' }] }, catalog, legacy).map((f) => f.path), ['items[0].colour'], 'a field a list item does not declare is reported with its index');
eq(lintBlock({ type: 'nope' }, catalog, legacy).map((f) => f.kind), ['unknown-block'], 'a block type the site does not have is reported');

console.log('· a file');
const news = readFileSync(join(FIXTURE, 'src/content/pages/news.md'), 'utf8');
const linted = lintText(news, catalog, legacy);
eq(linted.blocks.map((b) => [b.line, b.type]), [[10, 'contactSwitch'], [16, 'hero'], [20, 'madeUpBlock']], 'each block with a finding carries its line in the file, and a block that only leaves fields out is not listed');

console.log('· the command');
const tmp = mkdtempSync(join(tmpdir(), 'stomme-lint-'));
try {
  cpSync(FIXTURE, tmp, { recursive: true });
  const before = readFileSync(join(tmp, 'src/content/pages/news.md'), 'utf8');
  const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { cwd: tmp, encoding: 'utf8' });
  const plain = run();
  check(plain.status === 0 && /src\/content\/pages\/news\.md\n  line 10 · contactSwitch \(block 3\)\n    colour: not a field of contactSwitch; \/admin does not show it/.test(plain.stdout), 'it prints file, line, block and the finding, and exits 0', plain.stdout + plain.stderr);
  check(!plain.stdout.includes('home.md'), 'a file written the way the CMS writes it is not listed');
  check(run('--strict').status === 1, '--strict exits 1 when anything is reported');
  const json = JSON.parse(run('--json').stdout);
  eq([json.counts.unknown, json.counts.legacy, json.counts['unknown-block']], [1, 2, 1], '--json carries the counts');
  eq(readFileSync(join(tmp, 'src/content/pages/news.md'), 'utf8'), before, 'the command never writes a file');
  check(run('--fix').status === 2, 'an unknown option is refused');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
