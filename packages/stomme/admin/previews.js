// Copied to <site>/public/admin/stomme-previews.js by stomme-gen and loaded BEFORE the site's own previews.js, so a site re-registering a name overrides the generic preview; `CMS` and `h` are Sveltia globals.
// Editors log in by email, so the login button is relabelled by matching "GitHub" — the one substring its text carries in every UI language; this IIFE runs standalone (no CMS globals) in every /admin.
(function () {
  var LOGIN_LABEL = 'Log in'; // stomme:login-label (localized by stomme-gen)
  function relabel() {
    document.querySelectorAll('button').forEach(function (b) {
      if (/github/i.test(b.textContent || '')) b.textContent = LOGIN_LABEL;
    });
  }
  new MutationObserver(relabel).observe(document.documentElement, { subtree: true, childList: true });
  document.addEventListener('DOMContentLoaded', relabel);
  relabel();
})();

// The same-window auth handoff lives in /admin/index.html <head>, not here: it must run BEFORE the CMS bundle, whose hash router would otherwise consume the token in the URL fragment.

(function () {
  if (typeof window.CMS === 'undefined' || typeof window.h === 'undefined') {
    console.warn('[stomme] CMS globals unavailable; skipping previews.');
    return;
  }
  var h = window.h;

  // These hexes are only fallbacks — the preview iframe loads /admin/stomme-site.css (stomme-gen's copy of the site's global.css), so the var() references below resolve to the SITE's tokens.
  var BRAND = '#4338ca', INK = '#1f2937', SURFACE = '#e0e7ff', PAPER = '#ffffff',
      LINE = '#e5e7eb', MUTED = '#6b7280', HIGHLIGHT = '#f59e0b';
  var SANS = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  var MONO = 'ui-monospace,Menlo,Consolas,monospace';
  // Mirrors src/fonts.ts FONT_STACKS so the theme preview reflects the font pickers.
  var FONT_STACKS = {
    system: SANS,
    serif: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif',
    grotesk: '"Helvetica Neue",Helvetica,Arial,"Segoe UI",system-ui,sans-serif',
    rounded: 'ui-rounded,"SF Pro Rounded","Hiragino Maru Gothic ProN","Segoe UI",system-ui,sans-serif',
    slab: 'Rockwell,"Rockwell Nova","Roboto Slab","DejaVu Serif",Georgia,serif',
    geometric: 'Futura,"Futura PT","Century Gothic","Avenir Next","URW Geometric",ui-sans-serif,system-ui,sans-serif',
    condensed: '"Arial Narrow","Helvetica Neue Condensed","Roboto Condensed","Liberation Sans Narrow",ui-sans-serif,sans-serif',
    humanist: 'Verdana,"Segoe UI","Lucida Grande","Lucida Sans Unicode",Geneva,Tahoma,ui-sans-serif,sans-serif',
    script: '"Snell Roundhand","Brush Script MT","Segoe Script","Bradley Hand",ui-rounded,cursive',
    mono: MONO,
    // Curated webfonts (src/fonts.ts WEBFONTS); the woff2 is not loaded in the admin preview, so the stack falls to system here.
    inter: '"Inter Variable",' + SANS,
    'inter-tight': '"Inter Tight Variable",' + SANS,
  };
  var fontFor = function (key) { return key && FONT_STACKS[key] ? FONT_STACKS[key] : SANS; };
  var cBrand = 'var(--color-brand,' + BRAND + ')', cInk = 'var(--color-ink,' + INK + ')',
      cSurface = 'var(--color-surface,' + SURFACE + ')', cPaper = 'var(--color-paper,' + PAPER + ')',
      cLine = 'var(--color-line,' + LINE + ')', cMuted = 'var(--color-muted,' + MUTED + ')';
  var fSans = 'var(--font-sans,' + SANS + ')', fMono = 'var(--font-mono,' + MONO + ')';

  // The site's real stylesheet is registered first so the preview-only .bk* rules registered after it win on conflicts.
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
  // The iframe stays MOUNTED across edits: returning its src UNCHANGED is what stops the CMS's React from reloading (and flickering) it — new drafts ride in on postMessage and /preview swaps #preview-root in place.
  var FRAME_STYLE = { width: '100%', height: '100vh', border: '0', display: 'block', background: '#fff' };
  var LOGO_FRAME_STYLE = { width: '100%', height: '88px', border: '0', display: 'block', background: 'transparent' };
  // Per-id frame state; a React ref captures the real <iframe> node, since the CMS renders the preview inside its own frame where getElementById from here would not find it.
  var FRAMES = {};
  function liveFrame(id, baseSrc, data, style) {
    var rec = FRAMES[id] || (FRAMES[id] = {});
    if (!rec.ref) rec.ref = function (el) { rec.el = el; if (!el) rec.src = null; };
    if (!rec.src) {
      // First mount (or after unmount): bake the data into the src so the frame SSR-renders it immediately.
      var sep = baseSrc.indexOf('?') >= 0 ? '&' : '?';
      rec.src = baseSrc + sep + 'data=' + encodeURIComponent(data);
    } else if (rec.el && rec.el.contentWindow) {
      rec.el.contentWindow.postMessage({ type: 'stomme:preview', data: data }, '*');
    }
    return h('iframe', { src: rec.src, style: style || FRAME_STYLE, ref: rec.ref });
  }
  var PagePreview = function (props) {
    return liveFrame('stomme-preview', '/preview', b64(jsBlocks(props.entry)));
  };

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
    var cover = v(e, 'cover');
    var coverUrl = '';
    try { if (cover && props.getAsset) coverUrl = String(props.getAsset(cover)); } catch (_e) {}
    return h('div', { className: 'bk' },
      (coverUrl && v(e, 'showCover')) ? h('img', { src: coverUrl, style: { width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: '12px', display: 'block', marginBottom: '18px' } }) : null,
      h('p', { className: 'bk-post-date' }, v(e, 'date')),
      h('h1', { className: 'bk-h1' }, v(e, 'title')),
      v(e, 'excerpt') ? h('p', { className: 'bk-intro' }, v(e, 'excerpt')) : null,
      h('div', { style: { marginTop: '18px', maxWidth: '60ch', color: cMuted } }, props.widgetFor ? props.widgetFor('body') : null),
      note('Blog post — the full article renders on its own page.'));
  };


  var ThemePreview = function (props) {
    var e = props.entry;
    var g = function (k, d) { var x = e.getIn(['data', k]); return x == null || x === '' ? d : x; };
    var brand = g('brand', BRAND), ink = g('ink', INK), onDark = g('onDark', '#fff'),
        surface = g('surface', SURFACE), paper = g('paper', PAPER), line = g('line', LINE), highlight = g('highlight', HIGHLIGHT);
    var secondary = g('secondary', '#3b82f6');
    var ebColorKey = g('eyebrowColor', 'brand');
    var ebAccent = ebColorKey === 'secondary' ? secondary : ebColorKey === 'highlight' ? highlight : brand;
    var muted = 'color-mix(in srgb, ' + ink + ' 55%, ' + paper + ')';
    // Dark-section tokens — derive from brand when unset (mirrors styles.css :root).
    var dk = g('dark', 'color-mix(in srgb, ' + brand + ' 16%, #0c0e13)'),
        dkInk = g('darkInk', '#e9ebf1'),
        dkLine = g('darkLine', 'color-mix(in srgb, ' + dkInk + ' 14%, transparent)');
    var dkCard = 'color-mix(in srgb, ' + dkInk + ' 7%, ' + dk + ')';
    var dkMuted = 'color-mix(in srgb, ' + dkInk + ' 56%, ' + dk + ')';
    var assetUrl = function (p) { try { return p && props.getAsset ? String(props.getAsset(p)) : null; } catch (_e) { return null; } };
    var dispCustom = assetUrl(g('fontCustomFile', ''));
    var bodyCustom = assetUrl(g('fontCustomBodyFile', '')) || dispCustom;
    var faces = [];
    if (dispCustom) faces.push('@font-face{font-family:"StommeFontDisplay";src:url(' + dispCustom + ');font-display:swap}');
    if (bodyCustom) faces.push('@font-face{font-family:"StommeFontBody";src:url(' + bodyCustom + ');font-display:swap}');
    var pickFont = function (key, customUrl, customFamily) {
      if (key === 'custom') return customUrl ? '"' + customFamily + '",' + SANS : SANS;
      return fontFor(key);
    };
    var dispFont = pickFont(g('fontDisplay', 'system'), dispCustom, 'StommeFontDisplay');
    var bodyFont = pickFont(g('fontBody', 'system'), bodyCustom, 'StommeFontBody');
    var swatch = function (name, color) {
      return h('div', { style: { flex: '1 1 0', minWidth: '88px' } },
        h('div', { style: { height: '52px', borderRadius: '10px', background: color, border: '1px solid ' + line } }),
        h('div', { style: { fontFamily: MONO, fontSize: '10px', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: '8px', color: muted } }, name),
        h('div', { style: { fontFamily: MONO, fontSize: '12px', color: ink } }, color));
    };
    var btn = function (label, bg, fg, border) {
      return h('span', { style: { display: 'inline-flex', borderRadius: '999px', padding: '11px 20px', fontWeight: 700, fontSize: '14px', background: bg, color: fg, border: border || '0' } }, label);
    };
    var eb = g('eyebrow', 'dash'), ebBold = eb === 'bold';
    var eyebrowSample = function (label, color) {
      var marker = eb === 'dash' ? { width: '18px', height: '2px' } : eb === 'bullet' ? { width: '7px', height: '7px', borderRadius: '50%' } : null;
      return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '10px', fontFamily: MONO, fontSize: '11px', letterSpacing: ebBold ? '.2em' : '.16em', textTransform: 'uppercase', fontWeight: ebBold ? 700 : 400, color: color } },
        marker ? h('i', { style: Object.assign({ display: 'inline-block', background: color }, marker) }) : null, label);
    };
    return h('div', { style: { background: paper, color: ink, minHeight: '100vh', padding: '32px', fontFamily: bodyFont, lineHeight: 1.5, boxSizing: 'border-box' } },
      faces.length ? h('style', {}, faces.join('')) : null,
      eyebrowSample('Colour scheme', ebAccent),
      h('div', { style: { display: 'flex', gap: '12px', margin: '12px 0 34px', flexWrap: 'wrap' } },
        swatch('Brand', brand), swatch('Secondary', secondary), swatch('Text', ink), swatch('On dark', onDark), swatch('Surface', surface), swatch('Paper', paper), swatch('Line', line), swatch('Highlight', highlight), swatch('Dark', dk)),
      h('h1', { style: { fontFamily: dispFont, fontSize: '2rem', fontWeight: 800, letterSpacing: '-.01em', margin: '0 0 10px' } }, 'Heading on a light surface'),
      h('p', { style: { color: muted, maxWidth: '52ch', margin: '0 0 18px' } }, 'Body text in the normal colour. A ',
        h('a', { style: { color: brand } }, 'link'), ' uses the brand; the eyebrow marker uses your chosen accent.'),
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' } },
        btn('Primary', brand, onDark), btn('Secondary', secondary, onDark), btn('Ghost', paper, ink, '1px solid ' + line)),
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '30px' } },
        h('span', { style: { fontFamily: MONO, fontSize: '10px', letterSpacing: '.08em', textTransform: 'uppercase', color: muted, marginRight: '4px' } }, 'Block accents'),
        [brand, secondary, highlight].map(function (c) { return h('span', { style: { display: 'inline-flex', width: '36px', height: '36px', borderRadius: '10px', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, ' + c + ' 14%, ' + paper + ')', color: c, fontWeight: 800 } }, '◆'); })),
      h('div', { style: { background: surface, borderRadius: '16px', padding: '28px', marginBottom: '24px' } },
        eyebrowSample('Accent surface', ebAccent),
        h('h2', { style: { fontFamily: dispFont, color: brand, fontSize: '1.5rem', fontWeight: 800, margin: '10px 0 8px' } }, 'Heading on the accent surface'),
        h('p', { style: { color: ink, maxWidth: '48ch', margin: 0 } }, 'Accent sections and the footer use the accent surface.')),
      h('div', { style: { background: dk, color: dkInk, borderRadius: '16px', padding: '28px' } },
        eyebrowSample('Dark section', dkInk),
        h('h2', { style: { fontFamily: dispFont, color: dkInk, fontSize: '1.5rem', fontWeight: 800, margin: '10px 0 8px' } }, 'Heading on a dark section'),
        h('p', { style: { color: dkMuted, maxWidth: '48ch', margin: '0 0 18px' } }, 'Any block can switch to the Dark surface — text turns light, cards become raised, accents stay vivid.'),
        h('div', { style: { marginBottom: '16px' } }, btn('Primary button', dkInk, dk)),
        h('div', { style: { background: dkCard, border: '1px solid ' + dkLine, borderRadius: '12px', padding: '18px 20px', color: dkInk } },
          h('div', { style: { fontFamily: MONO, fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: dkMuted, marginBottom: '6px' } }, 'Raised card'),
          h('div', { style: { fontSize: '14px' } }, 'On a dark section, cards lift with a raised fill + faint border instead of a hard outline.'))),
      h('div', { style: { background: 'linear-gradient(120deg, #12151d, #222a3a 60%, #10131a)', color: '#e9ebf1', borderRadius: '16px', padding: '28px', marginTop: '24px' } },
        eyebrowSample('Gradient surface', '#e9ebf1'),
        h('h2', { style: { fontFamily: dispFont, color: '#e9ebf1', fontSize: '1.5rem', fontWeight: 800, margin: '10px 0 8px' } }, 'Heading on a gradient'),
        h('p', { style: { color: '#aab0bd', maxWidth: '48ch', margin: 0 } }, 'The gradient surface — a slate backdrop, good behind a tall or dark hero.')));
  };

  // Every ChromePreview kind must be handled by the site's /preview route (see the starter's preview.astro), where the real components render from the draft.
  var ChromePreview = function (kind) {
    return function (props) {
      var data = props.entry.get('data');
      data = data && data.toJS ? data.toJS() : data || {};
      return liveFrame('stomme-preview-' + kind, '/preview?kind=' + kind, b64(data));
    };
  };
  var HeaderPreview = ChromePreview('header');
  var FooterPreview = ChromePreview('footer');

  // Goes through /preview rather than getAsset because getAsset yields the raw /src path, which is unserved (404); the iframe resolves uploads and public-root defaults on the site origin.
  var IdentityPreview = function (props) {
    var data = props.entry.get('data');
    data = data && data.toJS ? data.toJS() : (data || {});
    return liveFrame('stomme-preview-identity', '/preview?kind=identity', b64(data));
  };

  // Same served-asset reason as IdentityPreview; /preview reflects the pane's master toggle plus the first enabled type's headlineField/sublineField/style/scrim/showLogo/accent.
  var ShareCardsPreview = function (props) {
    var data = props.entry.get('data');
    data = data && data.toJS ? data.toJS() : (data || {});
    return liveFrame('stomme-preview-sharecards', '/preview?kind=sharecards', b64(data));
  };
  var ContactPreview = ChromePreview('contact');

  var arr = function (e, k) { var x = e.getIn(['data', k]); x = x && x.toJS ? x.toJS() : x; return Array.isArray(x) ? x : []; };

  var TownPreview = ChromePreview('town');

  var ServicePreview = ChromePreview('service');

  var STATUS = { available: ['Available', '#d1fae5', '#047857'], reserved: ['Reserved', '#fef3c7', '#b45309'], sold: ['Sold', '#e2e8f0', '#475569'] };
  var CatalogPreview = function (props, specDefs) {
    var e = props.entry;
    // Specs are keyed by the listing's config-defined keys and labelled from the specDefs stomme-gen passes in; entries written before that still carry their own [{label,value}].
    var specs = (specDefs && specDefs.length)
      ? specDefs.map(function (d) { var val = e.getIn(['data', 'specs', d.key]); return { label: d.label, value: val == null ? '' : val }; }).filter(function (r) { return r.value; })
      : arr(e, 'specs');
    var st = STATUS[v(e, 'status')] || STATUS.available;
    var cover = v(e, 'cover');
    var coverUrl = '';
    try { if (cover && props.getAsset) coverUrl = String(props.getAsset(cover)); } catch (_e) {}
    return h('div', { className: 'bk' },
      coverUrl ? h('img', { src: coverUrl, style: { width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: '12px', display: 'block', marginBottom: '16px' } }) : null,
      h('span', { className: 'bk-eyebrow' }, v(e, 'category') || 'For sale'),
      h('h1', { className: 'bk-h1' }, v(e, 'title')),
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', margin: '8px 0 4px', flexWrap: 'wrap' } },
        v(e, 'price') ? h('span', { style: { fontSize: '1.5rem', fontWeight: 800, color: cBrand } }, v(e, 'price')) : null,
        h('span', { style: { fontFamily: fMono, fontSize: '.62rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: '6px', background: st[1], color: st[2] } }, st[0])),
      specs.length ? h('dl', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', margin: '18px 0', padding: '14px 0', borderTop: '1px solid ' + cLine, borderBottom: '1px solid ' + cLine } },
        specs.map(function (s, i) {
          return h('div', { key: i },
            h('dt', { style: { fontSize: '.6rem', letterSpacing: '.06em', textTransform: 'uppercase', color: cMuted } }, s.label),
            h('dd', { style: { margin: 0, fontWeight: 600 } }, s.value));
        })) : null,
      h('div', { style: { marginTop: '18px', maxWidth: '62ch', color: cMuted } }, props.widgetFor ? props.widgetFor('body') : null),
      note('For-sale item (CatalogPage); shown as a card in the catalog list.'));
  };

  var ThanksPreview = ChromePreview('thanks');

  // Folder collections register by collection name; FILE collections by file name.
  window.CMS.registerPreviewTemplate('home', PagePreview);
  window.CMS.registerPreviewTemplate('pages', PagePreview);
  window.CMS.registerPreviewTemplate('faq', FaqPreview);
  window.CMS.registerPreviewTemplate('testimonials', TestimonialPreview);
  window.CMS.registerPreviewTemplate('towns', TownPreview);
  window.CMS.registerPreviewTemplate('services', ServicePreview);
  window.CMS.registerPreviewTemplate('posts', PostPreview);
  window.CMS.registerPreviewTemplate('site', IdentityPreview);
  window.CMS.registerPreviewTemplate('sharecards', ShareCardsPreview);
  window.CMS.registerPreviewTemplate('contact', ContactPreview);
  window.CMS.registerPreviewTemplate('theme', ThemePreview);
  window.CMS.registerPreviewTemplate('nav', HeaderPreview);
  window.CMS.registerPreviewTemplate('footer', FooterPreview);
  window.CMS.registerPreviewTemplate('thanks', ThanksPreview);

  // Exposed for an addon's previews.js so the engine never names the preview kinds itself.
  window.stommeRegisterFramePage = function (name, kind) {
    window.CMS.registerPreviewTemplate(name, function (props) {
      var data = props.entry.get('data');
      data = data && data.toJS ? data.toJS() : (data || {});
      return liveFrame('stomme-preview-' + kind, '/preview?kind=' + kind, b64(data));
    });
  };

  // Exposed so an addon's previews.js can reuse the live page preview for its own composed-page collections.
  window.stommeRegisterPage = function (name) {
    window.CMS.registerPreviewTemplate(name, PagePreview);
  };

  // Same, for a page whose heading and intro are FIELDS rather than a block — synthesised into the pageHeader block the real page renders.
  window.stommeRegisterHeadedPage = function (name, headingField, introField) {
    window.CMS.registerPreviewTemplate(name, function (props) {
      var e = props.entry;
      var head = { type: 'pageHeader', heading: v(e, headingField || 'heading'), intro: v(e, introField || 'message') };
      var blocks = jsBlocks(e);
      return liveFrame('stomme-preview', '/preview', b64(head.heading || head.intro ? [head].concat(blocks) : blocks));
    });
  };

  // stomme-gen appends a stommeRegisterListing(id, preset, specs) call per config-defined listing collection.
  window.stommeRegisterListing = function (id, preset, specs) {
    var tmpl = preset === 'catalog'
      ? function (props) { return CatalogPreview(props, specs); }
      : PostPreview;
    window.CMS.registerPreviewTemplate(id, tmpl);
  };

  // Replaces the default image button; placement/size are stored as keywords in the markdown title (`![alt](src "right small")`), which renderMarkdown parses back out.
  var ALIGN = ['center', 'left', 'right', 'wide'];
  var SIZE = ['small', 'large'];
  var IMAGE_COMPONENT = {
    id: 'image',
    label: 'Image',
    fields: [
      // No field-level media_folder — the CMS resolves it relative to the entry, so a post would upload to .../posts/src/assets/uploads and show an empty picker; config.yml's global root-relative one works.
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
  };
  window.CMS.registerEditorComponent(IMAGE_COMPONENT);
  // Sveltia's rich-text image button resolves the component named `linked-image` when `linked_images` is on (its default), so the same definition is registered under that id or the built-in src/alt/title dialog wins.
  try { window.CMS.registerEditorComponent(Object.assign({}, IMAGE_COMPONENT, { id: 'linked-image' })); } catch (e) {}
})();
