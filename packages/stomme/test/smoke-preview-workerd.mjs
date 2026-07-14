#!/usr/bin/env node
/*
 * stomme — production-runtime smoke test for the CMS live-preview (/preview).
 *
 * WHY THIS EXISTS
 * ---------------
 * The CMS iframes `/preview?data=<base64 JSON of page blocks>`; that SSR route
 * decodes the data and renders the real block components into `#preview-root`.
 * Sites deploy to Cloudflare Pages, where SSR runs on the `workerd` runtime —
 * NOT Node. A class of bug reproduces ONLY on workerd, never on the Node dev
 * server (localhost:4321) where every other test runs:
 *
 *   `/preview` once decoded with Node's `Buffer.from(raw, 'base64')`. `Buffer`
 *   does not exist on workerd → decode threw → `#preview-root` rendered EMPTY on
 *   every deployed site. Green everywhere in dev; broken in production.
 *
 * This test closes that blind spot: it builds a real site with the Cloudflare
 * adapter (`build:cloudflare`) and serves the output on workerd locally via
 * `wrangler pages dev ./dist` (miniflare/workerd — no deploy, no CF account),
 * then asserts the preview actually renders.
 *
 * WHAT IT ASSERTS
 * ---------------
 *   CORE (hard pass/fail, no browser — gates the exit code):
 *     1. GET /preview?data=<known blocks> returns HTTP 200.
 *     2. `#preview-root` is NON-EMPTY and contains the heading we encoded
 *        (proves base64+UTF-8 decode + block render round-tripped on workerd).
 *     3. The worker logs contain no `Buffer`/`ReferenceError`/`is not defined`
 *        (the decode-threw signature).
 *
 *   CSP (optional, needs Playwright — a DETECTOR, off the exit code by default):
 *     4. Load /preview in a real browser and report Content-Security-Policy
 *        violations. `/preview` ships a strict nonce'd CSP (script-src 'self'
 *        'nonce-…', no unsafe-inline) that blocks Astro's inlined first-party
 *        component scripts (header scroll-toggle, FAQ accordion) — a known
 *        preview-interactivity regression whose fix is SEPARATE. Reported as a
 *        warning so it can't mask the core Buffer guard; pass --strict-csp to
 *        make violations fatal. Skips cleanly if Playwright isn't installed.
 *
 * USAGE
 * -----
 *   node packages/stomme/test/smoke-preview-workerd.mjs          # build + serve + assert
 *   pnpm --filter @gronare/stomme test:preview-workerd           # same, via script
 *
 *   Flags:
 *     --site <dir>    site to build/serve (repo-relative). Default: starter
 *     --port <n>      workerd port. Default: 8799
 *     --no-build      reuse an existing dist/ (must be a cloudflare build)
 *     --no-csp        skip the browser CSP detector entirely
 *     --strict-csp    make CSP violations fatal (exit 1)
 *     --csp-channel <name>  drive an installed browser instead of a downloaded
 *                     Chromium (e.g. `chrome`, `msedge`) — handy locally when
 *                     `playwright install chromium` hasn't been run
 *     --keep          leave the workerd server running after the run (debug)
 *
 * REQUIREMENTS
 * ------------
 *   The served site needs the Cloudflare adapter + wrangler as devDeps:
 *     pnpm --filter <site> add -D @astrojs/cloudflare wrangler
 *   (the `starter` site already has both). Playwright is optional and only
 *   needed for the CSP detector: `pnpm add -D playwright && npx playwright install chromium`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..'); // packages/stomme/test → repo root

// ── args ─────────────────────────────────────────────────────────────────────
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

// ── the known payload — mirrors admin/previews.js b64() EXACTLY (btoa over the
//    UTF-8 bytes of JSON.stringify), so the test exercises the real encoding the
//    CMS uses. The heading carries non-ASCII to prove UTF-8 round-trips. ───────
const MARKER = 'WORKERD-SMOKE ✓ Åäö 日本';
const BLOCKS = [{ type: 'hero', eyebrow: 'SMOKE', heading: MARKER, intro: 'preview render probe', media: 'none' }];
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

// Inner HTML of #preview-root (from its opening tag to end of doc — we only need
// to know it's non-empty and carries the marker, not to parse it).
function previewRootInner(html) {
  const m = html.match(/id="preview-root"[^>]*>([\s\S]*)/);
  return m ? m[1] : null;
}

async function main() {
  log(`site=${SITE} port=${PORT} strictCsp=${STRICT_CSP} noCsp=${NO_CSP}`);

  // 1. Build with the Cloudflare adapter (→ dist/_worker.js on workerd).
  if (!NO_BUILD) {
    log('building for cloudflare (STOMME_TARGET=cloudflare)…');
    if (!run('pnpm', ['run', 'build:cloudflare'], siteDir)) return fail('build:cloudflare failed');
  }
  if (!existsSync(resolve(distDir, '_worker.js'))) {
    return fail(`no ${SITE}/dist/_worker.js — not a Cloudflare (SSR) build. Run build:cloudflare (or drop --no-build).`);
  }

  // 2. Serve dist/ on workerd via wrangler pages dev.
  const wrangler = [resolve(siteDir, 'node_modules/.bin/wrangler'), resolve(REPO_ROOT, 'node_modules/.bin/wrangler')]
    .find(existsSync) || 'wrangler';
  log(`starting workerd: ${wrangler} pages dev dist --port ${PORT}`);
  const workerLog = [];
  child = spawn(wrangler, ['pages', 'dev', 'dist', '--port', String(PORT), '--ip', '127.0.0.1'],
    { cwd: siteDir, env: process.env });
  child.stdout.on('data', (d) => workerLog.push(d.toString()));
  child.stderr.on('data', (d) => workerLog.push(d.toString()));

  if (!(await waitFor(base + '/', 45000))) {
    console.error(workerLog.join(''));
    return fail('workerd server never became ready');
  }
  log('workerd ready');

  let ok = true;

  // ── CORE assertion 1+2: /preview renders the blocks on workerd. ─────────────
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

  // ── CORE assertion 3: no decode-threw signature in the worker logs. ─────────
  const logText = workerLog.join('');
  const badLog = logText.match(/Buffer is not defined|ReferenceError|is not defined/);
  if (badLog) ok = fail(`worker log carries a runtime error: "${badLog[0]}"`);
  else log('OK  no Buffer/ReferenceError in the worker logs');

  // ── OPTIONAL assertion 4: CSP violations (Playwright, detector). ────────────
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
