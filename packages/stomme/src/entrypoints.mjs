// Generated rather than a shipped file so prerender is a literal Astro's route scanner can statically resolve — a Vite define is substituted too late, and the route is then prerendered and frozen with empty blocks.
export function previewEntrypoint(isStatic, scriptHashes = []) {
  return `---
export const prerender = ${isStatic ? 'true' : 'false'};
import Base from '@stomme/base';
import { Image } from 'astro:assets';
import { site, features, listings } from '@stomme/config';
import { getCollection, getEntry } from 'astro:content';
import { resolveSite } from '@gronare/stomme/config';
import { resolveLink } from '@gronare/stomme/href';
import BlockRenderer from '@gronare/stomme/BlockRenderer.astro';
import Header from '@gronare/stomme/Header.astro';
import Footer from '@gronare/stomme/Footer.astro';
import Thanks from '@gronare/stomme/Thanks.astro';
import DirectContact from '@gronare/stomme/DirectContact.astro';
import FindUs from '@gronare/stomme/blocks/FindUs.astro';
import ServicePage from '@gronare/stomme/ServicePage.astro';
import TownPage from '@gronare/stomme/TownPage.astro';
import { renderMarkdown } from '@gronare/stomme/markdown';
import AddonPreview from '@stomme/addon-preview';

const nonce = crypto.randomUUID().replace(/-/g, '');
const csp = "default-src 'self'; script-src 'self' 'nonce-" + nonce + "'${scriptHashes.length ? ' ' + scriptHashes.join(' ') : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-src 'self' https://www.openstreetmap.org https://www.google.com; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'";
Astro.response.headers.set('Content-Security-Policy', csp);

const kind = Astro.url.searchParams.get('kind');
const raw = Astro.url.searchParams.get('data');
function decode() {
  if (!raw) return null;
  // workerd (Cloudflare SSR) has no Node Buffer: atob + TextDecoder must mirror admin/previews.js b64()'s btoa(TextEncoder) encode or UTF-8 breaks.
  try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)))); }
  catch { return null; }
}
const draft = decode();
let blocks = [];
if (!kind && Array.isArray(draft)) blocks = draft;
const navDraft = kind === 'header' && draft && typeof draft === 'object' ? draft : undefined;
const footerDraft = kind === 'footer' && draft && typeof draft === 'object' ? { showContact: true, ...draft } : undefined;
const towns = kind === 'footer'
  ? (await getCollection('towns')).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)).map((t) => ({ id: t.id, name: t.data.name }))
  : [];

let thanks = null;
if (kind === 'thanks') {
  const rs = resolveSite(site);
  const t = rs.strings.thanks;
  const c = rs.strings.contact;
  const td = draft && typeof draft === 'object' ? draft : {};
  const settings = (await getEntry('settings', 'site'))?.data ?? {};
  const ct = (await getEntry('contact', 'contact'))?.data ?? {};
  thanks = {
    variant: td.variant,
    town: (ct.address && ct.address.city) || undefined,
    toLabel: t.to,
    fromLabel: t.from,
    eyebrow: t.eyebrow,
    heading: (td.heading || '').replace('{name}', ''),
    message: td.message || '',
    primaryLabel: (td.button && td.button.label) || '',
    primaryHref: resolveLink(td.button && td.button.link, '/'),
    secondaryLabel: (td.button2 && td.button2.label) || '',
    secondaryHref: resolveLink(td.button2 && td.button2.link, '/'),
    recapLabel: t.recapLabel,
    recap: {
      emailLabel: c.email, email: ct.email || 'name@example.com',
      phoneLabel: c.phone, phone: ct.phone || '070 123 45 67',
      messageLabel: c.message, message: 'Hi! I would like to book a meeting next week if that works for you.',
    },
    showContact: td.showContact === true && !!(ct.phone || ct.email),
    talkLabel: t.talkLabel,
    who: settings.name,
  };
}

const contactDraft = kind === 'contact' && draft && typeof draft === 'object' ? draft : null;

const serviceDraft = kind === 'service' && draft && typeof draft === 'object' ? draft : null;
const serviceHtml = serviceDraft ? await renderMarkdown(serviceDraft.body || '') : '';

const townDraft = kind === 'town' && draft && typeof draft === 'object' ? draft : null;

const identityDraft = kind === 'identity' && draft && typeof draft === 'object' ? draft : null;
const idLogo = (identityDraft && identityDraft.logo) || {};
const idUploads = import.meta.glob('/src/assets/media/**/*.{jpg,jpeg,png,webp,avif}');
// Content stores the served /media/… path; the optimizable copy lives at /src/assets/media/… (synced from public/media by the build-bridge), so swap the 7-char /media/ prefix.
const idLogoKey = idLogo.image && idLogo.image.startsWith('/media/') ? '/src/assets/media/' + idLogo.image.slice(7) : null;
const idOptimized = idLogoKey && idUploads[idLogoKey] ? idUploads[idLogoKey] : null;
const idAssetUrls = import.meta.glob('/src/assets/media/**/*', { query: '?url', import: 'default', eager: true });
const idAsset = (p) => (!p ? '' : (typeof p === 'string' && p.startsWith('/media/') ? (idAssetUrls['/src/assets/media/' + p.slice(7)] || p) : p));
const idName = (identityDraft && identityDraft.name) || 'Your business';
const idFav = idAsset(identityDraft && identityDraft.favicon) || '/favicon.svg';
const idApple = idAsset(identityDraft && identityDraft.appleIcon);
const idOg = idAsset(identityDraft && identityDraft.ogImage);
const idLabel = 'font-family:ui-monospace,Menlo,monospace;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;margin:0 0 10px';

const shareDraft = kind === 'sharecards' && draft && typeof draft === 'object' ? draft : null;
const scName = (shareDraft && shareDraft.name) || 'Your business';
const scOgImage = idAsset(shareDraft && shareDraft.ogImage);
let scHomeHero = '';
if (shareDraft && !scOgImage) {
  try {
    const home = (await getEntry('home', 'home'))?.data;
    const hb = (home && Array.isArray(home.blocks) ? home.blocks : []).find((b) => (b.type === 'hero' || b.type === 'coverHero') && b.media && b.media.image);
    scHomeHero = idAsset(hb && hb.media.image);
  } catch (e) { /* no home entry — brand card */ }
}
const scDefaultImg = scOgImage || scHomeHero;
const scBrand = ((await getEntry('theme', 'theme'))?.data || {}).brand || '#4338ca';
const scOg = (shareDraft && shareDraft.og) || {};
const scTypes = scOg.types || {};
let scExample = null;
if (shareDraft && scOg.enabled) {
  const key = Object.keys(scTypes).find((k) => scTypes[k] && scTypes[k].enabled);
  if (key) {
    const t = scTypes[key] || {};
    // Field picks resolve against a sample item of the matching kind, mirroring routes/og.ts ('business' = site name, 'none' = off) — keep the two in sync.
    const scKind = key === 'towns' ? 'towns' : key === 'services' ? 'services'
      : (((listings || []).find((l) => l.id === key) || {}).preset === 'catalog' ? 'catalog' : 'article');
    const scSamples = {
      article: { title: 'A headline from the item', date: '2026-07-15', excerpt: 'A short excerpt from the item.' },
      catalog: { title: 'Example item', price: '12 000 kr', status: 'Available', category: 'Category', date: '2026-07-15' },
      towns: { name: 'Sampletown', title: 'Sampletown', heroSubtitle: 'A local line from the item' },
      services: { title: 'A service title', navLabel: 'Service', summary: 'A short summary from the item.' },
    };
    const scSample = scSamples[scKind];
    const scPick = (k) => (!k || k === 'none' ? '' : k === 'business' ? scName : (scSample[k] || ''));
    const overlay = scPick(t.headlineField || (scKind === 'towns' ? 'name' : 'title')) || scSample.title || scName;
    const subline = scPick(t.sublineField || (scKind === 'catalog' ? 'price' : 'none'));
    const alpha = Math.min(100, Math.max(0, typeof t.scrim === 'number' ? t.scrim : 55)) / 100;
    const style = t.style || 'editorial';
    const scrim = style === 'bold'
      ? 'linear-gradient(rgba(12,14,19,' + (alpha * 0.85).toFixed(3) + '),rgba(12,14,19,' + Math.min(1, alpha * 1.15).toFixed(3) + '))'
      : style === 'ops'
      ? 'linear-gradient(to right, rgba(12,14,19,' + Math.min(1, alpha * 1.2).toFixed(3) + ') 0%, rgba(12,14,19,' + (alpha * 0.9).toFixed(3) + ') 45%, rgba(12,14,19,0) 82%)'
      : 'linear-gradient(to top, rgba(12,14,19,' + alpha.toFixed(3) + ') 0%, rgba(12,14,19,' + (alpha * 0.85).toFixed(3) + ') 30%, rgba(12,14,19,0) 66%)';
    scExample = {
      overlay,
      tagline: subline,
      showLogo: t.showLogo !== false,
      accent: t.accent || scBrand,
      scrim,
      justify: style === 'editorial' ? 'flex-end' : 'center',
      align: style === 'bold' ? 'center' : 'flex-start',
      textAlign: style === 'bold' ? 'center' : 'left',
    };
  }
}
---
{/* Static/prerendered output emits no response header, so carry the CSP in a leading <meta> that Astro relocates into the document <head>; redundant but harmless under SSR. */}
<meta http-equiv="Content-Security-Policy" content={csp} />
{kind === 'header' ? (
  <Base title="Preview" chrome={false}><Header nav={navDraft} /></Base>
) : kind === 'footer' ? (
  <Base title="Preview" chrome={false}><Footer footer={footerDraft} towns={towns} townsHref={site.routes?.towns ?? '/areas'} /></Base>
) : kind === 'thanks' ? (
  <Base title="Preview"><Thanks {...thanks} /></Base>
) : kind === 'contact' ? (
  <Base title="Preview">
    <div style="display:flex;flex-direction:column;gap:2.25rem;padding:2.25rem 1.5rem">
      <div class="contact-card-block"><DirectContact data={contactDraft} tint={true} show={{ phone: true, email: true, hours: true, address: true, socials: true, map: true }} /></div>
      <FindUs data={contactDraft} showHours={true} site={resolveSite(site)} />
    </div>
  </Base>
) : kind === 'service' ? (
  <Base title="Preview"><ServicePage data={serviceDraft ?? {}} bodyHtml={serviceHtml} config={site} /></Base>
) : kind === 'town' ? (
  <Base title="Preview"><TownPage town={{ id: 'preview', data: townDraft ?? {} }} config={site} /></Base>
) : kind === 'identity' ? (
  <Base title="Preview" chrome={false}>
    <div style="padding:1.5rem;color:var(--color-ink,#1f2937);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.5">
      <p style={idLabel}>Logo</p>
      <div class="logo" style="display:flex;align-items:center;gap:0.75rem">
        {idLogo.image && (idOptimized
          ? <Image class="logo-mark" src={idOptimized()} alt={idLogo.alt ?? ''} />
          : <img class="logo-mark" src={idLogo.image} alt={idLogo.alt ?? ''} />)}
        {idLogo.textPre && <span class="logo-word">{idLogo.textPre}<span class="accent">{idLogo.textAccent}</span></span>}
        {!idLogo.image && !idLogo.textPre && <span style="color:#6b7280">No logo set</span>}
      </div>

      <p style={idLabel + ';margin-top:26px'}>Browser tab</p>
      <div style="display:inline-flex;align-items:center;gap:8px;max-width:260px;background:var(--color-paper,#fff);border:1px solid var(--color-line,#e5e7eb);border-radius:9px 9px 0 0;padding:8px 13px">
        <img src={idFav} alt="" style="width:16px;height:16px;display:block;flex:0 0 auto" />
        <span style="font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{idName}</span>
      </div>

      {idApple && (
        <div style="margin-top:26px">
          <p style={idLabel}>Home-screen icon</p>
          <img src={idApple} alt="" style="width:56px;height:56px;border-radius:13px;display:block;box-shadow:0 2px 8px rgba(0,0,0,.18)" />
        </div>
      )}

      <p style={idLabel + ';margin-top:26px'}>Social share</p>
      {idOg ? (
        <div style="max-width:340px;border:1px solid var(--color-line,#e5e7eb);border-radius:14px;overflow:hidden;background:var(--color-paper,#fff);box-shadow:0 4px 16px rgba(0,0,0,.08)">
          <img src={idOg} alt="" style="width:100%;aspect-ratio:1200 / 630;object-fit:cover;display:block" />
          <div style="padding:11px 14px;border-top:1px solid var(--color-line,#e5e7eb)">
            <p style="margin:0;color:var(--color-ink,#1f2937);font-weight:700;font-size:.95rem;line-height:1.25">{idName}</p>
            <p style="margin:3px 0 0;color:#6b7280;font-size:.8rem">Per-page title + description show here when shared.</p>
          </div>
        </div>
      ) : (
        <div style="max-width:340px;border:1px dashed var(--color-line,#e5e7eb);border-radius:14px;padding:20px 22px;color:#6b7280;font-size:.85rem;line-height:1.45">No social image set — links share as a small text card. Add one (≈1200×630) for a large-image card.</div>
      )}

      <p style="margin-top:26px;color:#6b7280;font-size:.9rem">Business name: <span style="color:var(--color-ink,#1f2937);font-weight:600">{idName}</span></p>
    </div>
  </Base>
) : kind === 'sharecards' ? (
  <Base title="Preview" chrome={false}>
    <div style="padding:1.5rem;color:var(--color-ink,#1f2937);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.5">
      <p style={idLabel}>Site default share image</p>
      {scDefaultImg ? (
        <div style="max-width:420px;border:1px solid var(--color-line,#e5e7eb);border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08)">
          <img src={scDefaultImg} alt="" style="width:100%;aspect-ratio:1200 / 630;object-fit:cover;display:block" />
        </div>
      ) : (
        <div style={'max-width:420px;aspect-ratio:1200 / 630;border-radius:14px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;color:#fff;box-sizing:border-box;padding:7%;background:' + scBrand}>
          <div style="font-family:ui-monospace,Menlo,monospace;font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:8px">Share card</div>
          <div style="font-weight:800;font-size:1.7rem;line-height:1.08">{scName}</div>
        </div>
      )}
      <p style="margin-top:8px;color:#6b7280;font-size:.8rem">{scOgImage ? 'Your uploaded default image.' : (scHomeHero ? 'No default set — using the home hero image.' : 'No default set — a brand-colour card with your business name.')}</p>

      <p style={idLabel + ';margin-top:26px'}>Generated cards</p>
      {scExample ? (
        <>
        <div style="position:relative;max-width:420px;aspect-ratio:1200 / 630;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#6b7a88 0%,#3a4552 55%,#232a33 100%);box-shadow:0 8px 30px rgba(0,0,0,.22)">
          {/* A generated card's background is the ITEM's own photo — a neutral stand-in here, NOT the site-default image, which already has baked-in text (double text). */}
          <div style={'position:absolute;inset:0;background:' + scExample.scrim}></div>
          {scExample.showLogo && <div style="position:absolute;top:7%;left:7%;font-weight:800;font-size:1rem;color:#fff">{scName}</div>}
          <div style={'position:absolute;inset:0;display:flex;flex-direction:column;justify-content:' + scExample.justify + ';align-items:' + scExample.align + ';padding:7%;box-sizing:border-box;color:#fff'}>
            <div style={'width:58px;height:5px;border-radius:3px;margin-bottom:16px;background:' + scExample.accent}></div>
            <div style={'font-family:ui-monospace,Menlo,monospace;font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:10px;text-align:' + scExample.textAlign}>{scName}</div>
            <div style={'font-weight:800;font-size:1.6rem;line-height:1.08;text-align:' + scExample.textAlign}>{scExample.overlay}</div>
            {scExample.tagline && <div style={'margin-top:12px;font-size:.95rem;color:rgba(255,255,255,.85);text-align:' + scExample.textAlign}>{scExample.tagline}</div>}
          </div>
        </div>
        <p style="margin-top:8px;color:#6b7280;font-size:.8rem">Example — the real card is built from each item's own photo.</p>
        </>
      ) : (
        <p style="color:#6b7280;font-size:.9rem;margin:0">Cards are off — pages share the site default image above.</p>
      )}
    </div>
  </Base>
) : kind ? (
  <Base title="Preview">
    <AddonPreview kind={kind} draft={draft} config={site} />
  </Base>
) : (
  <Base title="Preview"><BlockRenderer blocks={blocks} config={site} features={features} /></Base>
)}
<script is:inline nonce={nonce}>
  // The CMS keeps this iframe mounted and posts each draft; re-fetching and MORPHING the layout's own <main> patches only what changed, so there is no reload, no white flash, scroll and focus survive, and one-shot animations do not replay. Single-flight with a trailing run always converges on the latest data.
  (function () {
    // Aligns children by index and patches text/attributes in place: a text edit touches only text nodes, a structural change patches more, neither reloads.
    function morph(from, to) {
      if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) {
        from.parentNode.replaceChild(to.cloneNode(true), from);
        return;
      }
      if (from.nodeType === 3 || from.nodeType === 8) { // text / comment
        if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
        return;
      }
      if (from.nodeType === 1) { // element
        var i, name, attrs = to.attributes;
        for (i = from.attributes.length - 1; i >= 0; i--) {
          name = from.attributes[i].name;
          if (!to.hasAttribute(name)) from.removeAttribute(name);
        }
        for (i = 0; i < attrs.length; i++) {
          if (from.getAttribute(attrs[i].name) !== attrs[i].value) from.setAttribute(attrs[i].name, attrs[i].value);
        }
        morphChildren(from, to);
      }
    }
    function morphChildren(from, to) {
      var toKids = to.childNodes;
      while (from.childNodes.length > toKids.length) from.removeChild(from.lastChild);
      for (var i = 0; i < toKids.length; i++) {
        if (from.childNodes[i]) morph(from.childNodes[i], toKids[i]);
        else from.appendChild(toKids[i].cloneNode(true));
      }
    }
    var inflight = false, pending = null, applied = null;
    function update(data) {
      if (data === applied) return;
      if (inflight) { pending = data; return; }
      inflight = true; applied = data;
      var u = new URL(location.href);
      u.searchParams.set('data', data);
      fetch(u.toString(), { headers: { 'X-Preview-Swap': '1' } })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var cur = document.querySelector('main');
          var fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('main');
          if (cur && fresh) {
            morphChildren(cur, fresh);
            // A morph never re-runs a page's island, so anything that painted itself on load would sit at its empty first state for every edit after the first — the page listens for this and paints again.
            cur.dispatchEvent(new CustomEvent('stomme:preview-morph', { bubbles: true }));
          }
        })
        .catch(function () {})
        .then(function () {
          inflight = false;
          if (pending !== null) { var d = pending; pending = null; update(d); }
        });
    }
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'stomme:preview' && typeof e.data.data === 'string') update(e.data.data);
    });

    if (window.top !== window) (function () {
      var syncTop = window.top, applyingUntil = 0, geomRaf = 0, scrollRaf = 0;
      function postGeometry() {
        geomRaf = 0;
        var main = document.querySelector('main'), sections = [], i, r;
        if (main) for (i = 0; i < main.children.length; i++) {
          r = main.children[i].getBoundingClientRect();
          sections.push({ top: r.top + window.scrollY, height: r.height });
        }
        try { syncTop.postMessage({ type: 'stomme:preview-geometry', sections: sections, scrollHeight: document.documentElement.scrollHeight, viewport: window.innerHeight }, '*'); } catch (e) {}
      }
      function reportGeometry() { if (!geomRaf) geomRaf = requestAnimationFrame(postGeometry); }
      window.addEventListener('message', function (e) {
        if (!e.data || e.data.type !== 'stomme:preview-scrollto' || typeof e.data.top !== 'number') return;
        applyingUntil = Date.now() + 250;
        window.scrollTo(0, e.data.top);
      });
      window.addEventListener('scroll', function () {
        if (scrollRaf || Date.now() < applyingUntil) return;
        scrollRaf = requestAnimationFrame(function () {
          scrollRaf = 0;
          if (Date.now() < applyingUntil) return;
          try { syncTop.postMessage({ type: 'stomme:preview-scrolled', top: window.scrollY }, '*'); } catch (e) {}
        });
      }, { passive: true });
      document.addEventListener('stomme:preview-morph', reportGeometry);
      window.addEventListener('load', reportGeometry);
      window.addEventListener('resize', reportGeometry);
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(reportGeometry);
        ro.observe(document.body);
        var m = document.querySelector('main');
        if (m) ro.observe(m);
      }
      reportGeometry();
    })();
  })();
</script>
`;
}

