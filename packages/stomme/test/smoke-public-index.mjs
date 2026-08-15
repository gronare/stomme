#!/usr/bin/env node
/*
 * stomme — dev-server smoke for the public directory-index middleware (integration.mjs,
 * `publicIndexPlugin`). Vite's own public middleware matches exact filenames only, so a
 * DIRECTORY address out of public/ reaches neither sirv nor Astro's router: '/admin' 404s in
 * dev while the same address works in production — and both the README and create-stomme tell
 * the owner the CMS is there. The plugin rewrites '<dir>' to '<dir>/index.html' when that file
 * exists under public/, and leaves everything else to the next handler.
 *
 * Runs a real `astro dev` on the `starter` site and asks it over HTTP — the dev server is where
 * the bug lives, so nothing below is a stand-in for it. No build, no browser.
 * Run with:  pnpm --filter @gronare/stomme test:public-index
 *
 * ASSERTS
 *   1. GET /admin serves public/admin/index.html (the CMS opens on the address we document).
 *   2. GET /admin/ (the trailing-slash address the dev server redirects to) does the same.
 *   3. GET /admin/config.yml still serves the file itself — the rewrite takes no exact hit away.
 *   4. A query string does not prevent the rewrite (?token=… is how the CMS comes back from OAuth).
 *   5. A public directory with no index.html (/images/placeholders) is NOT rewritten — 404,
 *      never a directory listing.
 *   6. An unknown address still 404s, so the middleware invents no pages.
 *   7. A path that cannot be decoded, and one carrying '..', are handed on rather than served —
 *      and the server keeps serving afterwards.
 *
 * The port is checked free first and the dev server is started in its own process group: a
 * stranger already listening — or a leftover server from an earlier run — would answer every
 * assertion here and make the run meaningless.
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
// Astro direkt, inte via `pnpm run`: pakethanteraren äter flaggorna och servern hade startat på sin egen port.
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

// Följer omdirigeringen: dev-servern skickar '/admin' vidare till '/admin/', och det är den adressen mellanvaran svarar på.
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
  // Egen processgrupp: `pnpm run` är bara ett skal runt astro, och en TERM till skalet lämnar servern kvar och lyssnande.
  child = spawn(ASTRO, ['dev', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: STARTER,
    env: { ...process.env, STOMME_SLOTS_DIR: '' },
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
