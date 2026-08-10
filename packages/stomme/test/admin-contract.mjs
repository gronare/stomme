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
  // Tall viewport: Sveltia lazy-mounts offscreen fields as placeholders — below-the-fold
  // widgets (share-card type cards, optional groups) must be mounted for the checks.
  const page = await browser.newPage({ viewport: { width: 1280, height: 2600 } });

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

  // Gated switch-cards (editor.js .stomme-open): the enable switch and the open/closed
  // UI state are INDEPENDENT gestures — closed by default, a card click toggles open,
  // the switch only flips `enabled`. The starter's gated object is the contact `away`
  // banner (og.types.* only exists on sites with item collections).
  // Bounce via the collection list: a settings→settings hash hop (sharecards→contact)
  // does not re-render the editor pane (SPA router quirk) and leaves it blank.
  await page.evaluate(() => { location.hash = '#/collections/settings'; });
  await page.waitForTimeout(800);
  await page.evaluate(() => { location.hash = '#/collections/settings/entries/contact'; });
  await page.waitForSelector('section.field[data-key-path="phone"]', { timeout: 30000 });
  await check('gated card: closed by default, card click opens/closes (.stomme-open)', async () => {
    // Sveltia lazy-mounts offscreen fields as placeholders — scroll the pane down until
    // the away card and its gate switch are mounted.
    for (let i = 0; i < 20; i++) {
      const ok = await page.evaluate(() => {
        if (document.querySelector('section.field[data-key-path="away.enabled"] [role=switch]')) return true;
        let n = document.querySelector('section.field[data-key-path="phone"]');
        while (n && n.scrollHeight <= n.clientHeight + 1) n = n.parentElement;
        if (n) n.scrollTop = n.scrollHeight;
        const away = document.querySelector('section.field[data-key-path="away"]');
        if (away) away.scrollIntoView({ block: 'center' });
        return false;
      });
      if (ok) break;
      await page.waitForTimeout(500);
    }
    await page.waitForFunction(() => document.querySelector('section.field[data-key-path="away.enabled"] [role=switch]'), null, { timeout: 10000 });
    await page.waitForTimeout(400);
    const startOpen = await page.evaluate(() => document.querySelector('section.field[data-key-path="away"]').classList.contains('stomme-open'));
    if (startOpen) return false; // must start closed
    const clickHeader = () => page.evaluate(() => {
      const f = document.querySelector('section.field[data-key-path="away"]');
      f.querySelector(':scope > header').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await clickHeader();
    await page.waitForTimeout(300);
    const opened = await page.evaluate(() => document.querySelector('section.field[data-key-path="away"]').classList.contains('stomme-open'));
    await clickHeader();
    await page.waitForTimeout(300);
    const closed = await page.evaluate(() => !document.querySelector('section.field[data-key-path="away"]').classList.contains('stomme-open'));
    return opened && closed;
  });
  await check('gated card: the switch flips enabled without touching .stomme-open', async () => {
    const res = await page.evaluate(() => {
      const f = document.querySelector('section.field[data-key-path="away"]');
      const sw = f.querySelector('section.field[data-key-path="away.enabled"] [role=switch]');
      const openBefore = f.classList.contains('stomme-open');
      const was = sw.getAttribute('aria-checked') === 'true';
      sw.click();
      return { openBefore, was };
    });
    await page.waitForTimeout(300);
    return page.evaluate(({ openBefore, was }) => {
      const f = document.querySelector('section.field[data-key-path="away"]');
      const sw = f.querySelector('section.field[data-key-path="away.enabled"] [role=switch]');
      const flipped = (sw.getAttribute('aria-checked') === 'true') !== was;
      const openSame = f.classList.contains('stomme-open') === openBefore;
      sw.click(); // restore
      return flipped && openSame;
    }, res);
  });

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
  // The exact selector THEME_CSS hides. Its depth inside .toolbar.top varies by Sveltia
  // version (a direct child beside .summary, or nested in a .label group), hence the
  // descendant match. The toolbar's Add button ALSO carries aria-expanded, so the rule
  // excludes menu buttons — the second half asserts that exclusion still separates the two
  // (exactly one chevron matched, the Add button not), or the CSS silently hides "Add" and
  // the list can no longer be filled.
  await check('list toolbar chevron (.toolbar.top disclosure, not the Add menu button)', async () =>
    (await has(page, 'section.field[data-field-type=list] > .field-wrapper > .sui.group > .inner > .toolbar.top button[aria-expanded]:not([aria-haspopup])'))
    && (await page.evaluate(() => {
      // Across the list's own toolbars: Add sits either in a sibling .toolbar.top.add or in
      // an .actions group inside the one toolbar — both are in the CSS rule's scope.
      const inner = document.querySelector('section.field[data-field-type=list] > .field-wrapper > .sui.group > .inner');
      const bars = [...inner.querySelectorAll(':scope > .toolbar')];
      const chevrons = bars.flatMap((b) => [...b.querySelectorAll('button[aria-expanded]:not([aria-haspopup])')]);
      const menus = bars.flatMap((b) => [...b.querySelectorAll('button[aria-haspopup=menu]')]);
      return chevrons.length === 1 && menus.length === 1;
    })));

  // Add a block: the list's own Add button (aria-haspopup=menu, never a row button) opens a
  // menu with one role=menuitem per block type. 0.176 named that popup via aria-controls;
  // 0.184 dropped the attribute and renders a plain [role=menu] — so resolve the popup by
  // aria-controls when it is there and fall back to the open menu that holds the items.
  // Still never a global [role=option] match: the command palette and collection nav are
  // listboxes and would shadow it.
  await check('add-item picker opens (menu button → role=menuitem types)', async () => {
    const id = await page.evaluate(() => {
      const list = document.querySelector('section.field[data-field-type=list]');
      const add = [...(list?.querySelectorAll(':scope > .field-wrapper button[aria-haspopup=menu]') || [])]
        .find((b) => !b.closest('.item'));
      if (!add) return null;
      add.click();
      return add.getAttribute('aria-controls') || '';
    });
    if (id === null) return false;
    await page.waitForFunction((pid) => {
      const host = pid ? document.getElementById(pid) : null;
      const scope = host || [...document.querySelectorAll('[role=menu]')].find((m) => m.querySelector('button[role=menuitem]'));
      return !!scope?.querySelector('button[role=menuitem]');
    }, id, { timeout: 10000 });
    await page.evaluate((pid) => {
      const host = pid ? document.getElementById(pid) : null;
      const scope = host || [...document.querySelectorAll('[role=menu]')].find((m) => m.querySelector('button[role=menuitem]'));
      scope.querySelector('button[role=menuitem]').click();
    }, id);
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
  await check('optional-object: added state starts COLLAPSED, card click toggles both ways', async () => {
    // The switch only adds/removes; no auto-expand (editor.js) + collapsed:true emitted.
    const disc = () => page.evaluate(() => {
      const b = document.querySelector('[data-stomme-probe] > .field-wrapper > .wrapper > .header > div:first-child > button[aria-expanded]');
      return b && b.getAttribute('aria-expanded');
    });
    await page.waitForFunction(() => document.querySelector('[data-stomme-probe] > .field-wrapper > .wrapper > .header > div:first-child > button[aria-expanded]'), null, { timeout: 5000 });
    if (await disc() !== 'false') return false;
    const clickRow = () => page.evaluate(() => {
      const f = document.querySelector('[data-stomme-probe]');
      f.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await clickRow();
    await page.waitForTimeout(300);
    const opened = await disc() === 'true';
    await clickRow();
    await page.waitForTimeout(300);
    const closed = await disc() === 'false';
    return opened && closed;
  });
} finally {
  if (browser) await browser.close();
  srv.close();
  try { rmSync(root, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} contract checks passed`);
// Names stay in RUN ORDER: one broken step cascades (no list row ⇒ every row check after it fails), and only the order separates a root cause from its fallout. Opt-in — no env, no file.
if (process.env.STOMME_CONTRACT_REPORT) {
  writeFileSync(process.env.STOMME_CONTRACT_REPORT, JSON.stringify({
    passed: results.length - failed.length, total: results.length, failed: failed.map(([, name]) => name),
  }));
}
if (failed.length) {
  console.error(`\n✗ Sveltia DOM contract BROKEN — ${failed.length} check(s) our editor CSS/JS rely on no longer hold:`);
  for (const [, name] of failed) console.error(`   · ${name}`);
  console.error('\nA Sveltia upgrade likely changed the editor DOM. Re-check THEME_CSS + admin/editor.js against the new structure (see Resources/stomme-sveltia-upgrade-risks.md).');
  process.exit(1);
}
console.log('✓ Sveltia DOM contract intact.');
