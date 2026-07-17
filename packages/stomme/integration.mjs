import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, cpSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

// stomme Astro integration — injects collection-detail routes.
//
//   import stomme from '@gronare/stomme/integration';
//   import { site, features, listings } from './src/site.config.ts';
//   integrations: [stomme({ features, routes: site.routes, listings })]
//
// Two route sources, both rendered inside the SITE's Base (wired via aliases) so chrome
// + theme match:
//  1. Feature flags (blog/areas/services) — fixed package entrypoints, as before.
//  2. `listings` — for each, a prerendered detail entrypoint is generated into .astro/ and
//     injected at `<route>/[slug]`. The entrypoint hardcodes the listing's collection +
//     preset template (PostPage for `article`, CatalogPage for `catalog`). The index page
//     is a seeded managed page (stomme-gen), so only detail routes are injected here.
function resolveListings(l) {
  return (Array.isArray(l) ? l : [])
    .filter((x) => x && x.id && x.route && (x.preset === 'article' || x.preset === 'catalog'))
    .map((x) => ({ ...x, route: x.route.startsWith('/') ? x.route : `/${x.route}` }));
}

// /preview CSP allow-list: sha256 hashes of every first-party `is:inline` script body
// found in the given source trees (engine package, the site's src/, slots dir). The
// Astro compiler emits `is:inline` bodies byte-for-byte (verified against built HTML,
// compressHTML on), so a hash of the source text matches the rendered element and the
// scripts execute under the preview's strict CSP without 'unsafe-inline'. Recomputed on
// every build (the entrypoint is regenerated), so editing a script re-hashes it.
// Skipped: set:html (dynamic content — tracking/consent stay CSP-blocked in preview by
// design), src= (external file), define:vars (the compiler rewrites the body).
function inlineScriptHashes(dirs) {
  const hashes = new Set();
  const stack = dirs.filter((d) => d && existsSync(d));
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const p = resolve(cur, ent.name);
      if (ent.isDirectory()) { stack.push(p); continue; }
      if (!ent.name.endsWith('.astro')) continue;
      let src;
      try { src = readFileSync(p, 'utf8'); } catch { continue; }
      for (const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (!/\bis:inline\b/.test(m[1])) continue;
        if (/set:html|define:vars|\bsrc\s*=/.test(m[1])) continue;
        if (!m[2]) continue;
        hashes.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
      }
    }
  }
  return [...hashes].sort();
}

// Live-preview target, injected at /preview (generated so prerender is a literal
// Astro can statically resolve — a Vite `define` is substituted too late for the
// route scanner, which then prerenders the route and freezes it with empty blocks).
// SSR on server targets so the CMS draft (?data=) renders the real components;
// prerendered on `static` builds, where SSR (and thus live preview) isn't available.
function previewEntrypoint(isStatic, scriptHashes = []) {
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

// Reflected-XSS hardening. /preview renders attacker-controlled ?data= (markdown body,
// block content) through set:html; on SSR it is an unauthenticated public GET. A strict
// CSP means an injected inline <script> or on*= handler cannot run — there is no
// 'unsafe-inline' for scripts. Allowed to execute: same-origin bundled scripts ('self' —
// hoisted component scripts are never inlined, see assetsInlineLimit in the integration),
// the per-response nonce (the morph script below), and the build-time sha256 hashes of
// the engine/site's own is:inline scripts (header toggle, thanks, contact reveal — see
// inlineScriptHashes). An attacker can't mint a fitting hash or guess the nonce, so
// injected script stays inert. Styles keep 'unsafe-inline' (components author inline
// style=, which is not script execution). frame-src allows the OpenStreetMap embed the
// contact/FindUs components render. On SSR the header is authoritative; a
// <meta http-equiv> in <head> is the fallback for prerendered/static output.
const nonce = crypto.randomUUID().replace(/-/g, '');
const csp = "default-src 'self'; script-src 'self' 'nonce-" + nonce + "'${scriptHashes.length ? ' ' + scriptHashes.join(' ') : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-src 'self' https://www.openstreetmap.org; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'";
Astro.response.headers.set('Content-Security-Policy', csp);

const kind = Astro.url.searchParams.get('kind');
const raw = Astro.url.searchParams.get('data');
function decode() {
  if (!raw) return null;
  // workerd (Cloudflare SSR) has no Node Buffer — decode with atob + TextDecoder,
  // mirroring b64()'s btoa(TextEncoder) encode so UTF-8 round-trips on every runtime.
  try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)))); }
  catch { return null; }
}
const draft = decode();
let blocks = [];
if (!kind && Array.isArray(draft)) blocks = draft;
const navDraft = kind === 'header' && draft && typeof draft === 'object' ? draft : undefined;
const footerDraft = kind === 'footer' && draft && typeof draft === 'object' ? draft : undefined;
const towns = kind === 'footer'
  ? (await getCollection('towns')).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)).map((t) => ({ id: t.id, name: t.data.name }))
  : [];

