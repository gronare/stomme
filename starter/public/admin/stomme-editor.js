// stomme CMS editor enhancement — list-item UX for EVERY reorderable list (sections,
// in-block content lists, any collection list): whole-item drag reordering (a drop is
// translated into Sveltia's own move-up/down clicks, so the SAVED order changes) and
// click-anywhere expand/collapse, plus click-to-toggle on collapsible object groups
// (SEO / Media / Layout / Appearance). All layout (pill + one-row collapsed items,
// group cards) is pure CSS in gen-admin-blocks.mjs THEME_STYLE — the summary is styled
// where Sveltia renders it, never moved, so re-renders can't desync it. Light-DOM;
// targets Sveltia internals (0.170.x) — re-check on a Sveltia upgrade.
(function () {
  'use strict';
  var UP = 'arrow_upward', DOWN = 'arrow_downward';

  function iconOf(btn) { var i = btn.querySelector('.material-symbols-outlined'); return i ? (i.textContent || '').trim() : ''; }
  // The expand/collapse disclosure — first header group's button; NOT the aria-expanded ⋮ menu button.
  function toggleButton(item) { return item.querySelector(':scope > .header > div:first-child > button[aria-expanded]'); }
  function isCollapsed(item) { var b = toggleButton(item); return !!b && b.getAttribute('aria-expanded') === 'false'; }
  function moveButton(item, icon) {
    var btns = item.querySelectorAll(':scope > .header button');
    for (var i = 0; i < btns.length; i++) if (iconOf(btns[i]) === icon) return btns[i];
    return null;
  }
  // Reorderable = a list item whose OWN header carries Sveltia's move buttons (hidden by CSS).
  function isReorderable(item) { return !!(moveButton(item, UP) || moveButton(item, DOWN)); }
  function rowItems(list) {
    return Array.prototype.filter.call(list.children, function (c) {
      return c.classList && c.classList.contains('item') && isReorderable(c);
    });
  }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Drive Sveltia's move buttons one step at a time; each click swaps the row one slot,
  // so tracking by INDEX is deterministic (content-identical items can't be confused).
  async function reorder(list, from, dir, steps) {
    var idx = from;
    for (var s = 0; s < steps; s++) {
      var cur = rowItems(list)[idx];
      if (!cur) return;
      var btn = moveButton(cur, dir < 0 ? UP : DOWN);
      if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
      btn.click();
      idx += dir;
      await delay(120);
    }
  }

  var dragged = null;
  function clearDrop() {
    document.querySelectorAll('.stomme-drop-before, .stomme-drop-after').forEach(function (n) {
      n.classList.remove('stomme-drop-before', 'stomme-drop-after');
    });
  }
  // Insertion gap under the cursor: index of the first item whose midpoint is below clientY
  // (0 = above all, n = below all) — smooth across the whole list incl. inter-item margins.
  function gapAt(items, y) {
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return items.length;
  }
  function enhanceList(list) {
    if (list.__stommeDnd) return;
    list.__stommeDnd = true;
    // Handlers act only on drags whose item belongs to THIS list (dragged.parentElement
    // check), so nested lists can't reorder each other; bubbled events fall through.
    list.addEventListener('dragover', function (e) {
      if (!dragged || dragged.parentElement !== list) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var items = rowItems(list), from = items.indexOf(dragged), g = gapAt(items, e.clientY);
      clearDrop();
      if (g === from || g === from + 1) return; // the two no-move gaps around the grabbed item
      if (items[g - 1]) items[g - 1].classList.add('stomme-drop-after');
      if (items[g]) items[g].classList.add('stomme-drop-before');
    });
    list.addEventListener('dragleave', function (e) { if (e.target === list) clearDrop(); });
    list.addEventListener('drop', function (e) {
      if (!dragged || dragged.parentElement !== list) return;
      e.preventDefault();
      clearDrop();
      var items = rowItems(list), from = items.indexOf(dragged), g = gapAt(items, e.clientY);
      if (from < 0 || g === from || g === from + 1) return;
      if (g < from) reorder(list, from, -1, from - g);
      else reorder(list, from, 1, g - from - 1);
    });
  }

  function inTextEntry(t) { return !!(t.closest && t.closest('input, textarea, select, [contenteditable]')); }
  function inControl(t) { return !!(t.closest && t.closest('button, a, input, textarea, select, [contenteditable], [role="menu"], [role="listbox"]')); }

  function enhance(item) {
    if (!isReorderable(item)) return;
    // Baseline: collapsed items stay grab-ready without a preceding press; expanded ones
    // default off and rely on the per-press arming below.
    if (toggleButton(item)) item.setAttribute('draggable', isCollapsed(item) ? 'true' : 'false');
    if (item.__stomme) return;
    item.__stomme = true;
    if (!toggleButton(item)) item.setAttribute('draggable', 'false');
    enhanceList(item.parentElement);

    // Draggable is decided per-press: a grab outside controls/inputs (and outside nested
    // items) drags THIS item; presses in inputs keep native text selection untouched.
    item.addEventListener('mousedown', function (e) {
      var ok = !inControl(e.target) && e.target.closest('.item') === item;
      item.setAttribute('draggable', ok ? 'true' : 'false');
    });
    item.addEventListener('dragstart', function (e) {
      if (e.target !== item) {
        // A native drag (image/selection) inside our own content must not hijack the item;
        // a drag whose target sits in a NESTED item is that item's — fall through untouched.
        if (e.target.closest && e.target.closest('.item') === item) e.preventDefault();
        return;
      }
      dragged = item;
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', 'stomme-item'); } catch (x) {}
      item.classList.add('stomme-dragging');
    });
    item.addEventListener('dragend', function () {
      item.classList.remove('stomme-dragging');
      dragged = null;
      clearDrop();
    });
    // Plain click toggles: anywhere on a collapsed item, or on the item's own header when
    // expanded. Real controls (disclosure/⋮/✕ buttons, inputs) keep their native behavior;
    // a real drag suppresses the click, so drag and click never both fire.
    item.addEventListener('click', function (e) {
      if (inControl(e.target)) return;
      if (e.target.closest('.item') !== item) return; // clicks inside a nested item
      if (!isCollapsed(item)) {
        var h = e.target.closest('.header');
        if (!h || h.parentElement !== item) return; // only the item's own header collapses
      }
      var b = toggleButton(item);
      if (b) b.click();
    });
  }

  // Collapsible object groups (SEO / Media / Layout / Appearance): same click-to-toggle —
  // anywhere while collapsed, the label bar (the field's own <header>) while expanded.
  function objectToggle(field) { return field.querySelector(':scope > .field-wrapper > .wrapper > .header button[aria-expanded]'); }
  // A link-shaped object (page select + url) renders chrome-less inline and must never
  // collapse — its children have to stay mounted for the flat CSS to hold.
  function isFlatLink(field) {
    var kids = field.querySelectorAll(':scope > .field-wrapper > .wrapper > .item-list > section.field');
    if (kids.length !== 2) return false;
    return /\.page$/.test(kids[0].getAttribute('data-key-path') || '') && /\.url$/.test(kids[1].getAttribute('data-key-path') || '');
  }
  function enhanceObject(field) {
    if (field.__stommeObj || !objectToggle(field)) return;
    field.__stommeObj = true;
    field.addEventListener('click', function (e) {
      if (inControl(e.target)) return;
      if (e.target.closest('section.field') !== field) return; // clicks inside nested fields
      var b = objectToggle(field);
      if (!b) return;
      if (b.getAttribute('aria-expanded') === 'true') {
        if (isFlatLink(field)) return; // inline links stay open
        var h = e.target.closest('header');
        if (!h || h.parentElement !== field) return;
      }
      b.click();
    });
  }

  // OPTIONAL groups (required:false objects — Sveltia's "Add …" checkbox, restyled as the
  // switch in the group header): the row is one affordance. Clicking an OFF row switches
  // the group on, and switching on auto-expands so the fields are ready to fill.
  function addCheckbox(field) { return field.querySelector(':scope > .field-wrapper > .sui.checkbox .inner > button[role=checkbox]'); }
  function enhanceOptional(field) {
    if (field.__stommeOpt || !addCheckbox(field)) return;
    field.__stommeOpt = true;
    field.addEventListener('click', function (e) {
      var cb = addCheckbox(field);
      if (!cb) return;
      if (cb.contains(e.target)) { // the switch itself: mark intent, let Sveltia toggle
        if (cb.getAttribute('aria-checked') === 'false') field.__stommeOpenOnAdd = true;
        return;
      }
      if (inControl(e.target)) return;
      if (e.target.closest('section.field') !== field) return;
      if (!objectToggle(field) && cb.getAttribute('aria-checked') === 'false') {
        field.__stommeOpenOnAdd = true;
        cb.click();
      }
    });
  }
  function openPending(field) {
    if (!field.__stommeOpenOnAdd) return;
    var b = objectToggle(field);
    if (!b) return; // fields not mounted yet — retried on the next scan
    field.__stommeOpenOnAdd = false;
    if (b.getAttribute('aria-expanded') === 'false') b.click();
  }

  // Conditional visibility (Sveltia has no native dependent fields): an object whose FIRST
  // child field is the boolean `enabled` uses that toggle to gate the object's remaining
  // fields. Off → the rest are hidden. The name check matters: other leading booleans
  // (e.g. a layout toggle followed by a columns field) must NOT hide their siblings.
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
  function gateObject(obj) {
    var fields = gatedFields(obj);
    if (!fields) return;
    var sw = fields[0].querySelector('[role=switch]');
    var on = !!sw && sw.getAttribute('aria-checked') === 'true';
    // 'important' so the hide also beats THEME_STYLE display rules (e.g. the flattened
    // share-cards og.types wrapper is display:flex!important).
    for (var i = 1; i < fields.length; i++) {
      if (on) fields[i].style.removeProperty('display');
      else fields[i].style.setProperty('display', 'none', 'important');
    }
  }

  // FAQ tag suggestions — Sveltia's select can't create new options, so `tags` stays a
  // free list and the tags already used across FAQ entries (templated in by stomme-gen)
  // render as click-to-add chips under it. A chip click drives Sveltia's own Add button
  // and fills the new row; typing stays free for brand-new tags.
  var FAQ_TAGS = []; // stomme:faq-tags
  function tagInputs(section) {
    return section.querySelectorAll(':scope input[type="text"]');
  }
  function usedTags(section) {
    var vals = [];
    // Expanded rows expose the input; collapsed rows only their summary text.
    section.querySelectorAll(':scope input[type="text"]').forEach(function (i) { vals.push(i.value.trim()); });
    section.querySelectorAll(':scope .item .summary').forEach(function (s) { vals.push((s.textContent || '').trim()); });
    return vals;
  }
  function tagAddButton(section) {
    // The list's own Add button: the last non-item button in the field wrapper.
    var btns = section.querySelectorAll(':scope > .field-wrapper button');
    for (var i = btns.length - 1; i >= 0; i--) if (!btns[i].closest('.item')) return btns[i];
    return null;
  }
  async function addTag(section, tag) {
    var before = tagInputs(section).length;
    var add = tagAddButton(section);
    if (!add) return;
    add.click();
    for (var t = 0; t < 20; t++) { // wait for the new row to mount
      await delay(50);
      var inputs = tagInputs(section);
      if (inputs.length > before) {
        var input = inputs[inputs.length - 1];
        input.value = tag;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }
  }
  function renderTagChips(section) {
    if (!section.__stommeTagHook) {
      // Typing in a tag row doesn't mutate the DOM — refresh the chips on input too.
      section.__stommeTagHook = true;
      section.addEventListener('input', function () { setTimeout(function () { renderTagChips(section); }, 0); });
    }
    var used = usedTags(section);
    var free = FAQ_TAGS.filter(function (t) { return used.indexOf(t) === -1; });
    var row = section.querySelector(':scope > .stomme-tag-chips');
    var sig = free.join(' ');
    if (!free.length) { if (row) row.remove(); return; }
    if (row && row.__stommeSig === sig) return;
    if (!row) {
      row = document.createElement('div');
      row.className = 'stomme-tag-chips';
      section.appendChild(row);
    }
    row.__stommeSig = sig;
    row.textContent = '';
    free.forEach(function (t) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'stomme-tag-chip';
      chip.textContent = '+ ' + t;
      chip.addEventListener('click', function () { addTag(section, t); });
      row.appendChild(chip);
    });
  }
  function enhanceFaqTags() {
    if (!FAQ_TAGS.length || location.hash.indexOf('#/collections/faq/') !== 0) return;
    document.querySelectorAll('section.field[data-field-type="list"][data-key-path="tags"]').forEach(renderTagChips);
  }

  function scan() {
    document.querySelectorAll('.item').forEach(enhance);
    document.querySelectorAll('section.field[data-field-type="object"]').forEach(function (o) {
      enhanceObject(o); enhanceOptional(o); openPending(o); gateObject(o);
    });
    enhanceFaqTags();
  }
  var scheduled = 0;
  var obs = new MutationObserver(function () {
    if (scheduled) return;
    scheduled = requestAnimationFrame(function () { scheduled = 0; scan(); });
  });
  function start() {
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded', 'aria-checked'] });
    scan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
