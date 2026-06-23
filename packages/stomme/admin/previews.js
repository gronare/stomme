/*
 * stomme — Decap CMS preview templates (engine-provided). Copied into
 * <site>/public/admin/stomme-previews.js by `stomme-gen`, loaded before the
 * site's own previews.js. `CMS`, `h` are globals from the Decap bundle.
 *
 * Pages get a LIVE preview (the real components via the /preview route). The
 * collections/settings/chrome get rich, styled mockups (the preview iframe has no
 * site CSS, so these are self-contained, themed by the library palette below).
 * A site adds bespoke previews for its own collections in public/admin/previews.js
 * (loaded after this) — re-registering a name overrides the generic one.
 */
(function () {
  if (typeof window.CMS === 'undefined' || typeof window.h === 'undefined') {
    console.warn('[stomme] Decap globals unavailable; skipping previews.');
    return;
  }
  var h = window.h;

  // Theme-driven palette. The preview iframe loads the site's resolved stylesheet
  // (/admin/stomme-site.css, written by stomme-gen from src/styles/global.css),
  // so these variables resolve to the SITE's tokens — edit global.css + re-run
  // `cms:gen` and the mockups follow. The hex values are fallbacks for when that
  // stylesheet is absent (e.g. an older site that hasn't regenerated).
  var BRAND = '#4338ca', INK = '#1f2937', SURFACE = '#e0e7ff', PAPER = '#ffffff',
      LINE = '#e5e7eb', MUTED = '#6b7280', HIGHLIGHT = '#f59e0b';
  var SANS = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  var MONO = 'ui-monospace,Menlo,Consolas,monospace';
  var cBrand = 'var(--color-brand,' + BRAND + ')', cInk = 'var(--color-ink,' + INK + ')',
      cSurface = 'var(--color-surface,' + SURFACE + ')', cPaper = 'var(--color-paper,' + PAPER + ')',
      cLine = 'var(--color-line,' + LINE + ')', cMuted = 'var(--color-muted,' + MUTED + ')';
  var fSans = 'var(--bk-font-sans,' + SANS + ')', fMono = 'var(--bk-font-mono,' + MONO + ')';

  // Load the site's actual stylesheet first so the mockups match the live site
  // (tokens + any class overrides). The raw rules below layer the preview-only
  // scaffolding (.bk*) on top, themed via the variables above.
  window.CMS.registerPreviewStyle('/admin/stomme-site.css');

  var CSS = [
    'body{margin:0}',
    '.bk{font-family:' + fSans + ';padding:32px;color:' + cInk + ';background:' + cPaper + ';min-height:100vh;box-sizing:border-box;line-height:1.6}',
    '.bk-eyebrow{font-family:' + fMono + ';font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:' + cBrand + '}',
    '.bk-h1{font-size:2.1rem;font-weight:800;letter-spacing:-.01em;line-height:1.08;margin:12px 0 0;overflow-wrap:break-word}',
    '.bk-intro{color:' + cMuted + ';margin:14px 0 0;font-size:1.1rem;max-width:42ch}',
    '.bk-section-label{font-family:' + fMono + ';font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:' + cMuted + ';margin-top:32px}',
    '.bk-quote{max-width:520px;border-left:2px solid ' + cBrand + ';padding:4px 0 4px 20px;margin:0}',
    '.bk-quote blockquote{margin:0;font-size:1.15rem}',
    '.bk-who{margin-top:14px;font-family:' + fMono + ';font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:' + cMuted + '}',
    '.bk-q{font-weight:700;font-size:1.1rem;border-top:1px solid ' + cLine + ';padding-top:16px}',
    '.bk-a{color:' + cMuted + ';margin-top:8px;max-width:60ch}',
    '.bk-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
    '.bk-chip{font-family:' + fMono + ';font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;border:1px solid ' + cLine + ';border-radius:999px;padding:7px 13px;color:' + cInk + ';background:' + cPaper + '}',
    '.bk-foot{background:' + cSurface + ';color:' + cInk + ';border-radius:16px;padding:26px;max-width:520px}',
    '.bk-foot .b{font-weight:800}.bk-foot .r{color:' + cBrand + '}',
    '.bk-stats{display:flex;gap:28px;margin-top:18px;flex-wrap:wrap}',
    '.bk-stats .n{font-size:1.8rem;font-weight:800;color:' + cBrand + ';line-height:1}',
    '.bk-stats .l{font-family:' + fMono + ';font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:' + cMuted + ';margin-top:4px}',
    '.bk-note{margin-top:26px;font-size:.72rem;color:#9aa0ab;font-style:italic}',
    '.bk-post-date{font-family:' + fMono + ';font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:' + cMuted + '}',
    '.bk-bullets{margin:18px 0 0;padding:0;list-style:none;max-width:60ch}',
    '.bk-bullets li{position:relative;padding-left:22px;margin-top:8px;color:' + cInk + '}',
    '.bk-bullets li:before{content:"✓";position:absolute;left:0;color:' + cBrand + ';font-weight:700}',
  ].join('');
  window.CMS.registerPreviewStyle(CSS, { raw: true });

  function v(e, k) { var x = e.getIn(['data', k]); return x == null ? '' : x; }
  function note(t) { return h('p', { className: 'bk-note' }, t); }

  // ── Live page preview: the REAL components via /preview (themed, no drift). ──
  function jsBlocks(entry) {
    var b = entry.getIn(['data', 'blocks']);
    return b && b.toJS ? b.toJS() : (Array.isArray(b) ? b : []);
  }
  function b64(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  var PagePreview = function (props) {
    return h('iframe', {
      src: '/preview?data=' + encodeURIComponent(b64(jsBlocks(props.entry))),
      style: { width: '100%', height: '100vh', border: '0', display: 'block', background: '#fff' },
    });
  };

  // ── Rich collection / settings / chrome mockups ─────────────────────────────
  var TestimonialPreview = function (props) {
    var e = props.entry;
    return h('div', { className: 'bk' },
      h('figure', { className: 'bk-quote' },
        h('blockquote', {}, '“' + v(e, 'quote') + '”'),
        h('figcaption', { className: 'bk-who' }, h('b', {}, v(e, 'name')), v(e, 'role') ? ' · ' + v(e, 'role') : '')),
      note('A testimonial shown in the Testimonials block.'));
  };

  var FaqPreview = function (props) {
    var e = props.entry;
    return h('div', { className: 'bk' },
      h('div', { className: 'bk-q' }, v(e, 'question')),
      h('div', { className: 'bk-a' }, v(e, 'answer')),
      note('A question shown in the FAQ block.'));
  };

  var PostPreview = function (props) {
    var e = props.entry;
    return h('div', { className: 'bk' },
      h('p', { className: 'bk-post-date' }, v(e, 'date')),
      h('h1', { className: 'bk-h1' }, v(e, 'title')),
      v(e, 'excerpt') ? h('p', { className: 'bk-intro' }, v(e, 'excerpt')) : null,
      h('div', { style: { marginTop: '18px', maxWidth: '60ch', color: cMuted } }, props.widgetFor ? props.widgetFor('body') : null),
      note('Blog post — the full article renders on its own page.'));
  };

  var SettingsPreview = function (props) {
    var e = props.entry;
    var partners = (e.getIn(['data', 'partners']) || []); partners = partners.toJS ? partners.toJS() : partners;
    var facts = (e.getIn(['data', 'facts']) || []); facts = facts.toJS ? facts.toJS() : facts;
    var lead = v(e, 'partnersLead');
    return h('div', { className: 'bk' },
      h('div', { className: 'bk-foot' },
        h('p', { className: 'b', style: { fontSize: '1.2rem', margin: 0 } }, v(e, 'name') || 'Company name'),
        v(e, 'hq') ? h('p', { style: { margin: '8px 0 0' } }, v(e, 'hq')) : null,
        h('p', { style: { margin: '4px 0 0' } }, h('span', { className: 'r' }, v(e, 'phone')), v(e, 'email') ? '  ·  ' + v(e, 'email') : ''),
        facts.length ? h('div', { className: 'bk-stats' }, facts.map(function (f, i) {
          return h('div', { key: i }, h('div', { className: 'n' }, f.value), h('div', { className: 'l' }, f.label));
        })) : null),
      (partners.length && lead) ? h('p', { className: 'bk-section-label' }, lead) : null,
      partners.length ? h('div', { className: 'bk-chips' }, partners.map(function (x, i) { return h('span', { className: 'bk-chip', key: i }, x); })) : null,
      note('Used in the footer + the Stats / Logo-strip blocks.'));
  };

  var ThemePreview = function (props) {
    var e = props.entry;
    var g = function (k, d) { var x = e.getIn(['data', k]); return x == null || x === '' ? d : x; };
    var brand = g('brand', BRAND), ink = g('ink', INK), onDark = g('onDark', '#fff'),
        surface = g('surface', SURFACE), paper = g('paper', PAPER), line = g('line', LINE), highlight = g('highlight', HIGHLIGHT);
    var muted = 'color-mix(in srgb, ' + ink + ' 55%, ' + paper + ')';
    var swatch = function (name, color) {
      return h('div', { style: { flex: '1 1 0', minWidth: '88px' } },
        h('div', { style: { height: '52px', borderRadius: '10px', background: color, border: '1px solid ' + line } }),
        h('div', { style: { fontFamily: MONO, fontSize: '10px', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: '8px', color: muted } }, name),
        h('div', { style: { fontFamily: MONO, fontSize: '12px', color: ink } }, color));
    };
    var btn = function (label, bg, fg, border) {
      return h('span', { style: { display: 'inline-flex', borderRadius: '999px', padding: '11px 20px', fontWeight: 700, fontSize: '14px', background: bg, color: fg, border: border || '0' } }, label);
    };
    return h('div', { style: { background: paper, color: ink, minHeight: '100vh', padding: '32px', fontFamily: SANS, lineHeight: 1.5, boxSizing: 'border-box' } },
      h('span', { style: { fontFamily: MONO, fontSize: '11px', letterSpacing: '.16em', textTransform: 'uppercase', color: brand } }, 'Colour scheme'),
      h('div', { style: { display: 'flex', gap: '12px', margin: '12px 0 34px', flexWrap: 'wrap' } },
        swatch('Brand', brand), swatch('Text', ink), swatch('On dark', onDark), swatch('Surface', surface), swatch('Paper', paper), swatch('Line', line), swatch('Highlight', highlight)),
      h('h1', { style: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-.01em', margin: '0 0 10px' } }, 'Heading on a light surface'),
      h('p', { style: { color: muted, maxWidth: '52ch', margin: '0 0 18px' } }, 'Body text in the normal colour. A ',
        h('a', { style: { color: brand } }, 'link'), ' uses the brand colour, as do bullets and accents.'),
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '30px' } },
        btn('Primary button', brand, onDark), btn('Secondary', paper, ink, '1px solid ' + line), btn('Highlight', highlight, onDark)),
      h('div', { style: { background: surface, borderRadius: '16px', padding: '28px' } },
        h('span', { style: { fontFamily: MONO, fontSize: '11px', letterSpacing: '.16em', textTransform: 'uppercase', color: brand } }, 'Accent surface'),
        h('h2', { style: { color: brand, fontSize: '1.5rem', fontWeight: 800, margin: '10px 0 8px' } }, 'Heading on the accent surface'),
        h('p', { style: { color: ink, maxWidth: '48ch', margin: 0 } }, 'Accent sections and the footer use the accent surface.')));
  };

  // Header & footer: render the REAL components (real logo, nav, CTA, theme) via
  // the /preview route fed the draft entry data — accurate, with no drift. (The
  // /preview route handles ?kind=header|footer; see the starter's preview.astro.)
  var ChromePreview = function (kind) {
    return function (props) {
      var data = props.entry.get('data');
      data = data && data.toJS ? data.toJS() : data || {};
      return h('iframe', {
        src: '/preview?kind=' + kind + '&data=' + encodeURIComponent(b64(data)),
        style: { width: '100%', height: '100vh', border: '0', display: 'block', background: '#fff' },
      });
    };
  };
  var HeaderPreview = ChromePreview('header');
  var FooterPreview = ChromePreview('footer');

  var arr = function (e, k) { var x = e.getIn(['data', k]); x = x && x.toJS ? x.toJS() : x; return Array.isArray(x) ? x : []; };
  var chipRow = function (items) { return h('div', { className: 'bk-chips' }, items.map(function (s, i) { return h('span', { className: 'bk-chip', key: i }, s); })); };

  // Service-area landing (the towns collection → TownPage). Mirrors the rich town
  // fields: hero subtitle, the districts + services offered locally.
  var TownPreview = function (props) {
    var e = props.entry;
    var districts = arr(e, 'districts'), services = arr(e, 'services');
    var sub = v(e, 'heroSubtitle') || v(e, 'intro');
    return h('div', { className: 'bk' },
      h('span', { className: 'bk-eyebrow' }, 'Local service: ' + (v(e, 'name') || 'City')),
      h('h1', { className: 'bk-h1' }, v(e, 'title') || v(e, 'name')),
      sub ? h('p', { className: 'bk-intro' }, sub) : null,
      services.length ? h('p', { className: 'bk-section-label' }, 'Services offered here') : null,
      services.length ? chipRow(services) : null,
      districts.length ? h('p', { className: 'bk-section-label' }, 'Districts') : null,
      districts.length ? chipRow(districts) : null,
      note('Service-area landing page (TownPage); links from the link-chips block.'));
  };

  // Service detail (the services collection → ServicePage). Card chrome + the
  // markdown body (rendered live via widgetFor).
  var ServicePreview = function (props) {
    var e = props.entry;
    var bullets = arr(e, 'bullets');
    return h('div', { className: 'bk' },
      h('span', { className: 'bk-eyebrow' }, v(e, 'navLabel') || 'Service'),
      h('h1', { className: 'bk-h1' }, v(e, 'title')),
      v(e, 'summary') ? h('p', { className: 'bk-intro' }, v(e, 'summary')) : null,
      bullets.length ? h('ul', { className: 'bk-bullets' }, bullets.map(function (b, i) { return h('li', { key: i }, b); })) : null,
      h('div', { style: { marginTop: '20px', maxWidth: '62ch', color: cMuted } }, props.widgetFor ? props.widgetFor('body') : null),
      note('Service detail page (ServicePage); shown as a card in the Service-cards block.'));
  };

  // Folder collections register by collection name; FILE collections by file name.
  window.CMS.registerPreviewTemplate('home', PagePreview);
  window.CMS.registerPreviewTemplate('pages', PagePreview);
  window.CMS.registerPreviewTemplate('faq', FaqPreview);
  window.CMS.registerPreviewTemplate('testimonials', TestimonialPreview);
  window.CMS.registerPreviewTemplate('towns', TownPreview);
  window.CMS.registerPreviewTemplate('services', ServicePreview);
  window.CMS.registerPreviewTemplate('posts', PostPreview);
  window.CMS.registerPreviewTemplate('site', SettingsPreview);
  window.CMS.registerPreviewTemplate('theme', ThemePreview);
  window.CMS.registerPreviewTemplate('nav', HeaderPreview);
  window.CMS.registerPreviewTemplate('footer', FooterPreview);

  // ── "Image" editor component for markdown bodies ────────────────────────────
  // Overrides the default image button: caption + placement + size, no keyword
  // typing. Stores `![alt](src "right small")` that renderMarkdown lays out, and
  // round-trips back into the fields when editing.
  var ALIGN = ['center', 'left', 'right', 'wide'];
  var SIZE = ['small', 'large'];
  window.CMS.registerEditorComponent({
    id: 'image',
    label: 'Image',
    fields: [
      // No field-level media_folder: Decap resolves that relative to the entry, so a
      // post in src/content/posts/ would upload to .../posts/src/assets/uploads and show
      // an empty picker. The global media_folder (config.yml) is root-relative + works.
      { name: 'image', label: 'Image', widget: 'image' },
      { name: 'alt', label: 'Caption', widget: 'string', required: false, hint: 'Shown as the caption (and alt text).' },
      { name: 'align', label: 'Placement', widget: 'select', default: 'center', options: [
        { label: 'Centered', value: 'center' }, { label: 'Left — text wraps', value: 'left' },
        { label: 'Right — text wraps', value: 'right' }, { label: 'Wide', value: 'wide' }] },
      { name: 'size', label: 'Size', widget: 'select', required: false, default: 'normal', options: [
        { label: 'Normal', value: 'normal' }, { label: 'Small', value: 'small' }, { label: 'Large', value: 'large' }] },
    ],
    pattern: /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/,
    fromBlock: function (match) {
      var kw = (match[3] || '').toLowerCase().split(/\s+/);
      var align = 'center', size = 'normal';
      kw.forEach(function (t) { if (ALIGN.indexOf(t) >= 0) align = t; if (SIZE.indexOf(t) >= 0) size = t; });
      return { image: match[2], alt: match[1], align: align, size: size };
    },
    toBlock: function (d) {
      var kw = [];
      if (d.align && d.align !== 'center') kw.push(d.align);
      if (d.size && d.size !== 'normal') kw.push(d.size);
      var title = kw.length ? ' "' + kw.join(' ') + '"' : '';
      return '![' + (d.alt || '') + '](' + (d.image || '') + title + ')';
    },
    toPreview: function (d) {
      return '<img src="' + (d.image || '') + '" alt="' + (d.alt || '') + '" style="max-width:100%" />';
    },
  });
})();
