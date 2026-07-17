// Sveltia DOM contract test — the CI guard for editor-UX upgrades.
//
// The editor theme (THEME_CSS in gen-admin-blocks.mjs) and enhancements
// (admin/editor.js) target UNDOCUMENTED Sveltia internals — class names, ARIA
// state, DOM structure. A Sveltia bump can silently change those and break the
// editor with no build error. This renders the real generated admin headlessly
// via the test-repo backend (no auth / no folder-pick; pixels + login are the
// wrong tool, per the design) and asserts every selector our CSS/JS relies on
// still resolves — plus that editor.js still binds (draggable arming,
// click-to-expand) against the live DOM. Any miss ⇒ non-zero exit ⇒ red PR.
//
// Honors STOMME_SVELTIA_SRC, so a pin-bump can be dry-run:
//   STOMME_SVELTIA_SRC=https://unpkg.com/@sveltia/cms@X.Y.Z/dist/sveltia-cms.js \
//     pnpm --filter @gronare/stomme test:admin-contract
// See Resources/stomme-sveltia-upgrade-risks.md for the coupling this protects.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, cpSync, rmSync, mkdtempSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const starter = resolve(here, '../../../starter');
const PORT = process.env.PORT || 4577;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.yml': 'text/yaml', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

// 1. Generate the starter admin, then copy it with the backend swapped to
//    test-repo (in-memory, no auth) so a headless browser can open entries.
console.log('· generating starter admin (cms:gen)…');
execFileSync('pnpm', ['run', 'cms:gen'], { cwd: starter, stdio: 'inherit' });
const srcAdmin = join(starter, 'public/admin');
if (!existsSync(join(srcAdmin, 'config.yml'))) { console.error('✗ no starter admin generated'); process.exit(1); }
// Serve under /admin/ — index.html references its assets (stomme-editor.js,
// stomme-theme.css) by absolute /admin/ paths, exactly as deployed.
const root = mkdtempSync(join(tmpdir(), 'stomme-admin-'));
cpSync(srcAdmin, join(root, 'admin'), { recursive: true });
{
  const p = join(root, 'admin/config.yml');
  const s = readFileSync(p, 'utf8').replace(/^backend:\n(?:  .*\n)+/m, 'backend:\n  name: test-repo\n');
  writeFileSync(p, s);
}

const srv = http.createServer((req, res) => {
  let f = join(root, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'text/plain' });
  res.end(readFileSync(f));
});
await new Promise((r) => srv.listen(PORT, r));