export function listingEntrypoint(l) {
  const catalog = l.preset === 'catalog';
  const tmpl = catalog ? 'CatalogPage' : 'PostPage';
  const prop = catalog ? 'entry' : 'post';
  return `---
import Base from '@stomme/base';
import { site, listings } from '@stomme/config';
import Detail from '@gronare/stomme/${tmpl}.astro';
import { getCollection } from 'astro:content';
export async function getStaticPaths() {
  const items = await getCollection(${JSON.stringify(l.id)});
  return items.map((e) => ({ params: { slug: e.id }, props: { entry: e } }));
}
const { entry } = Astro.props;
// Baked in rather than looked up in the site config: a listing the blog feature injects exists only in the integration, so the detail page would find nothing to go back to.
const listing = ${JSON.stringify({ id: l.id, route: l.route, label: l.label, preset: l.preset, specs: l.specs ?? [] })};
---
<Base title={entry.data.title} description={entry.data.excerpt ?? entry.data.title} image={entry.data.seo?.image ?? entry.data.image ?? entry.data.cover}>
  <Detail ${prop}={entry} listing={listing} config={{ ...site, listings }} />
</Base>
`;
}

// The feed is generated per listing rather than injected once, because injectRoute carries no props: the collection id and route prefix have to be baked into the entrypoint.
export function listingCalendarEntrypoint(l) {
  return `export const prerender = true;
import { calendarFeed } from '@gronare/stomme/calendar';
export const GET = calendarFeed(${JSON.stringify(l.id)}, ${JSON.stringify(l.route)});
`;
}

