#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const SITE = opt('--site', 'starter');
const PORT = Number(opt('--port', '8799'));
const NO_BUILD = flag('--no-build');
const NO_CSP = flag('--no-csp');
const STRICT_CSP = flag('--strict-csp');
const CSP_CHANNEL = opt('--csp-channel', '');
const KEEP = flag('--keep');

const siteDir = resolve(REPO_ROOT, SITE);
const distDir = resolve(siteDir, 'dist');
const wranglerConfig = resolve(distDir, 'server/wrangler.json');
const workerEntry = resolve(distDir, 'server/entry.mjs');
const clientDir = resolve(distDir, 'client');
const base = `http://127.0.0.1:${PORT}`;

// Mirrors admin/previews.js b64() EXACTLY (btoa over the UTF-8 bytes of JSON.stringify), and the marker carries non-ASCII so a broken UTF-8 round-trip shows.
const MARKER = 'WORKERD-SMOKE ✓ Åäö 日本';
const BLOCKS = [{ type: 'hero', eyebrow: 'SMOKE', heading: MARKER, intro: 'preview render probe', media: { kind: 'none' } }];
function b64(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
const DATA = b64(BLOCKS);

const log = (...a) => console.log('[smoke]', ...a);
const fail = (msg) => { console.error('\n[smoke] FAIL:', msg); return false; };
let child = null;
// Own process group: wrangler forks workerd, and a TERM to wrangler alone leaves workerd holding the port.
const cleanup = () => {
  if (!child || KEEP) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

function run(cmd, cmdArgs, cwd) {
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', env: process.env });
  return r.status === 0;
}

async function waitFor(url, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function portBusy() {
  try { await fetch(base + '/'); return true; } catch { return false; }
}

function mainInner(html) {
  const m = html.match(/<main[^>]*>([\s\S]*)<\/main>/);
  return m ? m[1] : null;
}

async function main() {
  log(`site=${SITE} port=${PORT} strictCsp=${STRICT_CSP} noCsp=${NO_CSP}`);

  // Without this the run passes against a leftover server: wrangler fails to bind, and every assertion below reads a stale build.
  if (await portBusy()) return fail(`something is already listening on ${base} — refusing to test against a server this run did not start.`);

  if (!NO_BUILD) {
    log('building for cloudflare (STOMME_TARGET=cloudflare)…');
    if (!run('pnpm', ['run', 'build:cloudflare'], siteDir)) return fail('build:cloudflare failed');
  }
  for (const [path, what] of [[workerEntry, 'server/entry.mjs'], [wranglerConfig, 'server/wrangler.json'], [clientDir, 'client/']]) {
    if (!existsSync(path)) {
      return fail(`no ${SITE}/dist/${what} — not a Cloudflare (Workers) build. Run build:cloudflare (or drop --no-build).`);
    }
  }

  const wrangler = [resolve(siteDir, 'node_modules/.bin/wrangler'), resolve(REPO_ROOT, 'node_modules/.bin/wrangler')]
    .find(existsSync) || 'wrangler';
  log(`starting workerd: ${wrangler} dev --config dist/server/wrangler.json --port ${PORT}`);
  const workerLog = [];
  child = spawn(wrangler, ['dev', '--config', wranglerConfig, '--port', String(PORT), '--ip', '127.0.0.1'],
    { cwd: siteDir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  child.stdout.on('data', (d) => workerLog.push(d.toString()));
  child.stderr.on('data', (d) => workerLog.push(d.toString()));

  if (!(await waitFor(base + '/', 45000))) {
    console.error(workerLog.join(''));
    return fail('workerd server never became ready');
  }
  log('workerd ready');

  let ok = true;

  const res = await fetch(`${base}/preview?data=${DATA}`);
  const html = await res.text();
  if (res.status !== 200) ok = fail(`/preview returned HTTP ${res.status} (expected 200)`);

  const inner = mainInner(html);
  if (inner === null) {
    ok = fail('no <main> in the response');
  } else if (!inner.trim()) {
    ok = fail('<main> is EMPTY — decode/render failed on workerd (the Buffer-on-workerd signature)');
  } else if (!inner.includes(MARKER)) {
    ok = fail(`<main> is non-empty but does not contain the encoded heading ("${MARKER}") — decode drift`);
  } else {
    log('OK  /preview 200, <main> non-empty and contains the encoded heading (UTF-8 round-trip)');
  }

  // A wrapper around the blocks makes the preview DOM main > div > section where a real page is main > section, so every structural selector a site writes (main > .section[data-stomme-block], :first-child) misses in the editor only.
  if (inner !== null && inner.trim()) {
    if (!/^\s*<section[\s>]/.test(inner)) {
      ok = fail(`the first block is NOT a direct child of <main> — something wraps it: "${inner.trim().slice(0, 80)}…"`);
    } else {
      log('OK  the first block\'s <section> is a direct child of <main> (structural parity with a real page)');
    }
  }

  const THANKS_HEADING = 'WORKERD-SMOKE thanks Åäö';
  const THANKS = b64({ heading: THANKS_HEADING, message: 'The confirmation lead line.', button: { label: 'Home', link: { page: '/' } } });
  const thanksRes = await fetch(`${base}/preview?kind=thanks&data=${THANKS}`);
  const thanksInner = mainInner(await thanksRes.text());
  if (thanksRes.status !== 200 || !thanksInner) {
    ok = fail(`/preview?kind=thanks returned HTTP ${thanksRes.status} with ${thanksInner ? 'a' : 'no'} <main>`);
  } else if (!thanksInner.includes(THANKS_HEADING)) {
    ok = fail('the thanks preview does not carry the posted draft heading — the pane\'s own copy stopped flowing through');
  } else if (!thanksInner.includes('anna@example.com')) {
    ok = fail('the thanks recap carries no sample sender — the site\'s contactForm blocks were not read (getCollection on workerd)');
  } else if (thanksInner.includes('hello@example.com') || thanksInner.includes('+1 555 0100')) {
    ok = fail('the thanks recap shows the SITE\'s own contact details as if a visitor had typed them');
  } else if (thanksInner.includes('data-form-picker')) {
    ok = fail('a site with one contact form must get no form picker');
  } else {
    log('OK  /preview?kind=thanks renders the draft copy with a sample receipt built from the site\'s own form');
  }

  const logText = workerLog.join('');
  const badLog = logText.match(/Buffer is not defined|ReferenceError|is not defined/);
  if (badLog) ok = fail(`worker log carries a runtime error: "${badLog[0]}"`);
  else log('OK  no Buffer/ReferenceError in the worker logs');

  if (!NO_CSP) {
    let pw = null;
    try { pw = (await import('playwright')).chromium; }
    catch { log('SKIP CSP check — Playwright not installed (pnpm add -D playwright && npx playwright install chromium)'); }
    if (pw) {
      let browser;
      try {
        browser = await pw.launch(CSP_CHANNEL ? { channel: CSP_CHANNEL } : {});
        const page = await (await browser.newContext()).newPage();
        const violations = [];
        await page.addInitScript(() => {
          window.__csp = [];
          document.addEventListener('securitypolicyviolation', (e) =>
            window.__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI, sample: (e.sample || '').slice(0, 80) }));
        });
        page.on('console', (m) => { if (/content security policy|refused to (execute|load|apply)/i.test(m.text())) violations.push({ directive: 'console', blocked: m.text().slice(0, 140) }); });
        await page.goto(`${base}/preview?data=${DATA}`, { waitUntil: 'networkidle' });
        const inPage = await page.evaluate(() => window.__csp || []);
        const all = [...violations, ...inPage];
        if (all.length === 0) {
          log('OK  no CSP violations in /preview');
        } else {
          const label = STRICT_CSP ? 'FAIL' : 'WARN';
          console[STRICT_CSP ? 'error' : 'warn'](`[smoke] ${label} CSP: ${all.length} violation(s) on /preview (blocked scripts break preview interactivity):`);
          for (const v of all) console[STRICT_CSP ? 'error' : 'warn']('   -', JSON.stringify(v));
          if (STRICT_CSP) ok = false;
        }
      } catch (e) {
        log('SKIP CSP check —', e.message.split('\n')[0], '(install a browser: npx playwright install chromium)');
      } finally { if (browser) await browser.close(); }
    }
  }

  return ok;
}

main().then((ok) => {
  cleanup();
  console.log(ok ? '\n[smoke] PASS' : '\n[smoke] FAILED');
  process.exit(ok ? 0 : 1);
}).catch((e) => {
  cleanup();
  console.error('[smoke] crashed:', e);
  process.exit(1);
});
