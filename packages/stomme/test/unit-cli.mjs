#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { plan, TARGETS } from '../src/cli.mjs';
import { commandFor } from '../bin/stomme.mjs';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/stomme.mjs');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const show = (v) => JSON.stringify(v);
const scripts = (p) => (p.steps || []).map((s) => s.engine || s.node || (s.scaffold && 'scaffold') || `astro ${s.astro.join(' ')}`);

for (const argv of [[], ['--help'], ['-h'], ['help']]) {
  const p = plan(argv);
  check(p.kind === 'help' && ['new', 'dev', 'build', 'cms', 'block new', 'lint'].every((c) => p.text.includes(`  ${c} `)), `${show(argv)} lists every command`, show(p));
}
check(plan(['--version'], { version: '1.2.3' }).text === '1.2.3', '--version prints the engine version');
check(plan(['help', 'build']).text.startsWith('stomme build'), 'help <command> prints that command');
check(plan(['lint', '--help']).text.startsWith('stomme lint'), '<command> --help prints that command');

let p = plan(['dev', '--port', '3000'], { hasDevScript: true });
check(show(p.steps) === show([{ node: 'scripts/dev.mjs', args: ['--port', '3000'] }]), 'dev runs the site\'s scripts/dev.mjs with the options', show(p));
p = plan(['dev']);
check(show(scripts(p)) === show(['gen-admin-blocks.mjs', 'astro dev']), 'dev without scripts/dev.mjs regenerates the CMS, then runs astro dev', show(p));

p = plan(['build']);
check(show(scripts(p)) === show(['gen-admin-blocks.mjs', 'astro build']) && p.steps.every((s) => !s.env.STOMME_TARGET), 'build without --target leaves STOMME_TARGET to the site', show(p));
for (const t of TARGETS) {
  for (const argv of [['build', '--target', t], ['build', `--target=${t}`], ['build', '-t', t]]) {
    p = plan(argv);
    check(p.kind === 'run' && p.steps.every((s) => s.env.STOMME_TARGET === t), `${show(argv)} sets STOMME_TARGET=${t} for both steps`, show(p));
  }
}
p = plan(['build', '--target', 'static', '--verbose']);
check(show(p.steps[1].astro) === show(['build', '--verbose']), 'build passes the other options to astro build', show(p));
for (const argv of [['build', '--target', 'github'], ['build', '--target']]) {
  check(plan(argv).kind === 'error', `${show(argv)} is refused`);
}

check(show(plan(['cms']).steps) === show([{ engine: 'gen-admin-blocks.mjs', args: [], env: {} }]), 'cms runs stomme-gen');
check(show(plan(['block', 'new', 'promo-banner']).steps) === show([{ engine: 'new-block.mjs', args: ['promo-banner'], env: {} }]), 'block new <name> runs stomme-new-block');
for (const argv of [['block'], ['block', 'add', 'X'], ['block', 'new'], ['block', 'new', '--']]) {
  check(plan(argv).kind === 'error', `${show(argv)} is refused`);
}

check(show(plan(['lint']).steps) === show([{ engine: 'lint-content.mjs', args: [], env: {} }]), 'lint runs the content lint');
check(show(plan(['lint', '--strict']).steps[0]) === show({ engine: 'lint-content.mjs', args: ['--strict'], env: {} }), 'lint --strict passes the option to the content lint');
check(plan(['lint', 'styles']).steps[0].engine === 'lint-styles.mjs', 'lint styles runs stomme-lint-styles');
check(show(plan(['lint', 'comments', 'src']).steps[0].args) === show(['src']), 'lint comments <dir> runs stomme-lint-comments on it');
check(plan(['lint', 'css']).kind === 'error', 'an unknown lint is refused');

check(show(plan(['new', 'my-site', '--demo']).steps) === show([{ scaffold: true, args: ['my-site', '--demo'] }]), 'new passes its arguments to the scaffolder');
check(show(plan(['--', 'cms']).steps) === show(plan(['cms']).steps), 'a leading -- is dropped');
check(plan(['deploy']).kind === 'error', 'an unknown command is refused');

const engineDir = resolve(dirname(BIN));
for (const [name, script] of [['stomme-gen', 'gen-admin-blocks.mjs'], ['stomme-new-block', 'new-block.mjs'], ['stomme-lint-content', 'lint-content.mjs']]) {
  check(existsSync(join(engineDir, script)), `the script behind ${name} exists`);
}
const [, scaffoldArgs] = commandFor({ scaffold: true, args: ['x'] }, process.cwd());
check(basename(scaffoldArgs[0]) === 'create.mjs' && existsSync(scaffoldArgs[0]), 'in a checkout, new runs the checkout\'s create-stomme', show(scaffoldArgs));

const runBin = (args, cwd) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
let r = runBin([]);
check(r.status === 0 && r.stdout.includes('stomme <command>'), 'the stomme bin prints the commands and exits 0', r.stderr);
r = runBin(['nope']);
check(r.status === 2 && r.stderr.includes('Unknown command "nope"'), 'the stomme bin exits 2 on an unknown command', `${r.status} ${r.stderr}`);

const dir = mkdtempSync(join(tmpdir(), 'stomme-cli-'));
try {
  r = runBin(['block', 'new', 'promo-banner'], dir);
  check(r.status === 0 && existsSync(join(dir, 'src/blocks/PromoBanner.astro')), 'stomme block new promo-banner writes src/blocks/PromoBanner.astro', r.stderr);
  mkdirSync(join(dir, 'scripts'));
  writeFileSync(join(dir, 'scripts/dev.mjs'), "import { writeFileSync } from 'node:fs';\nwriteFileSync('ran', process.argv.slice(2).join(' '));\n");
  r = runBin(['dev', '--host'], dir);
  check(r.status === 0 && readFileSync(join(dir, 'ran'), 'utf8') === '--host', 'stomme dev runs the site\'s scripts/dev.mjs with the options', r.stderr);
  let thrown = '';
  try { commandFor({ astro: ['build'] }, dir); } catch (e) { thrown = e.message; }
  check(thrown.includes('astro is not installed'), 'astro build in a directory without astro names what is missing', thrown);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