let browser;
const results = [];
const check = async (name, fn) => {
  try { const ok = await fn(); results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}`); }
  catch (e) { results.push([false, name]); console.log(`✗ ${name} — ${String(e.message).split('\n')[0]}`); }
};
const has = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  // Enter the test repo (Sveltia's no-auth login button).
  await page.goto(`http://localhost:${PORT}/admin/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /test repository/i.test(b.textContent || '')), null, { timeout: 30000 });
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => /test repository/i.test(b.textContent || '')).click(); });
  await page.waitForSelector('[role=listbox]', { timeout: 30000 });

  // The engine assets must actually load — a 404 here silently disables the
  // theme + enhancements and would make later checks lie about the cause.
  await check('stomme-editor.js + stomme-theme.css load (no 404)', () => page.evaluate(() => {
    const css = [...document.styleSheets].some((s) => (s.href || '').includes('stomme-theme.css') && s.cssRules.length > 0);
    return css && !!document.querySelector('script[src*="stomme-editor.js"]');
  }));

  // ---- Share-cards pane first (read-only; a dirty draft can block later navs) ----
  await page.evaluate(() => { location.hash = '#/collections/settings/entries/sharecards'; });
  await page.waitForSelector('section.field[data-key-path="og"]', { timeout: 30000 });
  await check('share-cards wrapper ([data-key-path="og"])', () => has(page, 'section.field[data-field-type=object][data-key-path="og"]'));
  await check('master toggle ([data-key-path="og.enabled"] boolean)', () => has(page, 'section.field[data-field-type=boolean][data-key-path="og.enabled"]'));

  // ---- A new page entry: object widget + the variable-type sections list ----
  await page.evaluate(() => { location.hash = '#/collections/pages/new'; });
  await page.waitForSelector('section.field[data-field-type=list]', { timeout: 30000 });
  await page.waitForTimeout(500);

  await check('field carries data-field-type', () => has(page, 'section.field[data-field-type]'));
  await check('field carries data-key-path', () => has(page, 'section.field[data-key-path]'));
  await check('object widget renders', () => has(page, 'section.field[data-field-type=object]'));
  await check('object → .field-wrapper > .wrapper', () => has(page, 'section.field[data-field-type=object] > .field-wrapper > .wrapper'));
  await check('object child fields (.wrapper > .item-list > section.field, after expand)', async () => {
    // Children render only while expanded; the disclosure path is the same one
    // editor.js objectToggle() drives.
    await page.evaluate(() => {
      const b = document.querySelector('section.field[data-field-type=object] > .field-wrapper > .wrapper > .header button[aria-expanded="false"]');
      if (b) b.click();
    });
    await page.waitForFunction(() => document.querySelector('section.field[data-field-type=object] > .field-wrapper > .wrapper > .item-list > section.field'), null, { timeout: 5000 });
    return true;
  });
  await check('object label bar (> header h4)', () => has(page, 'section.field[data-field-type=object] > header h4'));
  await check('list widget renders', () => has(page, 'section.field[data-field-type=list]'));
  await check('list toolbar chevron (.sui.group > .inner > .toolbar.top > button[aria-expanded])', () =>
    has(page, 'section.field[data-field-type=list] > .field-wrapper > .sui.group > .inner > .toolbar.top > button[aria-expanded]'));

  // Add a block: the Add button opens ITS popup (aria-controls) with one
  // role=menuitem per block type — never match popups globally (the command
  // palette / collection nav are role=option listboxes and shadow it).
  await check('add-item picker opens (aria-controls popup, role=menuitem types)', async () => {
    const id = await page.evaluate(() => {
      const list = document.querySelector('section.field[data-field-type=list]');
      const add = [...(list?.querySelectorAll(':scope > .field-wrapper button') || [])]
        .find((b) => /\badd\b/i.test(b.textContent || '') && b.getAttribute('aria-controls') && !b.closest('.item'));
      if (!add) return null;
      add.click();
      return add.getAttribute('aria-controls');
    });
    if (!id) return false;
    await page.waitForFunction((pid) => document.getElementById(pid)?.querySelector('button[role=menuitem]'), id, { timeout: 10000 });
    await page.evaluate((pid) => { document.getElementById(pid).querySelector('button[role=menuitem]').click(); }, id);
    await page.waitForSelector('section.field[data-field-type=list] .item', { timeout: 10000 });
    return true;
  });

  await check('list item (.item) renders', () => has(page, 'section.field[data-field-type=list] .item'));
  await check('variable-type pill (.item > .header .type)', () => has(page, '.item > .header .type'));
  await check('item disclosure (.header > div:first-child > button[aria-expanded])', () => has(page, '.item > .header > div:first-child > button[aria-expanded]'));
  await check('item body (.item-body)', () => has(page, '.item > .item-body'));
  await check('move buttons (arrow_upward/arrow_downward icons)', () => page.evaluate(() =>
    [...document.querySelectorAll('.item > .header button .material-symbols-outlined')].some((i) => /^arrow_(up|down)ward$/.test((i.textContent || '').trim()))));
  await check('editor.js binds (draggable armed on the item)', () =>
    page.waitForFunction(() => document.querySelector('.item[draggable]'), null, { timeout: 5000 }).then(() => true));
  await check('collapse via disclosure → .item-body > .summary renders', async () => {
    await page.evaluate(() => {
      const b = document.querySelector('.item > .header > div:first-child > button[aria-expanded="true"]');
      if (b) b.click();
    });
    await page.waitForFunction(() => document.querySelector('.item > .header > div:first-child > button[aria-expanded="false"]'), null, { timeout: 5000 });
    return has(page, '.item > .item-body > .summary');
  });
  await check('editor.js click-to-expand (row click flips aria-expanded)', async () => {
    // Synthetic click on the collapsed row (target = the item, not a control):
    // editor.js must translate it into the disclosure's own click.
    await page.evaluate(() => { document.querySelector('section.field[data-field-type=list] .item').click(); });
    await page.waitForFunction(() => document.querySelector('.item > .header > div:first-child > button[aria-expanded="true"]'), null, { timeout: 5000 });
    return true;
  });

  // ---- Form confirmation pane: boolean switch + optional-object "Add" checkbox ----
  await page.evaluate(() => { location.hash = '#/collections/settings/entries/thanks'; });
  await page.waitForSelector('section.field[data-field-type=boolean]', { timeout: 30000 });
  await page.waitForTimeout(500);

  await check('boolean widget renders', () => has(page, 'section.field[data-field-type=boolean]'));
  await check('boolean one-row parts (> header, > .field-wrapper)', () =>
    has(page, 'section.field[data-field-type=boolean] > header').then(async (a) => a && has(page, 'section.field[data-field-type=boolean] > .field-wrapper')));
  await check('boolean control is [role=switch]', () => has(page, 'section.field[data-field-type=boolean] [role=switch]'));
  await check('boolean toggles aria-checked="true"', async () => {
    const sw = page.locator('section.field[data-field-type=boolean] [role=switch]').first();
    const was = await sw.getAttribute('aria-checked');
    await sw.click();
    await page.waitForTimeout(300);
    const now = await sw.getAttribute('aria-checked');
    await sw.click(); // restore
    return was === 'true' ? now !== 'true' : now === 'true';
  });
  await check('optional-object "Add" checkbox (> .field-wrapper > .sui.checkbox)', () => has(page, 'section.field[data-field-type=object] > .field-wrapper > .sui.checkbox'));
  await check('optional-object toggle is button[role=checkbox][aria-checked]', () => has(page, '.sui.checkbox .inner > button[role=checkbox][aria-checked]'));
  await check('optional-object ADDED state gains > .field-wrapper > .wrapper', async () => {
    // OPT_OFF detection in the CSS/JS: unadded has no .wrapper; checking adds it.
    const hit = await page.evaluate(() => {
      const f = [...document.querySelectorAll('section.field[data-field-type=object]')]
        .find((o) => o.querySelector(':scope > .field-wrapper > .sui.checkbox .inner > button[role=checkbox][aria-checked="false"]')
          && !o.querySelector(':scope > .field-wrapper > .wrapper'));
      if (!f) return null;
      f.setAttribute('data-stomme-probe', '1');
      f.querySelector(':scope > .field-wrapper > .sui.checkbox .inner > button[role=checkbox]').click();
      return true;
    });
    if (!hit) return false;
    await page.waitForFunction(() => document.querySelector('[data-stomme-probe] > .field-wrapper > .wrapper'), null, { timeout: 5000 });
    return true;
  });
} finally {
  if (browser) await browser.close();
  srv.close();
  try { rmSync(root, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} contract checks passed`);
if (failed.length) {
  console.error(`\n✗ Sveltia DOM contract BROKEN — ${failed.length} check(s) our editor CSS/JS rely on no longer hold:`);
  for (const [, name] of failed) console.error(`   · ${name}`);
  console.error('\nA Sveltia upgrade likely changed the editor DOM. Re-check THEME_CSS + admin/editor.js against the new structure (see Resources/stomme-sveltia-upgrade-risks.md).');
  process.exit(1);
}
console.log('✓ Sveltia DOM contract intact.');
