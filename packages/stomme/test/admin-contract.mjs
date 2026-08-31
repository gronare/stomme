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

console.log('· generating starter admin (cms:gen)…');
execFileSync('pnpm', ['run', 'cms:gen'], { cwd: starter, stdio: 'inherit' });
const srcAdmin = join(starter, 'public/admin');
if (!existsSync(join(srcAdmin, 'config.yml'))) { console.error('✗ no starter admin generated'); process.exit(1); }
// Served under /admin/ because index.html references stomme-editor.js + stomme-theme.css by absolute /admin/ paths, exactly as deployed.
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
  try {
    const r = await fn();
    const why = typeof r === 'string' ? r : '';
    const ok = !why && !!r;
    results.push([ok, name, why]);
    console.log(`${ok ? '✓' : '✗'} ${name}${why ? ` — ${why}` : ''}`);
  } catch (e) { const why = String(e.message).split('\n')[0]; results.push([false, name, why]); console.log(`✗ ${name} — ${why}`); }
};
const has = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
let optKeys = [];

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  // Tall viewport: Sveltia lazy-mounts offscreen fields as placeholders, and the checks need them mounted.
  const page = await browser.newPage({ viewport: { width: 1280, height: 2600 } });

  await page.goto(`http://localhost:${PORT}/admin/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /test repository/i.test(b.textContent || '')), null, { timeout: 30000 });
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => /test repository/i.test(b.textContent || '')).click(); });
  await page.waitForSelector('[role=listbox]', { timeout: 30000 });

  // A 404 here silently disables the theme + enhancements and would make every later check lie about the cause.
  await check('stomme-editor.js + stomme-theme.css load (no 404)', () => page.evaluate(() => {
    const css = [...document.styleSheets].some((s) => (s.href || '').includes('stomme-theme.css') && s.cssRules.length > 0);
    return css && !!document.querySelector('script[src*="stomme-editor.js"]');
  }));

  // Share-cards first: the pane is read-only, and a dirty draft blocks later navigations.
  await page.evaluate(() => { location.hash = '#/collections/settings/entries/sharecards'; });
  await page.waitForSelector('section.field[data-key-path="og"]', { timeout: 30000 });
  await check('share-cards wrapper ([data-key-path="og"])', () => has(page, 'section.field[data-field-type=object][data-key-path="og"]'));
  await check('master toggle ([data-key-path="og.enabled"] boolean)', () => has(page, 'section.field[data-field-type=boolean][data-key-path="og.enabled"]'));

  // Bounce via the collection list: a settings→settings hash hop does not re-render the editor pane (SPA router quirk) and leaves it blank.
  await page.evaluate(() => { location.hash = '#/collections/settings'; });
  await page.waitForTimeout(800);
  await page.evaluate(() => { location.hash = '#/collections/settings/entries/contact'; });
  await page.waitForSelector('section.field[data-key-path="phone"]', { timeout: 30000 });
  await check('gated card: closed by default, card click opens/closes (.stomme-open)', async () => {
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
    if (startOpen) return false;
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
      sw.click();
      return flipped && openSame;
    }, res);
  });

  await page.evaluate(() => { location.hash = '#/collections/pages/new'; });
  await page.waitForSelector('section.field[data-field-type=list]', { timeout: 30000 });
  await page.waitForTimeout(500);

  await check('field carries data-field-type', () => has(page, 'section.field[data-field-type]'));
  await check('field carries data-key-path', () => has(page, 'section.field[data-key-path]'));
  await check('object widget renders', () => has(page, 'section.field[data-field-type=object]'));
  await check('object → .field-wrapper > .wrapper', () => has(page, 'section.field[data-field-type=object] > .field-wrapper > .wrapper'));
  await check('object child fields (.wrapper > .item-list > section.field, after expand)', async () => {
    // Children render only while expanded, and this disclosure path is the one editor.js objectToggle() drives.
    await page.evaluate(() => {
      const b = document.querySelector('section.field[data-field-type=object] > .field-wrapper > .wrapper > .header button[aria-expanded="false"]');
      if (b) b.click();
    });
    await page.waitForFunction(() => document.querySelector('section.field[data-field-type=object] > .field-wrapper > .wrapper > .item-list > section.field'), null, { timeout: 5000 });
    return true;
  });
  await check('object label bar (> header h4)', () => has(page, 'section.field[data-field-type=object] > header h4'));
  await check('list widget renders', () => has(page, 'section.field[data-field-type=list]'));
  // THEME_CSS hides this chevron, and the Add button also carries aria-expanded, so the rule excludes menu buttons — the second half asserts exactly one chevron and one menu button, or the CSS silently hides "Add" and the list can never be filled.
  await check('list toolbar chevron (.toolbar.top disclosure, not the Add menu button)', async () =>
    (await has(page, 'section.field[data-field-type=list] > .field-wrapper > .sui.group > .inner > .toolbar.top button[aria-expanded]:not([aria-haspopup])'))
    && (await page.evaluate(() => {
      const inner = document.querySelector('section.field[data-field-type=list] > .field-wrapper > .sui.group > .inner');
      const bars = [...inner.querySelectorAll(':scope > .toolbar')];
      const chevrons = bars.flatMap((b) => [...b.querySelectorAll('button[aria-expanded]:not([aria-haspopup])')]);
      const menus = bars.flatMap((b) => [...b.querySelectorAll('button[aria-haspopup=menu]')]);
      return chevrons.length === 1 && menus.length === 1;
    })));

  // 0.176 named the popup via aria-controls; 0.184 dropped it for a plain [role=menu] — resolve by aria-controls when present, else the open menu holding the items, and never a global [role=option] match (the command palette and collection nav are listboxes and would shadow it).
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
  const handleBox = () => page.evaluate(() => {
    const h = document.querySelector('section.field[data-field-type=list] .item > .header button.drag-handle[data-action="reorder"]');
    if (!h) return null;
    const r = h.getBoundingClientRect();
    const s = document.querySelector('section.field[data-field-type=list] .item > .item-body > .summary')?.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), summaryRight: s ? Math.round(s.right) : null };
  });
  await check('reorder handle (.header button.drag-handle[data-action=reorder]) renders visibly', async () => {
    const b = await handleBox();
    if (!b) return 'no > .header button.drag-handle[data-action=reorder] — Sveltia moved or renamed its reorder handle';
    return b.w > 0 && b.h > 0 ? true : `the handle renders at ${b.w}×${b.h}px — THEME_CSS hides it and the list cannot be reordered`;
  });
  await check('editor.js binds (click-to-expand armed on the item)', () =>
    page.waitForFunction(() => !!document.querySelector('section.field[data-field-type=list] .item')?.__stomme, null, { timeout: 5000 }).then(() => true));
  await check('collapse via disclosure → .item-body > .summary renders', async () => {
    await page.evaluate(() => {
      const b = document.querySelector('.item > .header > div:first-child > button[aria-expanded="true"]');
      if (b) b.click();
    });
    await page.waitForFunction(() => document.querySelector('.item > .header > div:first-child > button[aria-expanded="false"]'), null, { timeout: 5000 });
    return has(page, '.item > .item-body > .summary');
  });
  await check('collapsed one-row layout keeps the reorder handle visible, right of the summary', async () => {
    const b = await handleBox();
    if (!b) return 'the handle vanished from the collapsed row';
    if (!(b.w > 0 && b.h > 0)) return `the handle renders at ${b.w}×${b.h}px in the collapsed row`;
    if (b.summaryRight === null) return 'no .item-body > .summary to order the handle against';
    return b.left >= b.summaryRight ? true : `the handle sits at x=${b.left}, left of the summary's right edge ${b.summaryRight} — the one-row order rule no longer holds`;
  });
  await check('editor.js click-to-expand (row click flips aria-expanded)', async () => {
    await page.evaluate(() => { document.querySelector('section.field[data-field-type=list] .item').click(); });
    await page.waitForFunction(() => document.querySelector('.item > .header > div:first-child > button[aria-expanded="true"]'), null, { timeout: 5000 });
    return true;
  });

  await check('edit pane scroll container (#first|#second-pane-body > .content holding section.field)', () => page.evaluate(() => {
    const panes = ['first-pane-body', 'second-pane-body'].map((id) => document.getElementById(id)).filter(Boolean);
    if (!panes.length) return 'neither #first-pane-body nor #second-pane-body exists — the scroll sync cannot find the editor pane';
    const content = panes.map((p) => p.querySelector(':scope > .content')).filter((c) => c && c.querySelector('section.field'))[0];
    if (!content) return 'no pane has a > .content holding section.field — previews.js editContent() finds no editor to scroll';
    const oy = getComputedStyle(content).overflowY;
    return oy === 'auto' || oy === 'scroll' ? true : `the edit pane's > .content is overflow-y:${oy} — it is no longer the scroll container the sync reads and drives`;
  }));

  await check('blocks rows reachable by the scoped item path (.item-list > .item-wrapper > .item)', () => page.evaluate(() => {
    const PATH = 'section.field[data-key-path="blocks"] > .field-wrapper > .sui.group > .inner > .item-list > .item-wrapper > .item';
    const field = document.querySelector('section.field[data-key-path="blocks"]');
    if (!field) return 'no section.field[data-key-path="blocks"] — the sync has no block list to sample the editor against';
    const own = [...field.querySelectorAll('.item')].filter((i) => i.closest('section.field[data-key-path]') === field);
    if (!own.length) return 'the blocks field holds no .item — nothing to map onto a preview section';
    const scoped = [...document.querySelectorAll(PATH)];
    if (!scoped.length) return `the path yields no .item though the blocks field owns ${own.length} — previews.js BLOCK_ITEMS matches nothing and the sync falls back to proportional scrolling`;
    return scoped.length === own.length ? true : `the path yields ${scoped.length} .item(s) but the blocks field owns ${own.length} — editor rows map onto the wrong preview sections`;
  }));

  await check('preview nesting (iframe.preview > our iframe[src^="/preview"])', () => page.evaluate(() => {
    const sandbox = document.querySelector('iframe.preview');
    if (!sandbox) return 'no iframe.preview — Sveltia no longer mounts the sandbox our preview template renders into';
    let doc = null;
    try { doc = sandbox.contentDocument; } catch (e) { return `iframe.preview is not readable (${e.message}) — the sync cannot reach our /preview frame`; }
    if (!doc) return 'iframe.preview has no same-origin contentDocument — allow-same-origin is gone and FRAMES.el can never be matched against e.source';
    return doc.querySelector('iframe[src^="/preview"]') ? true : 'the sandbox holds no iframe[src^="/preview"] — liveFrame() no longer mounts our frame inside it';
  }));

  await check('editor wheel → stomme:preview-scrollto reaches our /preview frame', async () => {
    const frame = page.frames().find((f) => /\/preview(\?|$)/.test(f.url()));
    if (!frame) return 'no /preview frame under the preview sandbox — the sync has nothing to post to';
    await frame.evaluate(() => {
      window.__stommeScrollTo = [];
      window.addEventListener('message', (e) => { if (e.data && e.data.type === 'stomme:preview-scrollto') window.__stommeScrollTo.push(e.data); });
      window.top.postMessage({ type: 'stomme:preview-geometry', sections: [{ top: 0, height: 400 }, { top: 400, height: 500 }, { top: 900, height: 300 }], scrollHeight: 1200, viewport: 600 }, '*');
    });
    await page.waitForTimeout(200);
    const wheeled = await page.evaluate(() => {
      const content = ['first-pane-body', 'second-pane-body'].map((id) => document.getElementById(id)).filter(Boolean)
        .map((p) => p.querySelector(':scope > .content')).filter((c) => c && c.querySelector('section.field'))[0];
      if (!content) return false;
      (content.querySelector('section.field') || content).dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 120 }));
      return true;
    });
    if (!wheeled) return 'no edit pane to wheel over';
    await page.waitForTimeout(400);
    const got = await frame.evaluate(() => window.__stommeScrollTo || []);
    if (!got.length) return 'the wheel produced no stomme:preview-scrollto — previews.js never matched the geometry message to the mounted frame, or the pane/toggle guard now bails';
    return typeof got[0].top === 'number' ? true : `the scrollto carries top=${JSON.stringify(got[0].top)}, not a number`;
  });

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
    await sw.click();
    return was === 'true' ? now !== 'true' : now === 'true';
  });
  await check('optional-object "Add" checkbox (> .field-wrapper > .sui.checkbox)', () => has(page, 'section.field[data-field-type=object] > .field-wrapper > .sui.checkbox'));
  await check('optional-object toggle is button[role=checkbox][aria-checked]', () => has(page, '.sui.checkbox .inner > button[role=checkbox][aria-checked]'));
  await check('optional-object: the pane has optional-object cards to drive', async () => {
    const keys = await page.evaluate(() => [...document.querySelectorAll('section.field[data-field-type=object]')]
      .filter((o) => o.querySelector(':scope > .field-wrapper > .sui.checkbox .inner > button[role=checkbox][aria-checked="false"]'))
      .map((o, i) => { o.setAttribute('data-stomme-opt', String(i)); return o.getAttribute('data-key-path') || `#${i}`; }));
    optKeys = keys;
    return keys.length ? true : 'no unadded section.field[data-field-type=object] carries > .field-wrapper > .sui.checkbox .inner > button[role=checkbox] — optional objects no longer render an Add switch';
  });
  const eachCard = (fn) => async () => {
    for (let i = 0; i < optKeys.length; i++) {
      const why = await page.evaluate(([idx, key]) => {
        const f = document.querySelector(`[data-stomme-opt="${idx}"]`);
        if (!f) return `${key}: the card vanished from the DOM`;
        return null;
      }, [i, optKeys[i]]);
      if (why) return why;
      const r = await fn(i, optKeys[i]);
      if (r !== true) return `${optKeys[i]}: ${r}`;
    }
    return true;
  };
  const card = (i) => `[data-stomme-opt="${i}"]`;
  const discState = (i) => page.evaluate((s) => {
    const b = document.querySelector(`${s} > .field-wrapper > .wrapper > .header > div:first-child > button[aria-expanded]`);
    return b ? b.getAttribute('aria-expanded') : null;
  }, card(i));
  const cardHeight = (i) => page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().height), card(i));
  const childCount = (i) => page.evaluate((s) => {
    const l = document.querySelector(`${s} > .field-wrapper > .wrapper > .item-list`);
    return l ? l.querySelectorAll(':scope > section.field').length : -1;
  }, card(i));
  const clickCard = (i) => page.evaluate((s) => { document.querySelector(s).dispatchEvent(new MouseEvent('click', { bubbles: true })); }, card(i));
  // The chevron rotates through a 160ms transition, so poll until it settles — an instant read lands on the pre-transition value and would fail on every green run.
  const chevron = (i) => page.evaluate((s) => {
    const h = document.querySelector(`${s} > header`);
    if (!h) return null;
    const b = getComputedStyle(h, '::before');
    return { content: b.content, transform: b.transform, font: b.fontFamily };
  }, card(i));
  const chevronSettles = async (i, rotated) => {
    for (let t = 0; t < 20; t++) {
      const c = await chevron(i);
      if (c && (rotated ? c.transform !== 'none' : c.transform === 'none')) return true;
      await page.waitForTimeout(50);
    }
    return false;
  };
  const collapsedH = [];

  await check('optional-object: UNADDED card has no > .field-wrapper > .wrapper (the OPT_OFF signal)', eachCard(async (i) => {
    const st = await page.evaluate((s) => {
      const f = document.querySelector(s);
      return { checked: f.querySelector(':scope > .field-wrapper > .sui.checkbox .inner > button[role=checkbox]').getAttribute('aria-checked'), wrapper: !!f.querySelector(':scope > .field-wrapper > .wrapper') };
    }, card(i));
    if (st.checked !== 'false') return `starts aria-checked="${st.checked}" — expected an unadded card`;
    return st.wrapper ? 'unadded but already has > .field-wrapper > .wrapper — OPT_OFF can no longer be detected' : true;
  }));

  await check('optional-object ADDED state gains > .field-wrapper > .wrapper', eachCard(async (i) => {
    await page.evaluate((s) => { document.querySelector(`${s} > .field-wrapper > .sui.checkbox .inner > button[role=checkbox]`).click(); }, card(i));
    try { await page.waitForFunction((s) => document.querySelector(`${s} > .field-wrapper > .wrapper`), card(i), { timeout: 5000 }); }
    catch { return 'the Add switch did not mount > .field-wrapper > .wrapper'; }
    return true;
  }));

  // A card that mounts unarmed is inert however intact the rest of the DOM looks, and waiting on arming keeps the gesture checks below failing on a DOM change rather than on the observer's scheduling.
  await check('optional-object: editor.js ARMS the freshly mounted card (click-to-expand bound)', eachCard(async (i) => {
    try { await page.waitForFunction((s) => !!document.querySelector(s).__stommeObj, card(i), { timeout: 5000 }); }
    catch { return 'editor.js never bound enhanceObject — objectToggle() finds no > .field-wrapper > .wrapper > .header button[aria-expanded]'; }
    return true;
  }));

  await check('optional-object: added card starts COLLAPSED (disclosure aria-expanded="false")', eachCard(async (i) => {
    const s = await discState(i);
    if (s === null) return 'no disclosure at > .field-wrapper > .wrapper > .header > div:first-child > button[aria-expanded]';
    collapsedH[i] = await cardHeight(i);
    return s === 'false' ? true : `disclosure is aria-expanded="${s}" right after Add — the card auto-expands (collapsed:true no longer honoured, or editor.js expands it)`;
  }));

  await check('optional-object: collapsed card mounts no child fields (.wrapper > .item-list empty)', eachCard(async (i) => {
    const n = await childCount(i);
    if (n < 0) return 'no > .field-wrapper > .wrapper > .item-list';
    return n === 0 ? true : `${n} child section.field(s) rendered while collapsed — the one-row card is not collapsed`;
  }));

  // THEME_CSS ${CHEVRON} on the card's own header is the ONLY affordance saying the card opens — lose it and the card still works but reads as dead, and no other check would notice.
  await check('optional-object: collapsed card shows the rotated chevron (> header ::before)', eachCard(async (i) => {
    const c = await chevron(i);
    if (!c) return 'the card has no own > header to hang the chevron on';
    if (!/expand_more/.test(c.content)) return `> header ::before content is ${c.content} — the chevron affordance is gone`;
    if (!/Material Symbols/.test(c.font)) return `> header ::before font-family is ${c.font} — the icon font no longer resolves`;
    return (await chevronSettles(i, true)) ? true : '> header ::before never rotates while collapsed — open and closed look identical';
  }));

  await check('optional-object: a card click EXPANDS it (aria-expanded, child fields, height)', eachCard(async (i) => {
    await clickCard(i);
    try { await page.waitForFunction((s) => document.querySelector(`${s} > .field-wrapper > .wrapper > .header > div:first-child > button[aria-expanded="true"]`), card(i), { timeout: 5000 }); }
    catch { return `a click on the card did not flip the disclosure to aria-expanded="true" (still ${await discState(i)})`; }
    const n = await childCount(i);
    if (n < 1) return 'expanded but > .wrapper > .item-list mounted no child section.field';
    const h = await cardHeight(i);
    if (!(h > collapsedH[i])) return `expanded but the card is still ${h}px (collapsed was ${collapsedH[i]}px) — the fields are not visible`;
    return (await chevronSettles(i, false)) ? true : `expanded but > header ::before stays rotated (${(await chevron(i)).transform}) — the chevron lies about the state`;
  }));

  await check('optional-object: a second card click COLLAPSES it again (both ways, not one-shot)', eachCard(async (i) => {
    await clickCard(i);
    try { await page.waitForFunction((s) => document.querySelector(`${s} > .field-wrapper > .wrapper > .header > div:first-child > button[aria-expanded="false"]`), card(i), { timeout: 5000 }); }
    catch { return `a second click did not flip the disclosure back to aria-expanded="false" (still ${await discState(i)}) — the card opens but cannot be closed`; }
    const h = await cardHeight(i);
    return h === collapsedH[i] ? true : `collapsed again but the card is ${h}px, not the ${collapsedH[i]}px it started at`;
  }));
} finally {
  if (browser) await browser.close();
  srv.close();
  try { rmSync(root, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} contract checks passed`);
if (process.env.STOMME_CONTRACT_REPORT) {
  writeFileSync(process.env.STOMME_CONTRACT_REPORT, JSON.stringify({
    passed: results.length - failed.length, total: results.length, failed: failed.map(([, name, why]) => (why ? `${name} — ${why}` : name)),
  }));
}
if (failed.length) {
  console.error(`\n✗ Sveltia DOM contract BROKEN — ${failed.length} check(s) our editor CSS/JS rely on no longer hold:`);
  for (const [, name, why] of failed) console.error(`   · ${name}${why ? `\n     ↳ ${why}` : ''}`);
  console.error('\nA Sveltia upgrade likely changed the editor DOM. Re-check THEME_CSS + admin/editor.js against the new structure (see Resources/stomme-sveltia-upgrade-risks.md).');
  process.exit(1);
}
console.log('✓ Sveltia DOM contract intact.');