// One generated route per non-default locale rather than a `/[locale]/…` param: a literal first segment always outranks the site's own `/[...slug]`, so `/en/about` can never be resolved as a page called "en/about".
export function localeHomeEntrypoint(locale) {
  return `---
import Base from '@stomme/base';
import BlockRenderer from '@gronare/stomme/BlockRenderer.astro';
import { getCollection } from 'astro:content';
import { site, features } from '@stomme/config';
import { resolveLocales, pickLocaleEntry, localeConfig, htmlLang } from '@gronare/stomme/i18n';

const locales = resolveLocales(site);
const { entry, locale } = pickLocaleEntry(await getCollection('home'), 'home', ${JSON.stringify(locale)}, locales);
const { data } = entry;
---
<Base title={data.seo.title} description={data.seo.description} image={data.seo.image} lang={htmlLang(locale, site)}>
  <BlockRenderer blocks={data.blocks} config={localeConfig(site, locale)} features={features} />
</Base>
`;
}

export function localePagesEntrypoint(locale) {
  return `---
import Base from '@stomme/base';
import BlockRenderer from '@gronare/stomme/BlockRenderer.astro';
import { getCollection } from 'astro:content';
import { site, features } from '@stomme/config';
import { resolveLocales, defaultLocaleEntries, pickLocaleEntry, localeConfig, localeRoutes, localePagePath, htmlLang } from '@gronare/stomme/i18n';

export async function getStaticPaths() {
  const all = await getCollection('pages');
  const locales = resolveLocales(site);
  const routes = localeRoutes(site, all);
  return defaultLocaleEntries(all, site)
    .filter((p) => p.data.published)
    .map((p) => {
      const { entry, locale } = pickLocaleEntry(all, p.id, ${JSON.stringify(locale)}, locales);
      return { params: { slug: localePagePath(\`/\${p.id}\`, ${JSON.stringify(locale)}, routes).slice(1) }, props: { page: entry, locale } };
    });
}
const { page, locale } = Astro.props;
---
<Base title={page.data.seo.title} description={page.data.seo.description} image={page.data.seo.image} lang={htmlLang(locale, site)}>
  <BlockRenderer blocks={page.data.blocks} config={localeConfig(site, locale)} features={features} />
</Base>
`;
}

