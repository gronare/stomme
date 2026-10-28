#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STARTER = resolve(HERE, '../../../starter');
const PORT = Number(process.env.PORT || 4596);
const base = `http://localhost:${PORT}`;
const siteName = (readFileSync(resolve(STARTER, 'src/content/settings/site.md'), 'utf8').match(/^name:\s*["']?(.+?)["']?\s*$/m) || [])[1];

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

try { await fetch(`${base}/`); console.error(`✗ something already listens on ${base}; refusing to test a server this run did not start`); process.exit(1); } catch {}

// No STOMME_TARGET in the environment: this is the fresh site's default target, the one `astro preview` cannot serve.
const env = { ...process.env };
delete env.STOMME_TARGET;
const log = [];
const child = spawn('pnpm', ['preview', '--port', String(PORT)], { cwd: STARTER, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
child.stdout.on('data', (d) => log.push(String(d)));
child.stderr.on('data', (d) => log.push(String(d)));
let exited = null;
child.on('exit', (code) => { exited = code; });

let home = null;
const deadline = Date.now() + 240000;
while (Date.now() < deadline && !home) {
  try { const r = await fetch(`${base}/`); if (r.ok) home = await r.text(); } catch {}
  if (!home && exited !== null && exited !== 0) break;
  if (!home) await new Promise((r) => setTimeout(r, 1000));
}

try {
  check(!!home, '`pnpm preview` serves the site on the default target', log.join('').slice(-1500));
  check(!!siteName && (home || '').includes(siteName.replace(/&/g, '&amp;')), `the previewed home page is the starter's (${siteName})`);
  const contact = home ? await fetch(`${base}/contact/`) : null;
  check(contact?.status === 200, 'a page built from content answers 200', `HTTP ${contact?.status}`);
} finally {
  // astro preview runs in the background when it detects an agent, so it is stopped through astro as well as by killing the child.
  spawnSync('npx', ['astro', 'preview', 'stop'], { cwd: STARTER, stdio: 'ignore' });
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
