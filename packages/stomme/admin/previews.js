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
// Editors log in via email (Cloudflare Access), not GitHub — relabel Decap's
// "Login with GitHub" button. Standalone (doesn't need the CMS globals); runs in
// every site because stomme-gen copies this file into /admin.
(function () {
  function relabel() {
    document.querySelectorAll('button').forEach(function (b) {
      if (/login with github/i.test(b.textContent)) b.textContent = 'Log in';
    });
  }
  new MutationObserver(relabel).observe(document.documentElement, { subtree: true, childList: true });
  document.addEventListener('DOMContentLoaded', relabel);
})();

// NOTE: the same-window auth handoff (Arc etc.) lives in /admin/index.html <head>, NOT
// here — it must run BEFORE the Decap bundle, whose hash router would otherwise consume
// the token in the URL fragment before this (post-Decap) script could read it.

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
  // Mirrors src/fonts.ts FONT_STACKS so the theme preview reflects the font pickers.
  var FONT_STACKS = {
    system: SANS,
    serif: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif',
    grotesk: '"Helvetica Neue",Helvetica,Arial,"Segoe UI",system-ui,sans-serif',
    rounded: 'ui-rounded,"SF Pro Rounded","Hiragino Maru Gothic ProN","Segoe UI",system-ui,sans-serif',
    slab: 'Rockwell,"Rockwell Nova","Roboto Slab","DejaVu Serif",Georgia,serif',
    mono: MONO,
  };
  var fontFor = function (key) { return key && FONT_STACKS[key] ? FONT_STACKS[key] : SANS; };
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
    // Which accent the eyebrow marker uses (theme.eyebrowColor).
    var ebColorKey = g('eyebrowColor', 'brand');
    var ebAccent = ebColorKey === 'secondary' ? secondary : ebColorKey === 'highlight' ? highlight : brand;
    var muted = 'color-mix(in srgb, ' + ink + ' 55%, ' + paper + ')';
    // Dark-section tokens — derive from brand when unset (mirrors styles.css :root).
    var dk = g('dark', 'color-mix(in srgb, ' + brand + ' 16%, #0c0e13)'),
        dkInk = g('darkInk', '#e9ebf1'),
        dkLine = g('darkLine', 'color-mix(in srgb, ' + dkInk + ' 14%, transparent)');
    var dkCard = 'color-mix(in srgb, ' + dkInk + ' 7%, ' + dk + ')';
    var dkMuted = 'color-mix(in srgb, ' + dkInk + ' 56%, ' + dk + ')';
    // Apply the chosen fonts so the preview reflects the pickers — including custom
    // uploads, loaded via Decap's getAsset (resolves the upload to a usable URL).
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
    // Eyebrow sample — reflects the site-wide eyebrow style picker (dash / bullet / bold).
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
        eyebrowSample('Dark section', ebAccent),
        h('h2', { style: { fontFamily: dispFont, color: dkInk, fontSize: '1.5rem', fontWeight: 800, margin: '10px 0 8px' } }, 'Heading on a dark section'),
        h('p', { style: { color: dkMuted, maxWidth: '48ch', margin: '0 0 18px' } }, 'Any block can switch to the Dark surface — text turns light, cards become raised, accents stay vivid.'),
        h('div', { style: { marginBottom: '16px' } }, btn('Primary button', brand, onDark)),
        h('div', { style: { background: dkCard, border: '1px solid ' + dkLine, borderRadius: '12px', padding: '18px 20px', color: dkInk } },
          h('div', { style: { fontFamily: MONO, fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: dkMuted, marginBottom: '6px' } }, 'Raised card'),
          h('div', { style: { fontSize: '14px' } }, 'On a dark section, cards lift with a raised fill + faint border instead of a hard outline.'))),
      h('div', { style: { background: 'linear-gradient(120deg, #12151d, #222a3a 60%, #10131a)', color: '#e9ebf1', borderRadius: '16px', padding: '28px', marginTop: '24px' } },
        eyebrowSample('Gradient surface', ebAccent),
        h('h2', { style: { fontFamily: dispFont, color: '#e9ebf1', fontSize: '1.5rem', fontWeight: 800, margin: '10px 0 8px' } }, 'Heading on a gradient'),
        h('p', { style: { color: '#aab0bd', maxWidth: '48ch', margin: 0 } }, 'The gradient surface — a slate backdrop, good behind a tall or dark hero.')));
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

  var nested = function (e, a, b) { var x = e.getIn(['data', a, b]); return x == null ? '' : x; };
  // Identity — what each field becomes: the header logo, the browser-tab favicon, the
  // home-screen icon, and the business name (footer © / contact / structured data).
  var IdentityPreview = function (props) {
    var e = props.entry;
    var asset = function (p) { try { return p && props.getAsset ? String(props.getAsset(p)) : ''; } catch (_e) { return ''; } };
    var name = v(e, 'name') || 'Your business';
    var pre = nested(e, 'logo', 'textPre'), accent = nested(e, 'logo', 'textAccent');
    var imgUrl = asset(nested(e, 'logo', 'image'));
    var favUrl = asset(v(e, 'favicon')) || '/favicon.svg';
    var appleUrl = asset(v(e, 'appleIcon'));
    var ogUrl = asset(v(e, 'ogImage'));
    var domain = ''; try { domain = window.location.hostname.replace(/^www\./, ''); } catch (_e) {}
    var lab = function (t) { return h('p', { style: { fontFamily: fMono, fontSize: '.62rem', letterSpacing: '.14em', textTransform: 'uppercase', color: cMuted, margin: '0 0 10px' } }, t); };
    return h('div', { className: 'bk' },
      lab('Logo'),
      (imgUrl || pre)
        ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
            imgUrl ? h('img', { src: imgUrl, alt: '', style: { height: '34px', width: 'auto', display: 'block' } }) : null,
            pre ? h('span', { style: { fontFamily: 'var(--bk-font-display,' + SANS + ')', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.02em' } },
              pre, accent ? h('span', { style: { color: cBrand } }, accent) : null) : null)
        : h('p', { style: { color: cMuted, margin: 0 } }, 'No logo set'),

      h('div', { style: { marginTop: '24px' } }, lab('Browser tab'),
        h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px', maxWidth: '260px', background: cPaper, border: '1px solid ' + cLine, borderRadius: '9px 9px 0 0', padding: '8px 13px' } },
          h('img', { src: favUrl, alt: '', style: { width: '16px', height: '16px', display: 'block', flex: '0 0 auto' } }),
          h('span', { style: { fontSize: '.8rem', color: cInk, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, name))),

      appleUrl ? h('div', { style: { marginTop: '24px' } }, lab('Home-screen icon'),
        h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '7px' } },
          h('img', { src: appleUrl, alt: '', style: { width: '56px', height: '56px', borderRadius: '13px', display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,.18)' } }),
          h('span', { style: { fontSize: '.72rem', color: cMuted } }, name))) : null,

      h('div', { style: { marginTop: '24px' } }, lab('Social share'),
        ogUrl
          ? h('div', { style: { maxWidth: '340px', border: '1px solid ' + cLine, borderRadius: '14px', overflow: 'hidden', background: cPaper, boxShadow: '0 4px 16px rgba(0,0,0,.08)' } },
              h('img', { src: ogUrl, alt: '', style: { width: '100%', aspectRatio: '1200 / 630', objectFit: 'cover', display: 'block' } }),
              h('div', { style: { padding: '11px 14px', borderTop: '1px solid ' + cLine, background: 'color-mix(in srgb, ' + cSurface + ' 40%, ' + cPaper + ')' } },
                domain ? h('p', { style: { margin: 0, fontFamily: fMono, fontSize: '.62rem', letterSpacing: '.1em', textTransform: 'uppercase', color: cMuted } }, domain) : null,
                h('p', { style: { margin: '4px 0 0', color: cInk, fontWeight: 700, fontSize: '.95rem', lineHeight: 1.25 } }, name),
                h('p', { style: { margin: '3px 0 0', color: cMuted, fontSize: '.8rem' } }, 'Per-page title + description show here when shared.')))
          : h('div', { style: { maxWidth: '340px', border: '1px dashed ' + cLine, borderRadius: '14px', padding: '20px 22px', color: cMuted, fontSize: '.85rem', lineHeight: 1.45 } },
              'No social image set — links share as a small text card. Add one (≈1200×630) for a large-image card.')),

      h('p', { style: { margin: '24px 0 0', color: cMuted, fontSize: '.9rem' } }, 'Business name: ', h('span', { style: { color: cInk, fontWeight: 600 } }, name)),
      note('Logo → header/footer · favicon → browser tab · home-screen icon → saved-to-home · social share → og:image · business name → footer ©, contact, structured data.'));
  };
  // Contact — the direct-contact card look (contact page + form confirmation + footer line).
  var ContactPreview = function (props) {
    var e = props.entry;
    var cHigh = 'var(--color-highlight,' + HIGHLIGHT + ')';
    var phone = v(e, 'phone'), email = v(e, 'email');
    var hours = arr(e, 'hours'), holiday = arr(e, 'holidayHours'), socials = arr(e, 'socials');
    var st = nested(e, 'address', 'street');
    var cityLine = [nested(e, 'address', 'postcode'), nested(e, 'address', 'city')].filter(Boolean).join(' ');
    var country = nested(e, 'address', 'country');
    var hasAddr = st || cityLine || country;
    var lat = e.getIn(['data', 'address', 'lat']), lng = e.getIn(['data', 'address', 'lng']);
    var hasMap = lat != null && lat !== '' && lng != null && lng !== '';
    var dd = 0.006;
    var mapSrc = hasMap ? 'https://www.openstreetmap.org/export/embed.html?bbox=' + (lng - dd) + '%2C' + (lat - dd) + '%2C' + (lng + dd) + '%2C' + (lat + dd) + '&layer=mapnik&marker=' + lat + '%2C' + lng : '';
    var mapFrame = function (ht) { return h('iframe', { src: mapSrc, loading: 'lazy', title: 'Map', style: { width: '100%', height: ht, border: 0, display: 'block' } }); };
    var awayOn = e.getIn(['data', 'away', 'enabled']), awayMsg = nested(e, 'away', 'message');
    var sec = function (title, body) {
      return h('div', { style: { marginTop: '1.2rem' } },
        h('p', { style: { fontFamily: fMono, fontSize: '.6rem', letterSpacing: '.12em', textTransform: 'uppercase', color: cMuted, margin: '0 0 .45rem' } }, title), body);
    };
    var lab = function (t) { return h('p', { style: { fontFamily: fMono, fontSize: '.62rem', letterSpacing: '.14em', textTransform: 'uppercase', color: cMuted, margin: '0 0 10px' } }, t); };
    var notice = function (text) {
      return h('p', { style: { display: 'flex', gap: '.5rem', alignItems: 'flex-start', background: 'color-mix(in srgb, ' + cHigh + ' 14%, ' + cPaper + ')', border: '1px solid color-mix(in srgb, ' + cHigh + ' 35%, ' + cPaper + ')', borderRadius: '.6rem', padding: '.55rem .75rem', fontSize: '.85rem', margin: '0 0 1rem' } },
        h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: cHigh, marginTop: '.35rem', flex: '0 0 auto' } }), h('span', null, text));
    };
    var hoursBlock = function () {
      return h('div', null,
        holiday.map(function (hl, i) { return h('p', { key: 'h' + i, style: { margin: '0 0 .4rem', fontSize: '.85rem' } }, h('b', null, hl.when), hl.note ? ' — ' + hl.note : ''); }),
        hours.map(function (r, i) {
          return h('div', { key: i, style: { display: 'flex', flexWrap: 'wrap', columnGap: '.9rem', fontSize: '.9rem', marginBottom: '.15rem' } },
            h('span', { style: { color: cMuted, minWidth: '5.5em' } }, r.days),
            h('span', null, r.hours),
            r.note ? h('span', { style: { flexBasis: '100%', paddingLeft: '5.5em', color: cMuted, fontSize: '.8rem' } }, r.note) : null);
        }));
    };
    return h('div', { className: 'bk' },
      h('div', { style: { maxWidth: '420px', border: '1px solid ' + cLine, borderRadius: '18px', padding: '1.6rem 1.8rem', background: 'color-mix(in srgb, ' + cBrand + ' 7%, ' + cPaper + ')' } },
        (awayOn && awayMsg) ? notice(awayMsg) : null,
        h('p', { className: 'bk-eyebrow' }, 'Direct contact'),
        phone ? h('p', { style: { fontFamily: 'var(--bk-font-display,' + SANS + ')', fontSize: '1.5rem', fontWeight: 800, color: cBrand, margin: 0 } }, phone) : null,
        email ? h('p', { style: { fontWeight: 600, margin: '.5rem 0 0' } }, email) : null,
        (hours.length || holiday.length) ? sec('Opening hours', hoursBlock()) : null,
        hasAddr ? sec('Visit', h('p', { style: { margin: 0, fontSize: '.92rem', lineHeight: 1.5 } }, st, st ? h('br') : null, cityLine, cityLine ? h('br') : null, country)) : null,
        hasMap ? sec('Map', h('div', { style: { borderRadius: '.6rem', overflow: 'hidden', border: '1px solid ' + cLine, height: '130px' } }, mapFrame('130px'))) : null,
        socials.length ? sec('Follow', h('div', { style: { display: 'flex', gap: '.4rem', flexWrap: 'wrap' } },
          socials.map(function (s, i) { return h('span', { key: i, style: { fontFamily: fMono, fontSize: '.66rem', border: '1px solid ' + cLine, borderRadius: '.5rem', padding: '.25rem .55rem', background: cPaper, color: cBrand } }, s.platform); }))) : null),

      (hasMap || hasAddr) ? h('div', { style: { marginTop: '1.8rem', maxWidth: '540px' } },
        lab('As a “Find us” block'),
        h('div', { style: { display: 'grid', gridTemplateColumns: hasMap ? '1.3fr 1fr' : '1fr', border: '1px solid ' + cLine, borderRadius: '16px', overflow: 'hidden', background: cPaper } },
          hasMap ? h('div', { style: { minHeight: '180px' } }, mapFrame('100%')) : null,
          h('div', { style: { padding: '1.1rem 1.3rem', display: 'flex', flexDirection: 'column', gap: '.7rem' } },
            h('h3', { style: { margin: 0, fontFamily: 'var(--bk-font-display,' + SANS + ')', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-.02em' } }, 'Find us'),
            hasAddr ? h('p', { style: { margin: 0, fontSize: '.88rem', lineHeight: 1.5 } }, st, st ? h('br') : null, cityLine) : null,
            phone ? h('p', { style: { margin: 0, color: cBrand, fontWeight: 800, fontSize: '1.05rem' } }, phone) : null,
            hours.length ? hoursBlock() : null))) : null,

      note('The direct-contact card (top) + the Find-us block, both auto-filled from here. Each placement toggles which parts show.'));
  };

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

  // Catalog (for-sale) listing item → CatalogPage. Price, status pill, category,
  // a spec table, and the markdown body.
  var STATUS = { available: ['Available', '#d1fae5', '#047857'], reserved: ['Reserved', '#fef3c7', '#b45309'], sold: ['Sold', '#e2e8f0', '#475569'] };
  var CatalogPreview = function (props, specDefs) {
    var e = props.entry;
    // Specs are keyed by the listing's config-defined keys; pair them with the labels
    // stomme-gen passes in (specDefs). Fall back to legacy [{label,value}] if none given.
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

  // Thank-you settings pane — renders the REAL /thanks page (via /preview?kind=thanks),
  // so the preview shows the live confirmation with the site's theme + contact settings,
  // exactly like the header/footer previews. Not a hand-built mockup.
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
  window.CMS.registerPreviewTemplate('contact', ContactPreview);
  window.CMS.registerPreviewTemplate('theme', ThemePreview);
  window.CMS.registerPreviewTemplate('nav', HeaderPreview);
  window.CMS.registerPreviewTemplate('footer', FooterPreview);
  window.CMS.registerPreviewTemplate('thanks', ThanksPreview);

  // Config-defined listing collections (news / for-sale / …) get the matching preset
  // preview. stomme-gen appends stommeRegisterListing(id, preset, specs) calls for this
  // site; `specs` is the catalog listing's [{key,label}] so the preview can label them.
  window.stommeRegisterListing = function (id, preset, specs) {
    var tmpl = preset === 'catalog'
      ? function (props) { return CatalogPreview(props, specs); }
      : PostPreview;
    window.CMS.registerPreviewTemplate(id, tmpl);
  };

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