// Thank-you: render the real Thanks component with the draft copy over the localized
// defaults + the site's contact settings, so the preview matches the live /thanks page.
// A submission has no real data in a preview, so the "what you sent" recap is mocked.
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

// Contact settings: render the REAL components fed the draft settings, so the
// preview is the live card + Find-us block (no hand-built mockup that can drift).
const contactDraft = kind === 'contact' && draft && typeof draft === 'object' ? draft : null;

// Service entry: render the REAL ServicePage (template chrome + the entry's composed
// blocks) from the draft, with the markdown body pre-rendered.
const serviceDraft = kind === 'service' && draft && typeof draft === 'object' ? draft : null;
const serviceHtml = serviceDraft ? await renderMarkdown(serviceDraft.body || '') : '';

// Town entry: render the REAL TownPage (hero + why body + districts + reasons +
// services as a ticked list) from the draft. TownPage takes town={ id, data }.
const townDraft = kind === 'town' && draft && typeof draft === 'object' ? draft : null;

// Identity: render the composed logo (mark + wordmark) with the SAME uploaded-vs-public
// resolution as Header — an uploaded logo (/media/… → /src/assets/media via the build-bridge)
// goes through Astro's image optimizer, so the CMS Identity pane shows the real optimized
// image. A hand-built mockup using Decap's getAsset only had a raw path, which isn't served.
const identityDraft = kind === 'identity' && draft && typeof draft === 'object' ? draft : null;
const idLogo = (identityDraft && identityDraft.logo) || {};
const idUploads = import.meta.glob('/src/assets/media/**/*.{jpg,jpeg,png,webp,avif}');
// Content stores the served /media/… path; the optimizable copy lives at /src/assets/media/…
// (synced from public/media by the build-bridge). Map one to the other.
const idLogoKey = idLogo.image && idLogo.image.startsWith('/media/') ? '/src/assets/media/' + idLogo.image.slice(7) : null;
const idOptimized = idLogoKey && idUploads[idLogoKey] ? idUploads[idLogoKey] : null;
// Favicon / apple-icon / social-share image the SAME way: a /media/… asset resolves to its
// built URL; public-root paths ('/favicon.svg', an /images/… default) are already served and
// pass through. This is what the CMS Identity pane needs — getAsset yields only the raw path.
const idAssetUrls = import.meta.glob('/src/assets/media/**/*', { query: '?url', import: 'default', eager: true });
const idAsset = (p) => (!p ? '' : (typeof p === 'string' && p.startsWith('/media/') ? (idAssetUrls['/src/assets/media/' + p.slice(7)] || p) : p));
const idName = (identityDraft && identityDraft.name) || 'Your business';
const idFav = idAsset(identityDraft && identityDraft.favicon) || '/favicon.svg';
const idApple = idAsset(identityDraft && identityDraft.appleIcon);
const idOg = idAsset(identityDraft && identityDraft.ogImage);
const idLabel = 'font-family:ui-monospace,Menlo,monospace;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;margin:0 0 10px';

