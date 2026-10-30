#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan } from '../src/cli.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8')).version;

function astroBin(cwd) {
  const req = createRequire(join(cwd, 'package.json'));
  try {
    const pkgPath = req.resolve('astro/package.json');
    const { bin } = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return resolve(dirname(pkgPath), typeof bin === 'string' ? bin : bin.astro);
  } catch {
    return null;
  }
}

// One scaffolder: the checkout's own, then an installed create-stomme, then the published one fetched by npm.
function scaffoldCommand(args) {
  const checkout = resolve(here, '../../create-stomme/bin/create.mjs');
  if (existsSync(checkout)) return [process.execPath, [checkout, ...args]];
  try {
    return [process.execPath, [createRequire(import.meta.url).resolve('create-stomme/bin/create.mjs'), ...args]];
  } catch {
    return ['npm', ['exec', '--yes', '--package=create-stomme@latest', '--', 'create-stomme', ...args]];
  }
}

export function commandFor(step, cwd) {
  if (step.engine) return [process.execPath, [resolve(here, step.engine), ...step.args]];
  if (step.node) return [process.execPath, [resolve(cwd, step.node), ...step.args]];
  if (step.scaffold) return scaffoldCommand(step.args);
  const astro = astroBin(cwd);
  if (!astro) throw new Error(`astro is not installed in ${cwd}. Run stomme from a site directory after pnpm install.`);
  return [process.execPath, [astro, ...step.astro]];
}

export function main(argv, cwd = process.cwd()) {
  const p = plan(argv, { hasDevScript: existsSync(resolve(cwd, 'scripts/dev.mjs')), version });
  if (p.kind === 'help') { console.log(p.text); return 0; }
  if (p.kind === 'error') { console.error(p.text); return 2; }
  for (const step of p.steps) {
    let cmd, args;
    try { [cmd, args] = commandFor(step, cwd); }
    catch (e) { console.error(e.message); return 1; }
    const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...step.env } });
    if (r.error) { console.error(r.error.message); return 1; }
    if (r.status !== 0) return r.status ?? 1;
  }
  return 0;
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exitCode = main(process.argv.slice(2));
