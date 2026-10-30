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

  var BLOCK_PICKER = {"fields":["blocks"],"ui":{"title":"Add section","search":"Search sections","placeholder":"Search: image, price, map, quote…","close":"Close","groups":"Groups","add":"Add {name}","empty":"No section matches “{query}”."},"groups":[{"id":"Hero & headers","label":"Hero & headers"},{"id":"Text","label":"Text"},{"id":"Cards & lists","label":"Cards & lists"},{"id":"Media","label":"Media"},{"id":"Quote & highlight","label":"Quote & highlight"},{"id":"Numbers","label":"Numbers"},{"id":"From collections","label":"From collections"},{"id":"Contact","label":"Contact"},{"id":"Calls to action","label":"Calls to action"}],"blocks":[{"type":"hero","label":"Hero","group":"Hero & headers","summary":"Full-width intro — eyebrow, H1, text and a button, with an optional image, highlights list or animated motif beside it.","shape":"hero","terms":"hero hero full-width intro — eyebrow, h1, text and a button, with an optional image, highlights list or animated motif beside it. start top banner headline start top banner headline"},{"type":"cover","label":"Cover (full-bleed)","group":"Hero & headers","summary":"Full-bleed banner — a background photo or muted looping video, with overlaid heading, text and buttons.","shape":"hero","terms":"cover (full-bleed) cover (full-bleed) full-bleed banner — a background photo or muted looping video, with overlaid heading, text and buttons. full-bleed background image video banner full-bleed background image video banner"},{"type":"pageHeader","label":"Page header","group":"Hero & headers","summary":"Page title band (light or dark): eyebrow, H1, intro and an optional button.","shape":"band","terms":"page header page header page title band (light or dark): eyebrow, h1, intro and an optional button. title heading intro title heading intro"},{"type":"prose","label":"Rich text","group":"Text","summary":"A block of rich (markdown) text with an optional heading.","shape":"prose","terms":"rich text rich text a block of rich (markdown) text with an optional heading. text body markdown article text body markdown article"},{"type":"textImage","label":"Text + image","group":"Text","summary":"Text beside an image or a looping video (media on the left or right).","shape":"split","terms":"text + image text + image text beside an image or a looping video (media on the left or right). image photo video side by side image photo video side by side"},{"type":"textQuote","label":"Text + quote","group":"Text","summary":"Body text paired with a pulled-out quote.","shape":"split","terms":"text + quote text + quote body text paired with a pulled-out quote. quote citation body text quote citation body text"},{"type":"fragment","label":"Story fragment","group":"Text","summary":"A placed editorial fragment — big lead line, short body, optional link. Consecutive fragments drift across the page.","shape":"prose","terms":"story fragment story fragment a placed editorial fragment — big lead line, short body, optional link. consecutive fragments drift across the page. editorial lead story editorial lead story"},{"type":"sectionNav","label":"Section links","group":"Text","summary":"A row of links that jump to the headings further down this page. Nothing to fill in: it reads the sections below it.","shape":"chips","terms":"section links section links a row of links that jump to the headings further down this page. nothing to fill in: it reads the sections below it. contents anchors jump links menu contents anchors jump links menu"},{"type":"featureGrid","label":"Feature cards","group":"Cards & lists","summary":"Grid of feature cards — icon or number, title and text; cards can link.","shape":"grid","terms":"feature cards feature cards grid of feature cards — icon or number, title and text; cards can link. cards features benefits icons cards features benefits icons"},{"type":"pillars","label":"Principles / values","group":"Cards & lists","summary":"Row of principle / value cards (icon, title, text).","shape":"grid","terms":"principles / values principles / values row of principle / value cards (icon, title, text). values principles cards values principles cards"},{"type":"plans","label":"Pricing / plans","group":"Cards & lists","summary":"A row of pricing plan cards — name, price, period, features and a button.","shape":"grid","terms":"pricing / plans pricing / plans a row of pricing plan cards — name, price, period, features and a button. price cost packages pricing price cost packages pricing"},{"type":"specialistGrid","label":"Specialist grid","group":"Cards & lists","summary":"Grid of specialist / team profile cards.","shape":"grid","terms":"specialist grid specialist grid grid of specialist / team profile cards. staff profiles experts staff profiles experts"},{"type":"team","label":"Team","group":"Cards & lists","summary":"Grid of people cards — photo, role, contact details.","shape":"grid","terms":"team team grid of people cards — photo, role, contact details. staff people colleagues about us staff people colleagues about us"},{"type":"steps","label":"Process / steps","group":"Cards & lists","summary":"Numbered process — a sequence of steps.","shape":"steps","terms":"process / steps process / steps numbered process — a sequence of steps. process how it works numbered process how it works numbered"},{"type":"checklist","label":"Checklist","group":"Cards & lists","summary":"Ticked checklist items in one or two columns.","shape":"checklist","terms":"checklist checklist ticked checklist items in one or two columns. bullets ticks list bullets ticks list"},{"type":"factList","label":"Fact list (label + value)","group":"Cards & lists","summary":"Rows of label and value — specifications, what is included, key facts.","shape":"pairs","terms":"fact list (label + value) fact list (label + value) rows of label and value — specifications, what is included, key facts. specifications facts included specifications facts included"},{"type":"gallery","label":"Gallery","group":"Media","summary":"Image grid (2–3 columns) with optional captions.","shape":"gallery","terms":"gallery gallery image grid (2–3 columns) with optional captions. photos images pictures photos images pictures"},{"type":"collage","label":"Collage (image viewer)","group":"Media","summary":"A collage of fixed height — one leading picture, a few tiles, and a chip that opens every image in a viewer. Replaces stacked full-width photos on a content page.","shape":"gallery","terms":"collage (image viewer) collage (image viewer) a collage of fixed height — one leading picture, a few tiles, and a chip that opens every image in a viewer. replaces stacked full-width photos on a content page. photos images lightbox photos images lightbox"},{"type":"beforeAfter","label":"Before / after","group":"Media","summary":"A before / after image pair.","shape":"split","terms":"before / after before / after a before / after image pair. compare comparison photos compare comparison photos"},{"type":"logoStrip","label":"Logo strip","group":"Media","summary":"A centered row of partner / client names with an optional lead-in.","shape":"chips","terms":"logo strip logo strip a centered row of partner / client names with an optional lead-in. logos clients partners logos clients partners"},{"type":"definition","label":"Dictionary entry","group":"Quote & highlight","summary":"A dictionary-style word entry — term, word class and numbered senses.","shape":"prose","terms":"dictionary entry dictionary entry a dictionary-style word entry — term, word class and numbered senses. word glossary meaning word glossary meaning"},{"type":"callout","label":"Highlighted quote","group":"Quote & highlight","summary":"A single highlighted quote or statement.","shape":"quote","terms":"highlighted quote highlighted quote a single highlighted quote or statement. quote statement highlight quote statement highlight"},{"type":"statPanel","label":"Statement panel","group":"Quote & highlight","summary":"Dark panel with a big number, statement and badges.","shape":"panel","terms":"statement panel statement panel dark panel with a big number, statement and badges. number statement dark number statement dark"},{"type":"statsBar","label":"Stats / facts","group":"Numbers","summary":"A row of stats / facts (label + value).","shape":"stats","terms":"stats / facts stats / facts a row of stats / facts (label + value). numbers statistics figures numbers statistics figures"},{"type":"timeline","label":"Timeline","group":"Numbers","summary":"A line of years with one dot per milestone, the last one highlighted, and an optional note about what is planned.","shape":"pairs","terms":"timeline timeline a line of years with one dot per milestone, the last one highlighted, and an optional note about what is planned. history years milestones history years milestones"},{"type":"serviceGrid","label":"Service cards","group":"From collections","summary":"Service cards pulled from your Services collection.","shape":"grid","terms":"service cards service cards service cards pulled from your services collection. services offering cards services offering cards"},{"type":"testimonials","label":"Testimonials","group":"From collections","summary":"Customer testimonials from your Testimonials collection.","shape":"quote","terms":"testimonials testimonials customer testimonials from your testimonials collection. reviews quotes customers reviews quotes customers"},{"type":"subpages","label":"Subpages","group":"From collections","summary":"The pages that sit under this one — photo cards, tiles, a list, a chapter row, or a band of sibling pages on a subpage.","shape":"grid","terms":"subpages subpages the pages that sit under this one — photo cards, tiles, a list, a chapter row, or a band of sibling pages on a subpage. pages navigation children pages navigation children"},{"type":"faq","label":"FAQ","group":"From collections","summary":"FAQ from your FAQ collection — list, accordion, cards or split layout.","shape":"list","terms":"faq faq faq from your faq collection — list, accordion, cards or split layout. questions answers accordion questions answers accordion"},{"type":"contactForm","label":"Contact form","group":"Contact","summary":"A contact form with an optional direct-contact card. Heading, intro, field labels and layout are all editable.","shape":"band","terms":"contact form contact form a contact form with an optional direct-contact card. heading, intro, field labels and layout are all editable. form email message form email message"},{"type":"contactSwitch","label":"Contact form switcher","group":"Contact","summary":"Two or more contact forms sharing one surface, one at a time. The visitor picks the errand and that form appears, without a page load.","shape":"band","terms":"contact form switcher contact form switcher two or more contact forms sharing one surface, one at a time. the visitor picks the errand and that form appears, without a page load. forms errand tabs forms errand tabs"},{"type":"contactCard","label":"Contact card","group":"Contact","summary":"A contact card placed anywhere, auto-filled from Contact settings. Tick what it shows.","shape":"box","terms":"contact card contact card a contact card placed anywhere, auto-filled from contact settings. tick what it shows. phone email contact details phone email contact details"},{"type":"findUs","label":"Find us (map)","group":"Contact","summary":"A map beside the address, contact and hours — auto-filled from Contact settings. Needs lat/lng on the address.","shape":"split","terms":"find us (map) find us (map) a map beside the address, contact and hours — auto-filled from contact settings. needs lat/lng on the address. map address opening hours map address opening hours"},{"type":"map","label":"Find your way (static map)","group":"Contact","summary":"A map picture with the address and two buttons that hand the route to Google Maps or Apple Maps. No third-party script runs on the page.","shape":"split","terms":"find your way (static map) find your way (static map) a map picture with the address and two buttons that hand the route to google maps or apple maps. no third-party script runs on the page. map directions route map directions route"},{"type":"ctaPanel","label":"Call to action (band)","group":"Calls to action","summary":"Full-width call-to-action band with a button.","shape":"band","terms":"call to action (band) call to action (band) full-width call-to-action band with a button. cta button call to action cta button call to action"},{"type":"ctaBox","label":"Call to action (box)","group":"Calls to action","summary":"A boxed call-to-action: heading, text and a button.","shape":"box","terms":"call to action (box) call to action (box) a boxed call-to-action: heading, text and a button. cta button call to action cta button call to action"}],"shapes":{"hero":"<i class=\"col\"><i class=\"ln w70\"></i><i class=\"ln w90\"></i><i class=\"ln w40\"></i></i><i class=\"box\"></i>","band":"<i class=\"bar\"></i><i class=\"ln w50 ctr\"></i>","prose":"<i class=\"ln w90\"></i><i class=\"ln w100\"></i><i class=\"ln w80\"></i><i class=\"ln w95\"></i>","split":"<i class=\"col\"><i class=\"ln w80\"></i><i class=\"ln w90\"></i><i class=\"ln w50\"></i></i><i class=\"box\"></i>","grid":"<i class=\"cell\"></i><i class=\"cell\"></i><i class=\"cell\"></i><i class=\"cell\"></i>","gallery":"<i class=\"img\"></i><i class=\"img\"></i><i class=\"img\"></i>","steps":"<i class=\"row\"><b class=\"num\">1</b><i class=\"ln w70\"></i></i><i class=\"row\"><b class=\"num\">2</b><i class=\"ln w55\"></i></i>","checklist":"<i class=\"row\"><b class=\"tick\">✓</b><i class=\"ln w70\"></i></i><i class=\"row\"><b class=\"tick\">✓</b><i class=\"ln w55\"></i></i>","pairs":"<i class=\"prow\"><b class=\"key\"></b><i class=\"ln w60\"></i></i><i class=\"prow\"><b class=\"key\"></b><i class=\"ln w80\"></i></i><i class=\"prow\"><b class=\"key\"></b><i class=\"ln w50\"></i></i>","quote":"<b class=\"qm\">&rdquo;</b><i class=\"ln w80\"></i><i class=\"ln w55\"></i>","panel":"<i class=\"dark\"><b class=\"big\">42</b><i class=\"ln w50 lt\"></i></i>","chips":"<i class=\"pill\"></i><i class=\"pill\"></i><i class=\"pill\"></i><i class=\"pill\"></i>","list":"<i class=\"lrow\"></i><i class=\"lrow\"></i><i class=\"lrow\"></i>","box":"<i class=\"cbox\"><i class=\"ln w60 ctr\"></i><i class=\"btn\"></i></i>","stats":"<i class=\"stat\"><b>12</b></i><i class=\"stat\"><b>98%</b></i><i class=\"stat\"><b>4.9</b></i>","auto":"<i class=\"dash\">auto</i>"}};
  var pickerSearch = (function () {
  function normalize(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
  function searchBlocks(blocks, query) {
  var words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return blocks;
  return blocks.filter(function (b) { return words.every(function (w) { return b.terms.indexOf(w) !== -1; }); });
}
  return { normalize: normalize, searchBlocks: searchBlocks };
})();

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