// Delningskort (share cards): render the SAME layered model the real system uses, from the
// draft settings, so every image resolves on-site (no getAsset / broken img in the iframe).
// Site default = ogImage → home-hero image → a brand-colour card with the business name.
// When the master is on and a type is enabled, also show an example generated card built
// from that type's headlineField/sublineField/style/scrim/showLogo/accent + a sample item.
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
    // Resolve the type's headline/second-line FIELD picks against a sample item of the
    // matching kind (mirrors routes/og.ts: 'business' = site name, 'none' = off).
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
{/* Static/prerendered fallback: no response header is emitted, so carry the CSP in a
    <meta http-equiv>. Astro relocates a leading <meta> in a page that renders a layout
    into the document <head>. Harmless (redundant) alongside the SSR header. */}
<meta http-equiv="Content-Security-Policy" content={csp} />
{kind === 'header' ? (
  <Base title="Preview" chrome={false}><div id="preview-root"><Header nav={navDraft} /></div></Base>
) : kind === 'footer' ? (
  <Base title="Preview" chrome={false}><div id="preview-root"><Footer footer={footerDraft} towns={towns} townsHref={site.routes?.towns ?? '/areas'} /></div></Base>
) : kind === 'thanks' ? (
  <Base title="Preview"><div id="preview-root"><Thanks {...thanks} /></div></Base>
) : kind === 'contact' ? (
  <Base title="Preview"><div id="preview-root">
    <div style="display:flex;flex-direction:column;gap:2.25rem;padding:2.25rem 1.5rem">
      <div class="contact-card-block"><DirectContact data={contactDraft} tint={true} show={{ phone: true, email: true, hours: true, address: true, socials: true, map: true }} /></div>
      <FindUs data={contactDraft} showHours={true} />
    </div>
  </div></Base>
) : kind === 'service' ? (
  <Base title="Preview"><div id="preview-root"><ServicePage data={serviceDraft ?? {}} bodyHtml={serviceHtml} config={site} /></div></Base>
) : kind === 'town' ? (
  <Base title="Preview"><div id="preview-root"><TownPage town={{ id: 'preview', data: townDraft ?? {} }} config={site} /></div></Base>
) : kind === 'identity' ? (
  <Base title="Preview" chrome={false}><div id="preview-root">
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
  </div></Base>
) : kind === 'sharecards' ? (
  <Base title="Preview" chrome={false}><div id="preview-root">
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
          {/* A generated card's background is the ITEM's own photo — a neutral stand-in here,
              NOT the finished site-default image (which already has baked-in text → double text). */}
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
  </div></Base>
) : (
  <Base title="Preview"><div id="preview-root"><BlockRenderer blocks={blocks} config={site} features={features} /></div></Base>
)}
<script is:inline nonce={nonce}>
  // Live updates without reloading: the CMS keeps this iframe mounted (stable src) and
  // posts the new draft as it's typed. We re-fetch this page's HTML and MORPH it into the
  // existing #preview-root — patching only what changed — so there's no navigation and
  // unchanged nodes are left in place (no white flash, scroll/focus kept, and one-shot
  // animations like the confirmation badge don't replay). Single-flight + trailing: one
  // fetch at a time, always converging to the latest data (no fixed debounce lag).
  (function () {
    // Minimal DOM morph: align children by index, patch text/attributes in place, keep
    // matching elements. Good enough for live editing — text edits touch only text nodes;
    // structural changes (adding/reordering blocks) patch more but still never reload.
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
          var cur = document.getElementById('preview-root');
          var fresh = new DOMParser().parseFromString(html, 'text/html').getElementById('preview-root');
          if (cur && fresh) morphChildren(cur, fresh);
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
  })();
</script>
`;
}

function listingEntrypoint(l) {
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
---
<Base title={entry.data.title} description={entry.data.excerpt ?? entry.data.title} image={entry.data.seo?.image ?? entry.data.image ?? entry.data.cover}>
  <Detail ${prop}={entry} config={{ ...site, listings }} />
</Base>
`;
}

