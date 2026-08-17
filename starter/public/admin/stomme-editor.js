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
  function isReorderable(item) { return !!(moveButton(item, UP) || moveButton(item, DOWN)); }
  function rowItems(list) {
    return Array.prototype.filter.call(list.children, function (c) {
      return c.classList && c.classList.contains('item') && isReorderable(c);
    });
  }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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
    list.addEventListener('dragover', function (e) {
      if (!dragged || dragged.parentElement !== list) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var items = rowItems(list), from = items.indexOf(dragged), g = gapAt(items, e.clientY);
      clearDrop();
      if (g === from || g === from + 1) return;
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
    if (toggleButton(item)) item.setAttribute('draggable', isCollapsed(item) ? 'true' : 'false');
    if (item.__stomme) return;
    item.__stomme = true;
    if (!toggleButton(item)) item.setAttribute('draggable', 'false');
    enhanceList(item.parentElement);

    // Draggable is decided per-press: a grab outside controls/inputs (and outside nested items) drags THIS item, while presses in inputs keep native text selection.
    item.addEventListener('mousedown', function (e) {
      var ok = !inControl(e.target) && e.target.closest('.item') === item;
      item.setAttribute('draggable', ok ? 'true' : 'false');
    });
    item.addEventListener('dragstart', function (e) {
      if (e.target !== item) {
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

  var FAQ_TAGS = ["basics","editing"];
  function tagInputs(section) {
    return section.querySelectorAll(':scope input[type="text"]');
  }
  function usedTags(section) {
    var vals = [];
    section.querySelectorAll(':scope input[type="text"]').forEach(function (i) { vals.push(i.value.trim()); });
    section.querySelectorAll(':scope .item .summary').forEach(function (s) { vals.push((s.textContent || '').trim()); });
    return vals;
  }
  function tagAddButton(section) {
    var btns = section.querySelectorAll(':scope > .field-wrapper button');
    for (var i = btns.length - 1; i >= 0; i--) if (!btns[i].closest('.item')) return btns[i];
    return null;
  }
  async function addTag(section, tag) {
    var before = tagInputs(section).length;
    var add = tagAddButton(section);
    if (!add) return;
    add.click();
    for (var t = 0; t < 20; t++) {
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
      enhanceObject(o); gateObject(o); enhanceGated(o);
    });
    enhanceFaqTags();
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
