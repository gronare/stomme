#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
// Astro directly, not via `pnpm run`: the package manager eats the flags and the server would start on its own port.
const ASTRO = resolve(STARTER, 'node_modules/.bin/astro');
const PORT = Number(process.env.PORT || 4399);
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
const check = (ok, name) => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}`); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUp(timeoutMs = 120000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { const r = await fetch(`${BASE}/`); if (r.status) return true; } catch {}
    await sleep(300);
  }
  return false;
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.text() };
}

async function portBusy() {
  try { await fetch(`${BASE}/`); return true; } catch { return false; }
}

let child;
try {
  if (await portBusy()) {
    console.error(`✗ something is already listening on ${BASE} — refusing to test against a server this run did not start.`);
    process.exit(1);
  }
  // Own process group: `pnpm run` is just a shell around astro, and a TERM to the shell leaves the server alive and listening.
  // ASTRO_DEV_BACKGROUND opts out of Astro's agent detection, which would otherwise detach the server into a process this run cannot kill; --ignore-lock then keeps it off the lock file a developer's own dev server owns.
  child = spawn(ASTRO, ['dev', '--port', String(PORT), '--host', '127.0.0.1', '--ignore-lock'], {
    cwd: STARTER,
    env: { ...process.env, STOMME_SLOTS_DIR: '', ASTRO_DEV_BACKGROUND: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const up = await waitUp();
  check(up, 'astro dev is serving the starter');
  if (!up) console.error(log);
  else {
    const admin = await get('/admin');
    check(admin.status === 200 && admin.body.includes('<title>Content Manager</title>'), 'GET /admin serves public/admin/index.html');

    const slash = await get('/admin/');
    check(slash.status === 200 && slash.body.includes('<title>Content Manager</title>'), 'GET /admin/ serves the same page');

    const cfg = await get('/admin/config.yml');
    check(cfg.status === 200 && cfg.body.includes('backend:'), 'GET /admin/config.yml still serves the file itself');

    const query = await get('/admin?token=abc');
    check(query.status === 200 && query.body.includes('<title>Content Manager</title>'), 'a query string does not prevent the rewrite');

    const bare = await get('/images/placeholders');
    check(bare.status === 404, 'a public directory with no index.html is not rewritten');

    const missing = await get('/no-such-page');
    check(missing.status === 404, 'an unknown address still 404s');

    const undecodable = await get('/%ZZ/admin');
    check(undecodable.status !== 200, 'a path that cannot be decoded serves no file');

    const climb = await get('/%2e%2e/public/admin');
    check(climb.status !== 200, "a path carrying '..' is never served");

    const after = await get('/admin');
    check(after.status === 200, 'the dev server still serves /admin afterwards');
  }
} finally {
  if (child?.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} } }
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ public directory-index middleware smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ public directory-index middleware intact.');