// Injected on every page (deferred module). Reveals scraper-protected contact links:
// the real tel:/mailto: + the number/email are reversed+base64 in data-t/data-d on a
// `.js-contact` anchor (Contact `protectContact` toggle), never in the served HTML.
// Decode mirrors src/protect.ts encodeContact — keep the two in sync. No-op when the
// page has no protected links.
const REVEAL = `
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

// Theme "style" support (optional). When a site sets `style` (or STOMME_STYLE is set), the
// engine splices a theme's tokens.css + theme.css into the site's own global.css, immediately
// after the engine stylesheet @import and before the site's authored rules. The resulting
// cascade is engine < tokens < theme < site — no !important anywhere. The theme directory is
// resolved from STOMME_THEMES_DIR or a `stomme-themes/themes` checkout beside the engine repo.
// A named style whose theme.css is missing throws at build (a silent neutral fallback would
// ship unstyled pixels). Without a style this plugin is never registered — output is unchanged.
const STYLE_IMPORT_RE = /@import\s+["'](?:@[\w-]+\/)?stomme\/styles\.css["'];?/;
// The site's stylesheet is `src/styles/global.css`; match by basename so a realpath'd id
// (see below) still resolves. `?query` / backslash forms are normalized before the test.
const GLOBAL_CSS_RE = /(^|\/)global\.css$/;
// A custom property left in the spliced output. Unlike a CSS comment it survives
// minification, so the astro:build:done guard can confirm the theme layer actually
// reached the emitted CSS — a green build that silently shipped no theme is the failure
// this whole path exists to prevent.
const STYLE_SENTINEL = '--stomme-style';

function styleThemePlugin(style, styleDir) {
  const tokensPath = resolve(styleDir, 'tokens.css');
  const themePath = resolve(styleDir, 'theme.css');
  return {
    name: 'stomme:style',
    enforce: 'pre',
    transform(code, id) {
      // Identify the seam by the engine @import it carries + a global.css basename, NOT by
      // an exact filesystem path. Vite resolves module ids to their realpath, which diverges
      // from a `resolve(config.root, …)` path under symlinked / pnpm checkouts (notably Linux
      // CI): the old `id === globalCssPath` check then silently no-ops and the site ships
      // unthemed with a green build. Content + basename matching fires in every build pass
      // (server AND client) and in dev, regardless of how the id was resolved.
      const bare = id.split('?')[0].replace(/\\/g, '/');
      if (!GLOBAL_CSS_RE.test(bare)) return null;
      if (!STYLE_IMPORT_RE.test(code)) return null;
      // Reload in dev when the theme files change.
      if (existsSync(tokensPath)) this.addWatchFile(tokensPath);
      this.addWatchFile(themePath);
      const tokens = existsSync(tokensPath) ? readFileSync(tokensPath, 'utf8') : '';
      const theme = readFileSync(themePath, 'utf8');
      const injected =
        `\n:root{${STYLE_SENTINEL}:${JSON.stringify(style)}}` +
        `\n/* stomme style "${style}" — tokens (fonts + shape vars) */\n${tokens}` +
        `\n/* stomme style "${style}" — theme (component layer) */\n${theme}\n`;
      return { code: code.replace(STYLE_IMPORT_RE, (m) => m + injected), map: null };
    },
  };
}

// Build-end assertion: when a style is set, at least one emitted stylesheet (or inlined
// <style>) must carry the sentinel. Cheap + target-agnostic — only .css/.html are read.
function emittedCssHasStyle(dir) {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const p = resolve(cur, ent.name);
      if (ent.isDirectory()) { stack.push(p); continue; }
      if (!/\.(css|html)$/i.test(ent.name)) continue;
      try { if (readFileSync(p, 'utf8').includes(STYLE_SENTINEL)) return true; } catch { /* skip */ }
    }
  }
  return false;
}

export default function stomme(options = {}) {
  const features = options.features || {};
  const routes = options.routes || {};
  const listings = resolveListings(options.listings);
  // Optional look & feel. `style` names a theme directory; unset ⇒ no theme layer added.
  const style = options.style || process.env.STOMME_STYLE;
  // The blog is an article listing in all but name — fold it in so detail routes go
  // through the same generated entrypoint (PostPage) as any listing.
  if (features.blog && !listings.some((l) => l.id === 'posts')) {
    listings.unshift({ id: 'posts', route: routes.blog || '/blog', label: 'Blog', preset: 'article' });
  }
  const layout = options.layout || 'src/layouts/Base.astro';
  const configPath = options.config || 'src/site.config.ts';

// Theme-coverage lookbook (/lookbook): renders EVERY block from the site's catalog (via the
// samples on each BlockDef), a surface sweep, and the shared templates — so a custom theme
// can be validated against 100% of the engine ("does anything look unthemed?"). Always on in
// `astro dev`; included in builds only with STOMME_LOOKBOOK=1.
//
// The section list lives in ONE generated module (lookbook-data.mjs) shared by two routes:
// /lookbook (the human index, one long page — unchanged output) and /lookbook/<slug> (one
// page per section, chrome-less). The per-slug pages are the A/B check's capture units:
// each section renders at the top of its own page, so a height change in one block can't
// shift the screenshots of the others (the old whole-book PDF cascaded a single change
// into "every page after it differs"). Slugs derive from the section LABEL only — never a
// positional index — so adding a sample can't rename the slugs of untouched sections.
function lookbookDataModule() {
  return `// Generated by stomme — shared lookbook section enumeration (index + per-slug pages).
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
  // Surface sweep: one representative block on every surface.
  const fg = BLOCKS.find((b) => b.type === 'featureGrid');
  const fgS = fg && (fg.sample || (Array.isArray(fg.samples) && fg.samples[0]));
  if (fgS) for (const s of ['tint', 'band', 'dark', 'gradient']) {
    const data = { ...fgS }; delete data._label;
    sections.push({ kind: 'blocks', label: 'surface · ' + s, blocks: [{ type: 'featureGrid', ...data, heading: 'On the ' + s + ' surface', style: { ...(data.style || {}), surface: s } }] });
  }
  // Shared templates + the site chrome (header/footer render on the chrome page only —
  // per-slug pages are chrome-less so a header tweak diffs ONE capture, not all of them).
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

