import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

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

// Live-preview target, injected at /preview (generated so prerender is a literal
// Astro can statically resolve — a Vite `define` is substituted too late for the
// route scanner, which then prerenders the route and freezes it with empty blocks).
// SSR on server targets so the CMS draft (?data=) renders the real components;
// prerendered on `static` builds, where SSR (and thus live preview) isn't available.
function previewEntrypoint(isStatic) {
  return `---
export const prerender = ${isStatic ? 'true' : 'false'};
import Base from '@stomme/base';
import { site } from '@stomme/config';
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
import { renderMarkdown } from '@gronare/stomme/markdown';

const kind = Astro.url.searchParams.get('kind');
const raw = Astro.url.searchParams.get('data');
function decode() {
  if (!raw) return null;
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); }
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
---
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
) : (
  <Base title="Preview"><div id="preview-root"><BlockRenderer blocks={blocks} config={site} /></div></Base>
)}
<script is:inline>
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
<Base title={entry.data.title} description={entry.data.excerpt ?? entry.data.title}>
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

export default function stomme(options = {}) {
  const features = options.features || {};
  const routes = options.routes || {};
  const listings = resolveListings(options.listings);
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

const rs = resolveSite(site);
const sections = [];
for (const b of BLOCKS) {
  const list = Array.isArray(b.samples) && b.samples.length ? b.samples : b.sample ? [b.sample] : [];
  if (!list.length) { sections.push({ label: b.type + ' — NO SAMPLE (add one in the catalog)', missing: true, blocks: [] }); continue; }
  for (const s of list) {
    const data = { ...s };
    delete data._label;
    sections.push({ label: b.type + (s._label ? ' · ' + s._label : ''), blocks: [{ type: b.type, ...data }] });
  }
}
// Surface sweep: one representative block on every surface.
const fg = BLOCKS.find((b) => b.type === 'featureGrid');
const fgS = fg && (fg.sample || (Array.isArray(fg.samples) && fg.samples[0]));
const surfaces = fgS ? ['tint', 'band', 'dark', 'gradient'].map((s) => {
  const data = { ...fgS }; delete data._label;
  return { label: 'surface · ' + s, blocks: [{ type: 'featureGrid', ...data, heading: 'On the ' + s + ' surface', surface: s }] };
}) : [];
const all = sections.concat(surfaces);
const missing = all.filter((s) => s.missing).length;

const t = rs.strings.thanks;
const thanksProps = {
  eyebrow: t.eyebrow, heading: 'Thanks — a heading with an *emphasised* clause.', message: 'The confirmation lead line.',
  primaryLabel: 'Primary', primaryHref: '#lookbook', secondaryLabel: 'Secondary', secondaryHref: '#lookbook',
  recapLabel: t.recapLabel, recap: { email: 'anna@example.com', phone: '070-123 45 67', message: 'A short sample message, as submitted.' },
  showContact: false, talkLabel: t.talkLabel, who: 'Lookbook', town: 'Sampletown', toLabel: t.to, fromLabel: t.from,
};
const serviceFixture = { title: 'Service title', navLabel: 'service', summary: 'The service lede under the title.', bullets: ['Included one', 'Included two'], blocks: [] };
const townFixture = { id: 'sampletown', data: { name: 'Sampletown', heroSubtitle: 'A local landing-page fixture.', problems: ['First local problem', 'Second one'], districts: ['North', 'South'], services: ['Service one', 'Service two'] } };
const lb = 'max-width:74rem;margin:0 auto;padding:2.75rem 1.5rem 0.5rem;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;border-bottom:1px dashed #bbb;';
---
<Base title="Lookbook" description="Theme-coverage lookbook — every block, variant, surface and template.">
  <div style={lb + 'color:#888'}>stomme lookbook · {all.length} sections{missing ? ' · ' + missing + ' MISSING SAMPLES' : ''} — anything unthemed is a gap</div>
  {all.map((s) => (
    <Fragment>
      <div style={lb + (s.missing ? 'color:#b00020;font-weight:700' : 'color:#999')}>{s.label}</div>
      {s.blocks.length > 0 && <BlockRenderer blocks={s.blocks} config={site} />}
    </Fragment>
  ))}
  <div style={lb + 'color:#999'}>template · thanks — classic</div>
  <Thanks {...thanksProps} />
  <div style={lb + 'color:#999'}>template · thanks — letter</div>
  <Thanks {...thanksProps} variant="letter" />
  <div style={lb + 'color:#999'}>template · service page (ServicePage)</div>
  <ServicePage data={serviceFixture} bodyHtml="<p>A service body paragraph, rendered from markdown.</p>" config={site} />
  <div style={lb + 'color:#999'}>template · area page (TownPage)</div>
  <TownPage town={townFixture} config={site} />
</Base>
`;
}

  return {
    name: 'stomme',
    hooks: {
      'astro:config:setup': ({ command, config, injectRoute, injectScript, updateConfig, logger }) => {
        const root = fileURLToPath(config.root);
        const pkgDir = dirname(fileURLToPath(import.meta.url));
        // Let the package route entrypoints import the SITE's Base + config — and, for the
        // lookbook, the site's block catalog + renderer (so site-custom blocks render too).
        const siteRenderer = resolve(root, 'src/blocks/BlockRenderer.astro');
        updateConfig({
          vite: {
            resolve: {
              alias: {
                '@stomme/base': resolve(root, layout),
                '@stomme/config': resolve(root, configPath),
                '@stomme/catalog': resolve(root, 'src/blocks/schema.ts'),
                '@stomme/renderer': existsSync(siteRenderer) ? siteRenderer : resolve(pkgDir, 'src/BlockRenderer.astro'),
              },
            },
          },
        });

        // Reveal scraper-protected phone/email links in the browser (see REVEAL).
        injectScript('page', REVEAL);

        const enabled = [];
        const outDir = resolve(root, '.astro/stomme');

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
          writeFileSync(previewFile, previewEntrypoint(isStatic));
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

        // 0c. Lookbook — the theme-coverage page (every block/variant/surface/template).
        // Always available in dev; included in builds only when STOMME_LOOKBOOK=1.
        if (command === 'dev' || process.env.STOMME_LOOKBOOK) {
          const lookbookFile = resolve(outDir, 'lookbook.astro');
          mkdirSync(outDir, { recursive: true });
          writeFileSync(lookbookFile, lookbookEntrypoint());
          injectRoute({ pattern: '/lookbook', entrypoint: lookbookFile });
          enabled.push('/lookbook');
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
    },
  };
}