export const REVEAL = `
(function () {
  function dec(s) { return s ? atob(s).split('').reverse().join('') : ''; }
  document.querySelectorAll('a.js-contact').forEach(function (a) {
    var t = dec(a.getAttribute('data-t'));
    if (t) a.setAttribute('href', a.getAttribute('data-k') + ':' + t);
    var slot = a.querySelector('.js-contact-val');
    var d = dec(a.getAttribute('data-d'));
    if (slot && d) slot.textContent = d;
    a.classList.remove('js-contact');
    a.removeAttribute('data-t'); a.removeAttribute('data-d'); a.removeAttribute('data-k');
  });
})();
`;

// Slugs for the per-section pages derive from the section LABEL only — never a positional index — so adding a sample cannot rename the slugs of untouched sections and invalidate their A/B captures.
export function lookbookDataModule() {
  return `// Generated by stomme — shared lookbook section enumeration (index + per-slug pages).
export function catalogFor(BLOCKS, ADDON_BLOCKS, features) {
  const on = features && features.booking === true;
  return on && Array.isArray(ADDON_BLOCKS) && ADDON_BLOCKS.length ? [...BLOCKS, ...ADDON_BLOCKS] : BLOCKS;
}

export function buildSections(BLOCKS) {
  const sections = [];
  for (const b of BLOCKS) {
    const list = Array.isArray(b.samples) && b.samples.length ? b.samples : b.sample ? [b.sample] : [];
    if (!list.length) { sections.push({ kind: 'blocks', label: b.type + ' — NO SAMPLE (add one in the catalog)', missing: true, blocks: [] }); continue; }
    for (const s of list) {
      const data = { ...s };
      delete data._label;
      sections.push({ kind: 'blocks', label: b.type + (s._label ? ' · ' + s._label : ''), blocks: [{ type: b.type, ...data }] });
    }
  }
  const fg = BLOCKS.find((b) => b.type === 'featureGrid');
  const fgS = fg && (fg.sample || (Array.isArray(fg.samples) && fg.samples[0]));
  if (fgS) for (const s of ['tint', 'band', 'dark', 'gradient']) {
    const data = { ...fgS }; delete data._label;
    sections.push({ kind: 'blocks', label: 'surface · ' + s, blocks: [{ type: 'featureGrid', ...data, heading: 'On the ' + s + ' surface', style: { ...(data.style || {}), surface: s } }] });
  }
  sections.push({ kind: 'thanks', label: 'template · thanks — classic' });
  sections.push({ kind: 'thanks-letter', label: 'template · thanks — letter' });
  sections.push({ kind: 'service', label: 'template · service page (ServicePage)' });
  sections.push({ kind: 'town', label: 'template · area page (TownPage)' });
  sections.push({ kind: 'chrome', label: 'site chrome · header + footer' });
  const seen = new Map();
  for (const s of sections) {
    const base = s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    s.slug = n === 1 ? base : base + '-' + n;
  }
  return sections;
}

export function templateFixtures(rs) {
  const t = rs.strings.thanks;
  return {
    thanksProps: {
      eyebrow: t.eyebrow, heading: 'Thanks — a heading with an *emphasised* clause.', message: 'The confirmation lead line.',
      primaryLabel: 'Primary', primaryHref: '#lookbook', secondaryLabel: 'Secondary', secondaryHref: '#lookbook',
      recapLabel: t.recapLabel, recap: { email: 'anna@example.com', phone: '070-123 45 67', message: 'A short sample message, as submitted.' },
      showContact: false, talkLabel: t.talkLabel, who: 'Lookbook', town: 'Sampletown', toLabel: t.to, fromLabel: t.from,
    },
    serviceFixture: { title: 'Service title', navLabel: 'service', summary: 'The service lede under the title.', bullets: ['Included one', 'Included two'], blocks: [] },
    townFixture: { id: 'sampletown', data: { name: 'Sampletown', heroSubtitle: 'A local landing-page fixture.', problems: ['First local problem', 'Second one'], districts: ['North', 'South'], services: ['Service one', 'Service two'] } },
  };
}

export const LB = 'max-width:74rem;margin:0 auto;padding:2.75rem 1.5rem 0.5rem;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;border-bottom:1px dashed #bbb;';
`;
}