// Deterministic template fixtures, shared by the index and the per-slug pages.
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

function lookbookEntrypoint() {
  return `---
export const prerender = true;
import Base from '@stomme/base';
import { site } from '@stomme/config';
import { BLOCKS } from '@stomme/catalog';
import BlockRenderer from '@stomme/renderer';
import Thanks from '@gronare/stomme/Thanks.astro';
import ServicePage from '@gronare/stomme/ServicePage.astro';
import TownPage from '@gronare/stomme/TownPage.astro';
import { resolveSite } from '@gronare/stomme/config';
import { buildSections, templateFixtures, LB as lb } from './lookbook-data.mjs';

const rs = resolveSite(site);
const sections = buildSections(BLOCKS);
// The one-page index renders block sections in the main sweep and the templates after
// it (the chrome section is the page's own Base chrome — nothing extra to render).
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

// One lookbook section per page (/lookbook/<slug>) — the A/B check's capture unit.
// chrome={false} isolates the section from the site header/footer (they get their own
// 'chrome' page); a Base that predates the chrome prop simply ignores it and degrades
// to per-page chrome (still per-block, just noisier on header changes).
function lookbookBlockEntrypoint() {
  return `---
export const prerender = true;
import Base from '@stomme/base';
import { site } from '@stomme/config';
import { BLOCKS } from '@stomme/catalog';
import BlockRenderer from '@stomme/renderer';
import Thanks from '@gronare/stomme/Thanks.astro';
import ServicePage from '@gronare/stomme/ServicePage.astro';
import TownPage from '@gronare/stomme/TownPage.astro';
import { resolveSite } from '@gronare/stomme/config';
import { buildSections, templateFixtures, LB as lb } from './lookbook-data.mjs';

export function getStaticPaths() {
  return buildSections(BLOCKS).map((s) => ({ params: { slug: s.slug }, props: { section: s } }));
}

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

  return {
    name: 'stomme',
    hooks: {
      'astro:config:setup': ({ command, config, injectRoute, injectScript, updateConfig, logger }) => {
        const root = fileURLToPath(config.root);
        const pkgDir = dirname(fileURLToPath(import.meta.url));

        // Mirror served public/media → gitignored src/assets/media so Astro can optimize it (src/ only), before Vite resolves the globs.
        try {
          const mediaSrc = resolve(root, 'public/media');
          const mediaDest = resolve(root, 'src/assets/media');
          rmSync(mediaDest, { recursive: true, force: true });
          if (existsSync(mediaSrc)) {
            cpSync(mediaSrc, mediaDest, { recursive: true });
            mkdirSync(mediaDest, { recursive: true });
            writeFileSync(resolve(mediaDest, '.gitignore'), '*\n'); // build-generated; never commit

            logger?.info('media: synced public/media → src/assets/media (build-bridge)');
          }
        } catch (e) {
          logger?.warn(`media build-bridge skipped: ${e?.message || e}`);
        }
        // Let the package route entrypoints import the SITE's Base + config — and, for the
        // lookbook, the site's block catalog + renderer (so site-custom blocks render too).
        const siteRenderer = resolve(root, 'src/blocks/BlockRenderer.astro');

        // Component slots — optional components mounted at named engine extension points,
        // supplied entirely via STOMME_SLOTS_DIR (mirrors STOMME_THEMES_DIR; the engine
        // hardcodes no slot location or repo name). Each slot aliases to the supplied file
        // when present, else to a noop that renders nothing, so a site with no slots dir
        // builds exactly as before.
        const SLOT_NAMES = ['footer-end', 'footer-legal-end', 'header-end', 'head-end', 'body-end'];
        const slotsDir = process.env.STOMME_SLOTS_DIR;
        const slotNoop = resolve(pkgDir, 'src/SlotNoop.astro');
        const slotAlias = {};
        const slotsOn = [];
        for (const name of SLOT_NAMES) {
          const file = slotsDir ? resolve(slotsDir, `${name}.astro`) : null;
          const on = !!(file && existsSync(file));
          slotAlias[`@stomme/slot-${name}`] = on ? file : slotNoop;
          if (on) slotsOn.push(name);
        }

        updateConfig({
          vite: {
            resolve: {
              alias: {
                '@stomme/base': resolve(root, layout),
                '@stomme/config': resolve(root, configPath),
                '@stomme/catalog': resolve(root, 'src/blocks/schema.ts'),
                '@stomme/renderer': existsSync(siteRenderer) ? siteRenderer : resolve(pkgDir, 'src/BlockRenderer.astro'),
                ...slotAlias,
              },
            },
            // Dev server must be allowed to read slot files outside the project root.
            ...(slotsDir ? { server: { fs: { allow: [slotsDir] } } } : {}),
            // Never inline hoisted component <script> chunks into the HTML (Astro inlines
            // chunks under 4 KB by default). As external /_astro/*.js files they are
            // covered by the /preview CSP's script-src 'self'; inlined they'd need
            // per-build hashes the SSR route can't know. Functionally identical on live
            // pages — larger scripts (page.js) were external already. Non-JS assets
            // (images, css) return undefined → Vite's default limit still applies.
            build: { assetsInlineLimit: (path) => (/\.m?js$/.test(path) ? false : undefined) },
          },
        });

        // Reveal scraper-protected phone/email links in the browser (see REVEAL).
        injectScript('page', REVEAL);

        const enabled = [];
        for (const name of slotsOn) enabled.push(`slot:${name}`);
        const outDir = resolve(root, '.astro/stomme');

        // Optional theme "style": splice the theme layer into the site's global.css.
        // The themes directory is supplied entirely via STOMME_THEMES_DIR — the engine
        // hardcodes no theme location or repo name, so any theme collection can be used.
        if (style) {
          const themesDir = process.env.STOMME_THEMES_DIR;
          if (!themesDir) {
            throw new Error(
              `stomme: style "${style}" is set but STOMME_THEMES_DIR is not. ` +
              `Point it at the directory that holds your theme folders — ` +
              `a missing theme would silently ship unstyled pixels.`,
            );
          }
          const styleDir = resolve(themesDir, style);
          const themeCssPath = resolve(styleDir, 'theme.css');
          if (!existsSync(themeCssPath)) {
            throw new Error(
              `stomme: style "${style}" has no theme.css at ${themeCssPath}. ` +
              `Check STOMME_THEMES_DIR and the style name — ` +
              `a missing theme would silently ship unstyled pixels.`,
            );
          }
          updateConfig({ vite: { plugins: [styleThemePlugin(style, styleDir)] } });
          enabled.push(`style:${style}`);
        }

        // 0. Live-preview route — generated with a literal prerender per target.
        // Skip it if the site ships its own src/pages/preview.astro (a richer preview
        // that can use the site's renderer + custom blocks); that one wins, no collision.
        const isStatic = (process.env.STOMME_TARGET || 'netlify') === 'static';

        // Contact endpoint: injected on adapter builds so a `static` build stays truly
        // adapterless (an SSR route without an adapter fails the whole build). A site
        // that ships its own src/pages/api/contact.ts keeps it — we skip to avoid a
        // duplicate route (rule zero for existing sites).
        const siteContact = resolve(root, 'src/pages/api/contact.ts');
        if (!isStatic && !existsSync(siteContact)) {
          injectRoute({ pattern: '/api/contact', entrypoint: resolve(pkgDir, 'routes/contact.ts') });
          enabled.push('/api/contact');
        }
        const sitePreview = ['preview.astro', 'preview.ts', 'preview.js', 'preview.mdx']
          .some((f) => existsSync(resolve(root, 'src/pages', f)));
        if (sitePreview) {
          logger.info("using the site's own /preview (skipped the generated one)");
        } else {
          const previewFile = resolve(outDir, 'preview.astro');
          mkdirSync(outDir, { recursive: true });
          // Hash sweep covers the engine's components, the site's own (custom blocks,
          // Base chrome) and any slot components — everything that can render in /preview.
          const cspHashes = inlineScriptHashes([pkgDir, resolve(root, 'src'), slotsDir]);
          writeFileSync(previewFile, previewEntrypoint(isStatic, cspHashes));
          injectRoute({ pattern: '/preview', entrypoint: previewFile });
          enabled.push(`/preview${isStatic ? ' (static)' : ''}`);
        }

        // 0b. 404 page — a real not-found (the host serves dist/404.html with a 404 status)
        // instead of the soft-404 where unmatched paths fall back to the home page with 200.
        // Skip if the site ships its own src/pages/404.*.
        const site404 = ['404.astro', '404.md', '404.mdx', '404.html']
          .some((f) => existsSync(resolve(root, 'src/pages', f)));
        if (site404) {
          logger.info("using the site's own /404 (skipped the generated one)");
        } else {
          injectRoute({ pattern: '/404', entrypoint: '@gronare/stomme/routes/notfound.astro' });
          enabled.push('/404');
        }

        // 0c. Generated OG cards (/og/<page>.png) — prerendered, branded 1200×630 share
        // cards (routes/og.ts). Always injected: the master switch is CONTENT
        // (settings.og.enabled), which doesn't exist yet at config-setup time, so the
        // endpoint gates itself — disabled ⇒ getStaticPaths returns [] ⇒ zero pages
        // emitted and the renderer's native deps (satori/resvg/sharp) are never loaded.
        // The renderer (src/og.mjs) must NOT go through the site bundle (native deps) —
        // the endpoint runtime-imports it from its real package location via this define.
        updateConfig({ vite: { define: { __STOMME_OG_RENDERER__: JSON.stringify(pathToFileURL(resolve(pkgDir, 'src/og.mjs')).href) } } });
        injectRoute({ pattern: '/og/[...slug]', entrypoint: '@gronare/stomme/routes/og.ts' });
        enabled.push('/og/[...slug]');

        // 0d. Lookbook — the theme-coverage page (every block/variant/surface/template).
        // Always available in dev; included in builds only when STOMME_LOOKBOOK=1.
        if (command === 'dev' || process.env.STOMME_LOOKBOOK) {
          mkdirSync(outDir, { recursive: true });
          writeFileSync(resolve(outDir, 'lookbook-data.mjs'), lookbookDataModule());
          const lookbookFile = resolve(outDir, 'lookbook.astro');
          writeFileSync(lookbookFile, lookbookEntrypoint());
          injectRoute({ pattern: '/lookbook', entrypoint: lookbookFile });
          // Per-section capture pages for the A/B check (dist/lookbook/<slug>/).
          const lookbookBlockFile = resolve(outDir, 'lookbook-block.astro');
          writeFileSync(lookbookBlockFile, lookbookBlockEntrypoint());
          injectRoute({ pattern: '/lookbook/[slug]', entrypoint: lookbookBlockFile });
          enabled.push('/lookbook', '/lookbook/[slug]');
        }

        // 1. Fixed feature routes (areas/services). Blog is handled as a listing below.
        const routed = [
          { on: features.areas, prefix: routes.towns || '/areas', entrypoint: '@gronare/stomme/routes/town.astro' },
          { on: features.services, prefix: routes.services || '/services', entrypoint: '@gronare/stomme/routes/service.astro' },
        ];
        for (const r of routed) {
          if (!r.on) continue;
          injectRoute({ pattern: `${r.prefix}/[slug]`, entrypoint: r.entrypoint });
          enabled.push(`${r.prefix}/[slug]`);
        }

        // 2. Listing detail routes — one generated, prerendered entrypoint each.
        const listingsDir = resolve(outDir, 'listings');
        for (const l of listings) {
          const file = resolve(listingsDir, `${l.id}.astro`);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, listingEntrypoint(l));
          injectRoute({ pattern: `${l.route}/[slug]`, entrypoint: file });
          enabled.push(`${l.route}/[slug]`);
        }

        logger?.info(enabled.length ? `routes: ${enabled.join(', ')}` : 'no feature/listing routes enabled');
      },

      // When a style is configured, prove the theme layer reached the emitted CSS. The
      // splice runs in a Vite transform whose reach varies by target/build-pass; if it ever
      // silently no-ops (e.g. a realpath'd id, a future Astro change), the site would ship a
      // GREEN build with no theme — the worst outcome. Hard-fail instead. Cheap: scans only
      // the emitted .css/.html for the sentinel custom property.
      'astro:build:done': ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        // favicon/apple-touch-icon must serve from the ROOT (Apple/iOS); they upload into the
        // scoped /media/icons folder (keeps the CMS browser clean), so copy them to root here.
        try {
          const iconsDir = resolve(outDir, 'media/icons');
          if (existsSync(iconsDir)) {
            for (const f of readdirSync(iconsDir)) {
              const s = resolve(iconsDir, f);
              if (statSync(s).isFile()) cpSync(s, resolve(outDir, f));
            }
          }
        } catch (e) {
          logger?.warn(`media icons→root skipped: ${e?.message || e}`);
        }
        if (!style) return;
        if (emittedCssHasStyle(outDir)) {
          logger?.info(`style "${style}" verified in emitted CSS`);
          return;
        }
        throw new Error(
          `stomme: style "${style}" is configured but the theme layer is missing from the ` +
          `emitted CSS (no "${STYLE_SENTINEL}" sentinel under ${outDir}). The style splice ` +
          `silently failed — the site would ship unstyled. Failing the build.`,
        );
      },
    },
  };
}
