#!/usr/bin/env node
// Flags: --site <dir> (default starter) · --port <n> (8799) · --no-build (reuse an existing cloudflare dist/) · --no-csp (skip the browser detector) · --strict-csp (violations exit 1) · --csp-channel <name> (use an installed browser instead of downloaded Chromium) · --keep (leave workerd up) · --ip / --compatibility-date.
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
const cleanup = () => { if (child && !KEEP) { try { child.kill('SIGTERM'); } catch {} } };
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

// From the opening tag to end of doc — enough to know it's non-empty and carries the marker, no parsing needed.
function previewRootInner(html) {
  const m = html.match(/id="preview-root"[^>]*>([\s\S]*)/);
  return m ? m[1] : null;
}

async function main() {
  log(`site=${SITE} port=${PORT} strictCsp=${STRICT_CSP} noCsp=${NO_CSP}`);

  if (!NO_BUILD) {
    log('building for cloudflare (STOMME_TARGET=cloudflare)…');
    if (!run('pnpm', ['run', 'build:cloudflare'], siteDir)) return fail('build:cloudflare failed');
  }
  if (!existsSync(resolve(distDir, '_worker.js'))) {
    return fail(`no ${SITE}/dist/_worker.js — not a Cloudflare (SSR) build. Run build:cloudflare (or drop --no-build).`);
  }

  const wrangler = [resolve(siteDir, 'node_modules/.bin/wrangler'), resolve(REPO_ROOT, 'node_modules/.bin/wrangler')]
    .find(existsSync) || 'wrangler';
  // Pin a supported compatibility date: `wrangler pages dev` otherwise defaults to today, which the bundled workerd binary (a day or two behind the calendar) rejects — a calendar-triggered CI failure.
  const compatDate = process.env.SMOKE_COMPAT_DATE || '2025-11-01';
  log(`starting workerd: ${wrangler} pages dev dist --port ${PORT} --compatibility-date ${compatDate}`);
  const workerLog = [];
  child = spawn(wrangler, ['pages', 'dev', 'dist', '--port', String(PORT), '--ip', '127.0.0.1',
    '--compatibility-date', compatDate],
    { cwd: siteDir, env: process.env });
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

  const inner = previewRootInner(html);
  if (inner === null) {
    ok = fail('no #preview-root in the response');
  } else if (/^\s*<\/div>/.test(inner)) {
    ok = fail('#preview-root is EMPTY — decode/render failed on workerd (the Buffer-on-workerd signature)');
  } else if (!inner.includes(MARKER)) {
    ok = fail(`#preview-root is non-empty but does not contain the encoded heading ("${MARKER}") — decode drift`);
  } else {
    log('OK  /preview 200, #preview-root non-empty and contains the encoded heading (UTF-8 round-trip)');
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
        // securitypolicyviolation fires in-page for every blocked resource/script.
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