export function lookbookEntrypoint() {
  return `---
export const prerender = true;
import Base from '@stomme/base';
import * as cfg from '@stomme/config';
import { BLOCKS } from '@stomme/catalog';
import { BLOCKS as ADDON_BLOCKS } from '@stomme/addon-catalog';
import BlockRenderer from '@stomme/renderer';
import Thanks from '@gronare/stomme/Thanks.astro';
import ServicePage from '@gronare/stomme/ServicePage.astro';
import TownPage from '@gronare/stomme/TownPage.astro';
import { resolveSite } from '@gronare/stomme/config';
import { buildSections, templateFixtures, catalogFor, LB as lb } from './lookbook-data.mjs';

const site = cfg.site;
const rs = resolveSite(site);
const sections = buildSections(catalogFor(BLOCKS, ADDON_BLOCKS, cfg.features));
const all = sections.filter((s) => s.kind === 'blocks');
const templates = sections.filter((s) => s.kind !== 'blocks' && s.kind !== 'chrome');
const missing = all.filter((s) => s.missing).length;
const { thanksProps, serviceFixture, townFixture } = templateFixtures(rs);
---
<Base title="Lookbook" description="Theme-coverage lookbook — every block, variant, surface and template.">
  <div style={lb + 'color:#888'}>stomme lookbook · {all.length} sections{missing ? ' · ' + missing + ' MISSING SAMPLES' : ''} — anything unthemed is a gap</div>
  {all.map((s) => (
    <Fragment>
      <div style={lb + (s.missing ? 'color:#b00020;font-weight:700' : 'color:#999')}>{s.label}</div>
      {s.blocks.length > 0 && <BlockRenderer blocks={s.blocks} config={site} />}
    </Fragment>
  ))}
  {templates.map((s) => (
    <Fragment>
      <div style={lb + 'color:#999'}>{s.label}</div>
      {s.kind === 'thanks' && <Thanks {...thanksProps} />}
      {s.kind === 'thanks-letter' && <Thanks {...thanksProps} variant="letter" />}
      {s.kind === 'service' && <ServicePage data={serviceFixture} bodyHtml="<p>A service body paragraph, rendered from markdown.</p>" config={site} />}
      {s.kind === 'town' && <TownPage town={townFixture} config={site} />}
    </Fragment>
  ))}
</Base>
`;
}

