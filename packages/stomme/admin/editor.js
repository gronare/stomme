(function () {
  'use strict';
  var nativeAnimate = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    var still = false;
    try { still = !!(this.classList && this.classList.contains('item-wrapper')); } catch (e) {}
    if (!still) return nativeAnimate.apply(this, arguments);
    var zero = { duration: 0, delay: 0, endDelay: 0, fill: 'none' };
    var opts = options && typeof options === 'object' ? Object.assign({}, options, zero) : zero;
    var anim = nativeAnimate.call(this, keyframes, opts);
    try { anim.finish(); } catch (e) {}
    return anim;
  };

  // The expand/collapse disclosure — first header group's button; NOT the aria-expanded ⋮ menu button.
  function toggleButton(item) { return item.querySelector(':scope > .header > div:first-child > button[aria-expanded]'); }
  function isCollapsed(item) { var b = toggleButton(item); return !!b && b.getAttribute('aria-expanded') === 'false'; }
  function isListItem(item) { return !!item.closest('section.field[data-field-type="list"]') && !!toggleButton(item); }

  function inControl(t) { return !!(t.closest && t.closest('button, a, input, textarea, select, [contenteditable], [role="menu"], [role="listbox"]')); }

  function enhance(item) {
    if (item.__stomme || !isListItem(item)) return;
    item.__stomme = true;
    item.addEventListener('click', function (e) {
      if (inControl(e.target)) return;
      if (e.target.closest('.item') !== item) return;
      if (!isCollapsed(item)) {
        var h = e.target.closest('.header');
        if (!h || h.parentElement !== item) return;
      }
      var b = toggleButton(item);
      if (b) b.click();
    });
  }

  function objectToggle(field) { return field.querySelector(':scope > .field-wrapper > .wrapper > .header button[aria-expanded]'); }
  // A link-shaped object (page select + url) renders chrome-less inline and must never collapse — its children have to stay mounted for the flat CSS to hold.
  function isFlatLink(field) {
    var kids = field.querySelectorAll(':scope > .field-wrapper > .wrapper > .item-list > section.field');
    if (kids.length !== 2) return false;
    return /\.page$/.test(kids[0].getAttribute('data-key-path') || '') && /\.url$/.test(kids[1].getAttribute('data-key-path') || '');
  }
  function enhanceObject(field) {
    if (field.__stommeObj || !objectToggle(field)) return;
    field.__stommeObj = true;
    field.addEventListener('click', function (e) {
      // Checked at CLICK time, not bind time: Sveltia lazy-mounts offscreen children as placeholders, so until a card scrolls into view it is indistinguishable from a plain group and a stale check would collapse the object and unmount the gate switch.
      if (isGatedCard(field)) return;
      if (inControl(e.target)) return;
      if (e.target.closest('section.field') !== field) return;
      var b = objectToggle(field);
      if (!b) return;
      if (b.getAttribute('aria-expanded') === 'true') {
        if (isFlatLink(field)) return;
        // Children still lazy-mounting (Sveltia placeholders): the group's kind is unknowable, and a gated card mid-mount must not get its switch collapsed away.
        if (field.querySelector(':scope > .field-wrapper > .wrapper > .item-list > .placeholder')) return;
        // Optional groups render their header display:contents (only the h4 has a box), so a hit on the field's bare row has to count as the header — without it the card is near-impossible to close.
        var h = e.target.closest('header');
        if (!(h && h.parentElement === field) && e.target !== field) return;
      }
      b.click();
    });
  }

  // Sveltia has no dependent fields, so an object whose FIRST child is the boolean `enabled` gates its remaining fields. The name check matters: other leading booleans (a layout toggle before a columns field) must NOT hide their siblings.
  function gatedFields(obj) {
    var list = obj.querySelector(':scope > .field-wrapper > .wrapper > .item-list');
    if (!list) return null;
    var fields = Array.prototype.filter.call(list.children, function (c) {
      return c.matches && c.matches('section.field');
    });
    if (fields.length < 2 || fields[0].getAttribute('data-field-type') !== 'boolean') return null;
    if (!/\.enabled$/.test(fields[0].getAttribute('data-key-path') || '')) return null;
    return fields;
  }
  // Gated switch-cards render as THEME_CSS ${GATED} everywhere EXCEPT the chrome-less og wrapper, whose master switch still gates its siblings via gateObject.
  function isGatedCard(field) {
    return !!gatedFields(field) && (field.getAttribute('data-key-path') || '') !== 'og';
  }
  function gateObject(obj) {
    if (isGatedCard(obj)) return;
    var fields = gatedFields(obj);
    if (!fields) return;
    var sw = fields[0].querySelector('[role=switch]');
    var on = !!sw && sw.getAttribute('aria-checked') === 'true';
    // 'important' so the hide also beats THEME_CSS display rules (the flattened share-cards og.types wrapper is display:flex!important).
    for (var i = 1; i < fields.length; i++) {
      if (on) fields[i].style.removeProperty('display');
      else fields[i].style.setProperty('display', 'none', 'important');
    }
  }
  function enhanceGated(field) {
    if (field.__stommeGated || !isGatedCard(field)) return;
    field.__stommeGated = true;
    field.addEventListener('click', function (e) {
      if (inControl(e.target)) return;
      if (e.target.closest('section.field') !== field) return;
      if (field.classList.contains('stomme-open')) {
        var h = e.target.closest('header');
        if (!h || h.parentElement !== field) return;
      }
      field.classList.toggle('stomme-open');
    });
  }

  var BLOCK_PICKER = null;
  var pickerSearch = null;

  var bypassAdd = false;
  var picker = null;

  function keyPathTail(field) { var p = field.getAttribute('data-key-path') || ''; return p.slice(p.lastIndexOf('.') + 1); }
  function pickerField(btn) {
    if (!BLOCK_PICKER || !pickerSearch || !btn || btn.getAttribute('aria-haspopup') !== 'menu') return null;
    var field = btn.closest('section.field');
    if (!field || field.__stommePickerOff || field.getAttribute('data-field-type') !== 'list') return null;
    var bar = btn.closest('.toolbar');
    if (!bar || bar.closest('section.field') !== field || btn.closest('.item')) return null;
    return BLOCK_PICKER.fields.indexOf(keyPathTail(field)) === -1 ? null : field;
  }
  function plain(s) { return String(s || '').replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim(); }
  function itemLabel(item) { return plain(item.getAttribute('aria-label') || (item.querySelector('.type-label') || item).textContent); }
  function menuFor(btn) {
    var id = btn.getAttribute('aria-controls');
    var host = id ? document.getElementById(id) : null;
    var menu = host ? (host.matches('[role="menu"]') ? host : host.querySelector('[role="menu"]')) : null;
    if (!menu) menu = document.querySelector('dialog.sui.popup.open [role="menu"]');
    return menu && menu.querySelector('[role="menuitem"]') ? menu : null;
  }
  function waitFor(get, ms, done) {
    var until = Date.now() + ms;
    (function poll() {
      var v = get();
      if (v || Date.now() > until) return done(v);
      setTimeout(poll, 30);
    })();
  }
  function addThroughMenu(btn, field, block) {
    var root = document.documentElement;
    root.classList.add('stomme-picking');
    var reveal = function () { root.classList.remove('stomme-picking'); };
    bypassAdd = true;
    try { btn.click(); } finally { bypassAdd = false; }
    waitFor(function () { return menuFor(btn); }, 1500, function (menu) {
      if (!menu) {
        // Sveltia's menu could not be found, so this list falls back to Sveltia's own Add button from now on.
        field.__stommePickerOff = true;
        reveal();
        if (window.console) console.warn('stomme: block picker found no add menu; using the CMS menu');
        return;
      }
      var items = Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'));
      var hit = items.filter(function (it) { return itemLabel(it) === block.label; })[0];
      if (!hit) { reveal(); if (items[0]) items[0].focus(); return; }
      hit.click();
      setTimeout(reveal, 400);
    });
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function lowerFirst(s) { return /^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function sketch(shape) { return '<div class="wf" data-shape="' + esc(shape) + '" aria-hidden="true">' + (BLOCK_PICKER.shapes[shape] || BLOCK_PICKER.shapes.prose) + '</div>'; }
  function narrow() { return window.matchMedia('(max-width: 760px)').matches; }

  function buildPicker() {
    var ui = BLOCK_PICKER.ui;
    var d = document.createElement('dialog');
    d.className = 'stomme-picker';
    d.setAttribute('aria-labelledby', 'stomme-picker-title');
    d.innerHTML = '<div class="sp-box"><div class="sp-top"><h2 id="stomme-picker-title">' + esc(ui.title) + '</h2>' +
      '<label class="sp-search"><span aria-hidden="true">⌕</span><input type="search" autocomplete="off" spellcheck="false" aria-label="' + esc(ui.search) + '" aria-controls="stomme-picker-list" placeholder="' + esc(ui.placeholder) + '"></label>' +
      '<button type="button" class="sp-x" aria-label="' + esc(ui.close) + '">×</button></div>' +
      '<div class="sp-body"><nav class="sp-groups" aria-label="' + esc(ui.groups) + '"></nav>' +
      '<div class="sp-list" id="stomme-picker-list" role="listbox" tabindex="0" aria-label="' + esc(ui.title) + '"></div>' +
      '<aside class="sp-side" aria-live="polite"></aside></div></div>';
    document.body.appendChild(d);
    var p = { dialog: d, input: d.querySelector('input'), nav: d.querySelector('.sp-groups'), list: d.querySelector('.sp-list'), side: d.querySelector('.sp-side'), hits: [], sel: null, group: null, btn: null, field: null };
    d.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key !== 'Escape') onKey(e); });
    d.addEventListener('click', function (e) { e.stopPropagation(); if (e.target === d) closePicker(); });
    d.addEventListener('close', function () { if (p.btn && !p.choosing) p.btn.focus(); });
    d.querySelector('.sp-x').addEventListener('click', closePicker);
    p.input.addEventListener('input', function () { p.sel = null; render(); });
    p.nav.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-g]');
      if (!b) return;
      p.group = b.getAttribute('data-g');
      var h = p.list.querySelector('h3[data-g="' + p.group.replace(/"/g, '\\"') + '"]');
      if (h) p.list.scrollTop = h.offsetTop - 4;
      markGroup();
    });
    p.list.addEventListener('scroll', function () { if (!p.input.value.trim()) { p.group = groupAtScroll(); markGroup(); } });
    p.list.addEventListener('click', function (e) {
      var c = e.target.closest('.sp-card');
      if (!c) return;
      select(c.getAttribute('data-type'), false);
      if (narrow()) choose();
    });
    p.list.addEventListener('dblclick', function (e) { if (e.target.closest('.sp-card')) choose(); });
    p.side.addEventListener('click', function (e) { if (e.target.closest('.sp-add')) choose(); });
    return p;
  }

  function groupAtScroll() {
    var hs = picker.list.querySelectorAll('h3[data-g]');
    var at = hs.length ? hs[0].getAttribute('data-g') : null;
    var top = picker.list.scrollTop + 8;
    for (var i = 0; i < hs.length; i++) if (hs[i].offsetTop <= top) at = hs[i].getAttribute('data-g');
    return at;
  }
  function markGroup() {
    var searching = !!picker.input.value.trim();
    picker.nav.querySelectorAll('button[data-g]').forEach(function (b) { b.setAttribute('aria-current', String(!searching && b.getAttribute('data-g') === picker.group)); });
  }

  function render() {
    var ui = BLOCK_PICKER.ui;
    var q = picker.input.value;
    picker.hits = pickerSearch.searchBlocks(BLOCK_PICKER.blocks, q);
    var shown = BLOCK_PICKER.groups.filter(function (g) { return picker.hits.some(function (b) { return b.group === g.id; }); });
    picker.nav.innerHTML = shown.map(function (g) {
      var n = picker.hits.filter(function (b) { return b.group === g.id; }).length;
      return '<button type="button" data-g="' + esc(g.id) + '">' + esc(g.label) + '<span class="sp-n">' + n + '</span></button>';
    }).join('');
    picker.list.innerHTML = shown.length ? shown.map(function (g, gi) {
      var cards = picker.hits.filter(function (b) { return b.group === g.id; }).map(function (b) {
        return '<div class="sp-card" role="option" id="stomme-pick-' + esc(b.type) + '" data-type="' + esc(b.type) + '" aria-selected="false">' + sketch(b.shape) + '<b class="sp-name">' + esc(b.label) + '</b></div>';
      }).join('');
      return '<div role="group" aria-labelledby="stomme-pick-g' + gi + '"><h3 id="stomme-pick-g' + gi + '" data-g="' + esc(g.id) + '">' + esc(g.label) + '</h3><div class="sp-grid">' + cards + '</div></div>';
    }).join('') : '<p class="sp-empty">' + esc(ui.empty.replace('{query}', q.trim())) + '</p>';
    if (!picker.hits.some(function (b) { return b.type === picker.sel; })) picker.sel = picker.hits.length ? picker.hits[0].type : null;
    if (!picker.group || !shown.some(function (g) { return g.id === picker.group; })) picker.group = shown.length ? shown[0].id : null;
    if (q.trim()) picker.list.scrollTop = 0;
    markGroup();
    select(picker.sel, false);
  }

  function select(type, scroll) {
    picker.sel = type;
    var b = BLOCK_PICKER.blocks.filter(function (x) { return x.type === type; })[0];
    picker.list.querySelectorAll('.sp-card').forEach(function (c) { c.setAttribute('aria-selected', String(c.getAttribute('data-type') === type)); });
    var card = type ? document.getElementById('stomme-pick-' + type) : null;
    if (card) {
      picker.input.setAttribute('aria-activedescendant', card.id);
      picker.list.setAttribute('aria-activedescendant', card.id);
      if (scroll) card.scrollIntoView({ block: 'nearest' });
    } else {
      picker.input.removeAttribute('aria-activedescendant');
      picker.list.removeAttribute('aria-activedescendant');
    }
    var g = b ? BLOCK_PICKER.groups.filter(function (x) { return x.id === b.group; })[0] : null;
    picker.side.innerHTML = b ? sketch(b.shape) + '<h4>' + esc(b.label) + '</h4><span class="sp-tag">' + esc(g ? g.label : b.group) + '</span><p>' + esc(b.summary) + '</p>' +
      '<button type="button" class="sp-add">' + esc(BLOCK_PICKER.ui.add.replace('{name}', lowerFirst(b.label))) + '</button>' : '';
  }

  function step(key) {
    var cards = Array.prototype.slice.call(picker.list.querySelectorAll('.sp-card'));
    var i = cards.map(function (c) { return c.getAttribute('data-type'); }).indexOf(picker.sel);
    if (i === -1) return cards[0];
    if (key === 'ArrowRight') return cards[i + 1];
    if (key === 'ArrowLeft') return cards[i - 1];
    var r = cards[i].getBoundingClientRect(), down = key === 'ArrowDown', best = null, bestScore = Infinity;
    cards.forEach(function (c) {
      var o = c.getBoundingClientRect();
      var dy = down ? o.top - r.bottom : r.top - o.bottom;
      if (dy < -1) return;
      var score = dy * 1000 + Math.abs(o.left - r.left);
      if (score < bestScore) { bestScore = score; best = c; }
    });
    return best;
  }
  function onKey(e) {
    if (e.key === 'Enter') { if (e.target.closest('.sp-x, .sp-groups')) return; e.preventDefault(); if (picker.sel) choose(); return; }
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) === -1) return;
    var inInput = e.target === picker.input;
    if (inInput && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    if (!inInput && e.target !== picker.list) return;
    e.preventDefault();
    var next = inInput ? step(e.key === 'ArrowDown' ? 'ArrowRight' : 'ArrowLeft') : step(e.key);
    if (next) select(next.getAttribute('data-type'), true);
  }

  function openPicker(btn, field) {
    if (!picker) picker = buildPicker();
    picker.btn = btn;
    picker.field = field;
    picker.choosing = false;
    picker.input.value = '';
    picker.sel = null;
    picker.group = null;
    render();
    picker.dialog.showModal();
    picker.list.scrollTop = 0;
    picker.input.focus();
  }
  function closePicker() { if (picker && picker.dialog.open) picker.dialog.close(); }
  function choose() {
    var b = BLOCK_PICKER.blocks.filter(function (x) { return x.type === picker.sel; })[0];
    if (!b) return;
    picker.choosing = true;
    picker.dialog.close();
    addThroughMenu(picker.btn, picker.field, b);
  }

  function intercept(e) {
    if (bypassAdd) return;
    var btn = e.target && e.target.closest ? e.target.closest('button[aria-haspopup="menu"]') : null;
    var field = pickerField(btn);
    if (!field) return;
    if (e.type === 'keydown' && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || ['Enter', ' ', 'ArrowDown', 'ArrowUp'].indexOf(e.key) === -1)) return;
    if (btn.getAttribute('aria-expanded') === 'true') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openPicker(btn, field);
  }
  document.addEventListener('click', intercept, true);
  document.addEventListener('keydown', intercept, true);

  function scan() {
    document.querySelectorAll('.item').forEach(enhance);
    document.querySelectorAll('section.field[data-field-type="object"]').forEach(function (o) {
      enhanceObject(o); gateObject(o); enhanceGated(o);
    });
  }
  var raf = 0, timer = 0;
  function run() { cancelAnimationFrame(raf); clearTimeout(timer); raf = timer = 0; scan(); }
  // Never rAF alone: the browser suspends it while the document is hidden, so a card mounted in that window would stay unarmed (no click-to-expand, no drag) until the tab is looked at again — the timeout is the ceiling, and whichever fires first cancels the other.
  var obs = new MutationObserver(function () {
    if (raf || timer) return;
    raf = requestAnimationFrame(run);
    timer = setTimeout(run, 16);
  });
  function start() {
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded', 'aria-checked'] });
    scan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