export function lookbookBlockEntrypoint() {
  return `---
export const prerender = true;
import Base from '@stomme/base';
import * as cfg from '@stomme/config';
import { BLOCKS } from '@stomme/catalog';
import { BLOCKS as ADDON_BLOCKS } from '@stomme/addon-catalog';
import BlockRenderer from '@stomme/renderer';
import Thanks from '@gronare/stomme/Thanks.astro';
import ServicePage from '@gronare/stomme/ServicePage.astro';
import TownPage from '@gronare/stomme/TownPage.astro';
import { resolveSite } from '@gronare/stomme/config';
import { buildSections, templateFixtures, catalogFor, LB as lb } from './lookbook-data.mjs';

export function getStaticPaths() {
  return buildSections(catalogFor(BLOCKS, ADDON_BLOCKS, cfg.features)).map((s) => ({ params: { slug: s.slug }, props: { section: s } }));
}

const site = cfg.site;
const { section: s } = Astro.props;
const rs = resolveSite(site);
const { thanksProps, serviceFixture, townFixture } = templateFixtures(rs);
---
<Base title={'Lookbook · ' + s.label} description="One lookbook section in isolation — position-stable capture unit for the per-block A/B check." chrome={s.kind === 'chrome'}>
  <div style={lb + (s.missing ? 'color:#b00020;font-weight:700' : 'color:#999')}>{s.label}</div>
  {s.kind === 'blocks' && s.blocks.length > 0 && <BlockRenderer blocks={s.blocks} config={site} />}
  {s.kind === 'thanks' && <Thanks {...thanksProps} />}
  {s.kind === 'thanks-letter' && <Thanks {...thanksProps} variant="letter" />}
  {s.kind === 'service' && <ServicePage data={serviceFixture} bodyHtml="<p>A service body paragraph, rendered from markdown.</p>" config={site} />}
  {s.kind === 'town' && <TownPage town={townFixture} config={site} />}
</Base>
`;
}
