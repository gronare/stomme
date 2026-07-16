#!/usr/bin/env node
// stomme-gen — generate the Decap "blocks" builder widget from the site's block
// catalog and splice it into the site's admin config between the generated-block
// markers. Runs in the CONSUMER's project (process.cwd()).
//
//   npx stomme-gen                 (or wire to "cms:gen" in package.json)
//
// Reads:  <cwd>/src/blocks/schema.ts   (override: BLOCKKIT_SCHEMA)
// Writes: <cwd>/public/admin/config.yml (override: BLOCKKIT_CONFIG)
// The consumer's schema.ts imports field helpers from '@gronare/stomme/kit'; Node strips
// the TS types on import (Node 22.6+).
import { readFileSync, writeFileSync, readdirSync, copyFileSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { renderGallery } from '../admin/blocks-gallery.mjs';

const root = process.cwd();
const here = dirname(fileURLToPath(import.meta.url));

// CMS bundle: Sveltia CMS, pinned. Swapped into each site's public/admin/index.html on
// build (replacing the legacy Decap CDN tag). Bump deliberately — Sveltia is pre-1.0.
// Override for a local/vendored copy with STOMME_SVELTIA_SRC (e.g. /admin/sveltia-cms.js).
const SVELTIA_CMS_SRC = process.env.STOMME_SVELTIA_SRC || 'https://unpkg.com/@sveltia/cms@0.170.9/dist/sveltia-cms.js';

// Load the site's TS config/catalog through jiti rather than a bare dynamic import.
// Node's built-in type-stripping refuses any .ts file under node_modules, so a plain
// import of schema.ts / site.config.ts breaks the moment their import graph reaches the
// installed package's .ts (e.g. '@gronare/stomme/kit', './catalog') — which is exactly
// where a real registry install lives. jiti transpiles .ts everywhere, including
// node_modules, and resolves each module's bare specifiers from its own location.
const jiti = createJiti(import.meta.url);
const schemaPath = resolve(root, process.env.BLOCKKIT_SCHEMA || 'src/blocks/schema.ts');
const configPath = resolve(root, process.env.BLOCKKIT_CONFIG || 'public/admin/config.yml');

// CMS-less site (public/admin removed — e.g. handed over to a customer who edits the
// markdown directly): everything this generator produces lives under public/admin, so
// there is nothing to do. Graceful no-op keeps `pnpm build` (which runs stomme-gen) working.
if (!existsSync(configPath)) {
  console.log(`stomme-gen: no ${process.env.BLOCKKIT_CONFIG || 'public/admin/config.yml'} — CMS-less site, nothing to generate`);
  process.exit(0);
}

// The site's catalog. Loaded via jiti so its bare '@gronare/stomme/kit' import resolves
// against the consumer's node_modules and transpiles cleanly even when installed there.
const { BLOCKS } = await jiti.import(schemaPath);
if (!Array.isArray(BLOCKS)) {
  console.error(`No BLOCKS export found in ${schemaPath}`);
  process.exit(1);
}

// Collection→route map from the site's own config (no longer hardcoded). The site
// exports `site` (a SiteConfig) from src/site.config.ts; Node strips its TS types.
// Falls back to the package defaults when absent.
let ROUTES = { services: '/services', towns: '/areas', blog: '/blog' };
let FEATURES = null; // null = no `features` declared → fall back to folder-existence
let CMS_LOCALE = 'en'; // Decap admin UI language (config.yml `locale:`); 'en' is Decap's default
let CMS = null; // site.cms → generated `backend:` block (between # >>> cms:generated markers)
let LISTINGS = []; // config-defined collections (news/for-sale/…) → editors + seeded index
let STYLE = process.env.STOMME_STYLE || null; // optional look & feel (theme directory name)
try {
  const mod = await jiti.import(resolve(root, 'src/site.config.ts'));
  if (mod.site && mod.site.routes) ROUTES = { ...ROUTES, ...mod.site.routes };
  if (mod.site && mod.site.cmsLocale) CMS_LOCALE = mod.site.cmsLocale;
  if (mod.site && mod.site.cms) CMS = mod.site.cms;
  if (mod.site && mod.site.style) STYLE = mod.site.style;
  if (mod.features) FEATURES = { blog: false, areas: false, services: false, testimonials: false, faq: false, tracking: false, ...mod.features };
  if (Array.isArray(mod.listings))
    LISTINGS = mod.listings
      .filter((x) => x && x.id && x.route && (x.preset === 'article' || x.preset === 'catalog'))
      .map((x) => ({ ...x, route: x.route.startsWith('/') ? x.route : `/${x.route}` }));
} catch {
  /* no site.config — use defaults */
}
// The blog is an article listing in all but name — desugar it so one code path
// (editor, seeded index, dropdown source) covers blog + every listing. Honour the
// features flag, or fall back to a posts folder for sites with no features config
// (mirrors collectionEnabled). Skip if the site already declares a `posts` listing.
const blogEnabled = FEATURES
  ? !!FEATURES.blog
  : (() => { try { return readdirSync(resolve(root, 'src/content/posts')).some((f) => f.endsWith('.md')); } catch { return false; } })();
if (blogEnabled && !LISTINGS.some((l) => l.id === 'posts')) {
  LISTINGS.unshift({ id: 'posts', route: ROUTES.blog || '/blog', label: 'Blog', preset: 'article' });
}

// Optional look & feel ("style"). The theme directory is supplied entirely via
// STOMME_THEMES_DIR (the engine hardcodes no theme location or repo name). When a style
// is set the theme's colour SEED is written to src/content/theme/theme.md ONCE, on a site
// that has no theme.md yet — never overwriting an existing one, so an editor keeps
// ownership of the colours.
if (STYLE && !process.env.STOMME_THEMES_DIR) {
  throw new Error(
    `stomme-gen: style "${STYLE}" is set but STOMME_THEMES_DIR is not. ` +
    `Point it at the directory that holds your theme folders.`,
  );
}
const STYLE_DIR = STYLE ? resolve(process.env.STOMME_THEMES_DIR, STYLE) : null;
if (STYLE_DIR) {
  const themeMd = resolve(root, 'src/content/theme/theme.md');
  const seed = resolve(STYLE_DIR, 'theme-seed.md');
  if (existsSync(themeMd)) {
    console.log(`stomme-gen: style "${STYLE}" — theme.md already exists, not overwriting (editor owns the colours)`);
  } else if (existsSync(seed)) {
    mkdirSync(dirname(themeMd), { recursive: true });
    copyFileSync(seed, themeMd);
    console.log(`stomme-gen: style "${STYLE}" — seeded src/content/theme/theme.md from theme-seed.md`);
  }
}

// Load every shipped admin label dictionary (labels.<locale>.js). FORWARD is the active
// locale's dict (English ships none). REVERSE_ALL maps every translation back to English
// so the pass can normalize a previously-localized config (incl. preserved hand-authored
// labels) before re-localizing — making it idempotent and reversible across locale flips.
let FORWARD = null;
const REVERSE_ALL = {};
try {
  const adminDir = new URL('../admin/', import.meta.url);
  for (const f of readdirSync(adminDir)) {
    const mm = f.match(/^labels\.([\w-]+)\.js$/);
    if (!mm) continue;
    const dict = (await import(new URL(f, adminDir))).default;
    for (const [en, loc] of Object.entries(dict)) REVERSE_ALL[loc] = en;
    if (mm[1] === CMS_LOCALE) FORWARD = dict;
  }
} catch {
  /* no dictionaries — labels stay English */
}

const MARKER_START = /# >>> (\w+):generated/;
const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const pad = (n) => ' '.repeat(n);

// ── Link picker options: every internal page route the editor can link to ──
function labelFromFrontmatter(file, key) {
  try {
    const m = readFileSync(file, 'utf8').match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '').trim() : null;
  } catch {
    return null;
  }
}

function collectionOptions(dir, routePrefix, labelKey) {
  let files = [];
  try {
    files = readdirSync(resolve(root, dir)).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  return files.sort().map((f) => {
    const slug = f.replace(/\.md$/, '');
    const route = `${routePrefix}/${slug}`;
    const label = labelFromFrontmatter(resolve(root, dir, f), labelKey) || slug;
    return { label: `${label} (${route})`, value: route };
  });
}

function pageRouteOptions() {
  const opts = [{ label: 'Home (/)', value: '/' }];
  let files = [];
  try {
    files = readdirSync(resolve(root, 'src/content/pages')).filter((f) => f.endsWith('.md'));
  } catch {
    /* none yet */
  }
  for (const f of files.sort()) {
    const slug = f.replace(/\.md$/, '');
    const label = labelFromFrontmatter(resolve(root, 'src/content/pages', f), 'title') || slug;
    opts.push({ label: `${label} (/${slug})`, value: `/${slug}` });
  }
  return opts;
}

// Computed once: home + managed pages + every service + every town page. The
// service/town route prefixes come from the site's config (ROUTES above).
const PAGE_OPTIONS = [
  { label: '— No page —', value: '' }, // lets a link be cleared / left blank (e.g. a dropdown-only nav header)
  ...pageRouteOptions(),
  ...collectionOptions('src/content/services', ROUTES.services, 'navLabel'),
  ...collectionOptions('src/content/towns', ROUTES.towns, 'name'),
];

function serviceOptions() {
  let files = [];
  try {
    files = readdirSync(resolve(root, 'src/content/services')).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  return files.sort().map((f) => {
    const slug = f.replace(/\.md$/, '');
    return { label: labelFromFrontmatter(resolve(root, 'src/content/services', f), 'navLabel') || slug, value: slug };
  });
}
const SERVICE_OPTIONS = serviceOptions();

// FAQ question slugs (label = the question) for the faq block's entry picker.
function faqOptions() {
  let files = [];
  try {
    files = readdirSync(resolve(root, 'src/content/faq')).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  return files.sort().map((f) => {
    const slug = f.replace(/\.md$/, '');
    return { label: labelFromFrontmatter(resolve(root, 'src/content/faq', f), 'question') || slug, value: slug };
  });
}
const FAQ_OPTIONS = faqOptions();

// Every distinct tag used across FAQ entries — the faq block's tag filter picks from
// what's actually in use (add tags on the questions first, then filter by them here).
function faqTagOptions() {
  let files = [];
  try {
    files = readdirSync(resolve(root, 'src/content/faq')).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  const tags = new Set();
  for (const f of files) {
    const src = readFileSync(resolve(root, 'src/content/faq', f), 'utf8');
    const block = src.match(/^tags:\s*\n((?:[ \t]+-[ \t]+.*\n)+)/m);
    if (block) for (const m of block[1].matchAll(/-[ \t]+["']?([^"'\n]+?)["']?\s*$/gm)) tags.add(m[1].trim());
    const inline = src.match(/^tags:\s*\[([^\]]*)\]/m);
    if (inline) for (const t of inline[1].split(',')) { const v = t.trim().replace(/^["']|["']$/g, ''); if (v) tags.add(v); }
  }
  return [...tags].sort().map((t) => ({ label: t, value: t }));
}
const FAQ_TAG_OPTIONS = faqTagOptions();

const OPTION_SOURCES = { '$pages': PAGE_OPTIONS, '$services': SERVICE_OPTIONS, '$faq': FAQ_OPTIONS, '$faqTags': FAQ_TAG_OPTIONS };

// Optional collection kit: a block may declare a source `collection` (schema.ts).
// A collection maps to src/content/<name>/ (its glob base). If that folder is
// absent, drop the block from the CMS picker instead of offering one that can
// never load content. Settings-backed blocks declare no collection and always show.
function collectionExists(name) {
  try {
    readdirSync(resolve(root, 'src/content', name));
    return true;
  } catch {
    return false;
  }
}
// When the site declares feature flags, gate the optional collections by them
// (collection name → feature); otherwise fall back to folder-existence so sites
// without a `features` config keep their old behaviour.
const FEATURE_OF = { faq: 'faq', testimonials: 'testimonials', towns: 'areas', posts: 'blog', services: 'services' };
function collectionEnabled(name) {
  if (FEATURES && FEATURE_OF[name]) return !!FEATURES[FEATURE_OF[name]];
  return collectionExists(name);
}
// The preset-list blocks only make sense with a matching listing present (postList
// also covers the blog, which is an article listing in all but name) — hide otherwise.
const hasCatalog = LISTINGS.some((l) => l.preset === 'catalog');
const hasArticle = !!(FEATURES && FEATURES.blog) || LISTINGS.some((l) => l.preset === 'article');
const presetOk = (b) => (b.type !== 'catalogList' || hasCatalog) && (b.type !== 'postList' || hasArticle);
const AVAILABLE_BLOCKS = BLOCKS.filter((b) => (!b.collection || collectionEnabled(b.collection)) && presetOk(b));

// Lookbook coverage guard: every block should carry a sample so /lookbook renders it and a
// theme can be validated against the whole catalog. Warn (don't fail) on gaps.
const NO_SAMPLE = BLOCKS.filter((b) => !(b.sample || (Array.isArray(b.samples) && b.samples.length)));
if (NO_SAMPLE.length) console.warn(`  ⚠ lookbook: no sample for ${NO_SAMPLE.map((b) => b.type).join(', ')} — add \`sample\`/\`samples\` in the catalog (block won't render in /lookbook)`);
const SKIPPED_BLOCKS = BLOCKS.filter((b) => (b.collection && !collectionEnabled(b.collection)) || !presetOk(b));

// Nav dropdown sources: collections that render detail pages. The value encodes
// "<collectionId>::<routeBase>" so Header can both query the collection and build
// per-entry links. Feature collections with detail routes + every listing.
const MENU_OPTIONS = [];
if (collectionEnabled('services')) MENU_OPTIONS.push({ label: 'Services', value: `services::${ROUTES.services || '/services'}` });
if (collectionEnabled('towns')) MENU_OPTIONS.push({ label: 'Areas', value: `towns::${ROUTES.towns || '/areas'}` });
for (const l of LISTINGS) MENU_OPTIONS.push({ label: l.label || l.id, value: `${l.id}::${l.route}` }); // blog is in LISTINGS too
OPTION_SOURCES['$menus'] = MENU_OPTIONS;

// Cluster the "add section" picker (and the gallery) by group. Sort is stable, so blocks
// keep their catalog order within a group; unknown/missing groups fall to the end.
const GROUP_ORDER = ['Hero & headers', 'Text', 'Cards & lists', 'Media', 'Quote & highlight', 'Numbers', 'From collections', 'Calls to action', 'Automatic'];
const groupRank = (b) => { const i = GROUP_ORDER.indexOf(b.group); return i === -1 ? GROUP_ORDER.length : i; };
AVAILABLE_BLOCKS.sort((a, b) => groupRank(a) - groupRank(b));

// Collapsed-row label for list items: Decap defaults to the FIRST field's value (an
// empty icon picker reads "No icon"). Derive a summary — eyebrow first when present,
// then the item's identifying field. Empty placeholders render as nothing, so whichever
// fields are filled show. An explicit `summary` on the Field def wins.
const SUMMARY_PRIORITY = ['title', 'name', 'label', 'question', 'quote', 'heading', 'statement', 'term', 'caption', 'text', 'alt', 'value'];
function listSummary(fields) {
  const names = fields.map((f) => f.name);
  const parts = [];
  if (names.includes('eyebrow')) parts.push('{{fields.eyebrow}}');
  const main = SUMMARY_PRIORITY.find((n) => names.includes(n));
  if (main) parts.push(`{{fields.${main}}}`);
  return parts.length ? parts.join(' ') : null;
}

// Emit a single field. Leaf widgets use flow style; list/object widgets expand.
function emitField(f, indent) {
  const p = pad(indent);
  const parts = [`name: ${f.name}`, `label: ${q(f.label)}`, `widget: ${f.widget}`];
  if (f.required === false) parts.push('required: false');
  if (f.default !== undefined) parts.push(`default: ${typeof f.default === 'string' ? q(f.default) : f.default}`);
  if (f.hint) parts.push(`hint: ${q(f.hint)}`);
  if (f.media_folder) parts.push(`media_folder: ${q(f.media_folder)}`);
  if (f.public_folder) parts.push(`public_folder: ${q(f.public_folder)}`);

  // Shared list/object collapse props (block-field convention, migration-free).
  const collapseProps = () => [
    ...(f.label_singular ? [`${p}  label_singular: ${q(f.label_singular)}`] : []),
    ...(f.collapsed !== undefined ? [`${p}  collapsed: ${f.collapsed}`] : []),
    ...(f.minimize_collapsed ? [`${p}  minimize_collapsed: true`] : []),
  ];
  if (f.widget === 'list' && f.fields) {
    const sum = f.summary || listSummary(f.fields);
    return [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: list`,
      ...(f.required === false ? [`${p}  required: false`] : []),
      ...collapseProps(),
      ...(f.hint ? [`${p}  hint: ${q(f.hint)}`] : []),
      ...(sum ? [`${p}  summary: ${q(sum)}`] : []),
      `${p}  fields:`, ...f.fields.map((sf) => emitField(sf, indent + 4))].join('\n');
  }
  if (f.widget === 'list' && f.field) {
    return [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: list`,
      ...(f.required === false ? [`${p}  required: false`] : []),
      ...collapseProps(),
      ...(f.hint ? [`${p}  hint: ${q(f.hint)}`] : []),
      `${p}  field: ${emitFlow(f.field)}`].join('\n');
  }
  if (f.widget === 'object' && f.fields) {
    const head = [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: object`];
    if (f.required === false) head.push(`${p}  required: false`);
    if (f.collapsed !== undefined) head.push(`${p}  collapsed: ${f.collapsed}`);
    if (f.summary) head.push(`${p}  summary: ${q(f.summary)}`);
    if (f.hint) head.push(`${p}  hint: ${q(f.hint)}`);
    head.push(`${p}  fields:`);
    return [...head, ...f.fields.map((sf) => emitField(sf, indent + 4))].join('\n');
  }
  if (f.widget === 'select') {
    const opts = typeof f.options === 'string' ? OPTION_SOURCES[f.options] ?? [] : Array.isArray(f.options) ? f.options : [];
    const out = [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: select`];
    if (f.multiple) out.push(`${p}  multiple: true`);
    if (f.required === false) out.push(`${p}  required: false`);
    // A multi-select default is a list of values, not a comma-joined string.
    if (f.default !== undefined) out.push(`${p}  default: ${Array.isArray(f.default) ? `[${f.default.map(q).join(', ')}]` : q(f.default)}`);
    if (f.hint) out.push(`${p}  hint: ${q(f.hint)}`);
    if (opts.length === 0) {
      out.push(`${p}  options: []`);
    } else {
      out.push(`${p}  options:`);
      for (const o of opts) out.push(`${p}    - { label: ${q(o.label)}, value: ${q(o.value)} }`);
    }
    return out.join('\n');
  }
  return `${p}- { ${parts.join(', ')} }`;
}

function emitFlow(f) {
  const parts = [`name: ${f.name}`, `label: ${q(f.label)}`, `widget: ${f.widget}`];
  if (f.required === false) parts.push('required: false');
  return `{ ${parts.join(', ')} }`;
}

function emitWidget(indent) {
  const p = pad(indent);
  const lines = [
    `${p}- name: blocks`,
    `${p}  label: "Sections · build the page (drag to reorder)"`,
    `${p}  label_singular: "Section"`,
    `${p}  widget: list`,
    `${p}  required: false`,
    // Collapsed-item label: show the block's heading (or quote) so several of the same
    // type are distinguishable at a glance; falls back to the type name when both empty.
    `${p}  summary: "{{fields.eyebrow}} {{fields.heading}}{{fields.quote}}"`,
    `${p}  types:`,
  ];
  for (const b of AVAILABLE_BLOCKS) {
    lines.push(`${p}    - name: ${b.type}`, `${p}      label: ${q(b.label)}`, `${p}      widget: object`);
    if (b.fields.length === 0) {
      lines.push(`${p}      fields:`, `${p}        - { name: _auto, label: "Auto", widget: hidden }`);
    } else {
      lines.push(`${p}      fields:`, ...b.fields.map((f) => emitField(f, indent + 8)));
    }
  }
  return lines.join('\n');
}

// ── Nav links (generated) ───────────────────────────────────────────────────
// Nav links use the same page-dropdown as blocks ($pages) instead of a free string,
// and the page is required (a custom URL overrides it) so a link always resolves.
// Each menu item can also become a dropdown — auto-filled from a collection ($menus)
// or with manual sub-links.
function navLinkField() {
  return {
    name: 'link', label: 'Link', widget: 'object', required: false, fields: [
      { name: 'page', label: 'Page', widget: 'select', options: '$pages', required: false, hint: 'Pick a page on the site. Leave blank for a dropdown-only header (the label just opens its menu).' },
      { name: 'url', label: '…or a custom URL', widget: 'string', required: false, hint: 'External link, tel: or mailto: — overrides the page above.' },
    ],
  };
}

// Footer link groups (quick links, the optional second group, legal) — each link gets the
// standard page-dropdown + custom-URL pair, so they're generated (the page options are).
function emitFooterLinks(indent) {
  const footerLink = () => ({
    name: 'link', label: 'Link', widget: 'object', required: false, fields: [
      { name: 'page', label: 'Page', widget: 'select', options: '$pages', required: false, hint: 'Pick a page on the site.' },
      { name: 'url', label: '…or a custom URL', widget: 'string', required: false, hint: 'External link, tel: or mailto: — overrides the page above.' },
    ],
  });
  const linkList = (name, label) => ({
    name, label, widget: 'list', required: false, fields: [
      { name: 'label', label: 'Label', widget: 'string' },
      footerLink(),
    ],
  });
  const fields = [
    { name: 'linksHeading', label: 'Quick links · heading', widget: 'string', required: false, default: 'Links' },
    linkList('links', 'Quick links'),
    { name: 'links2Heading', label: 'Second link group · heading', widget: 'string', required: false, hint: 'Optional extra column, e.g. your services.' },
    linkList('links2', 'Second link group'),
    linkList('legal', 'Legal links (bottom bar)'),
  ];
  return fields.map((f) => emitField(f, indent)).join('\n');
}
function emitNavLinks(indent) {
  const items = {
    name: 'items', label: 'Menu links', widget: 'list', required: false, fields: [
      { name: 'label', label: 'Label', widget: 'string' },
      navLinkField(),
      { name: 'menu', label: 'Dropdown from collection', widget: 'select', options: '$menus', required: false, hint: 'Optional. Fill a dropdown with every entry of a collection (e.g. all services). Overrides manual sub-links below.' },
      { name: 'children', label: '…or manual sub-links', widget: 'list', required: false, fields: [{ name: 'label', label: 'Label', widget: 'string' }, navLinkField()] },
    ],
  };
  const cta = {
    name: 'cta', label: 'Button', widget: 'object', required: false, fields: [
      { name: 'label', label: 'Label', widget: 'string' },
      navLinkField(),
    ],
  };
  return [emitField(items, indent), emitField(cta, indent)].join('\n');
}

// ── Thank-you page buttons (generated) ──────────────────────────────────────
// The /thanks confirmation has a primary + optional second button. Each is a Button object
// { label, link } — the SAME shape as the header CTA (reuses navLinkField), so the editor
// is consistent: a Label + a Link with a page-dropdown ($pages) + custom-URL override.
// Resolve at render via resolveLink (stomme/href).
function buttonField(name, label, labelHint) {
  return {
    name, label, widget: 'object', required: false, fields: [
      { name: 'label', label: 'Label', widget: 'string', required: false, hint: labelHint },
      navLinkField(),
    ],
  };
}
function emitThanksButtons(indent) {
  return [
    emitField(buttonField('button', 'Primary button', 'Blank = localized default ("Back to home").'), indent),
    emitField(buttonField('button2', 'Second button (optional)', 'Leave blank for a single button.'), indent),
  ].join('\n');
}

// ── Collection editors ──────────────────────────────────────────────────────
// Decap editor sections for the conventional content collections. Emitted (gated
// by collectionExists) into the `# >>> collections:generated` region so the CMS
// sidebar gains an editor for whatever collections a site actually has — no more
// hand-authoring them per site. A site with bespoke collections adds its own
// editors outside the markers. Field shapes mirror the recommended content.config
// schemas (towns/services match the TownPage/ServicePage templates).
// No field-level media_folder — Decap resolves it relative to the entry (breaks
// uploads from subfolder entries); the global media_folder in config.yml is used.
const COLLECTION_EDITORS = {
  faq: `- name: faq
  label: "FAQ"
  label_singular: "Question"
  folder: "src/content/faq"
  create: true
  slug: "{{slug}}"
  fields:
    - { name: question, label: "Question", widget: string }
    - { name: answer, label: "Answer", widget: text }
    - { name: order, label: "Order", widget: number, required: false, default: 0 }
    - name: tags
      label: "Tags"
      widget: list
      required: false
      collapsed: false
      summary: "{{fields.tag}}"
      hint: "Scope the question to pages: an FAQ block filtered on a tag (e.g. a service or town) shows every question carrying it."
      field: { name: tag, label: "Tag", widget: string }`,
  testimonials: `- name: testimonials
  label: "Testimonials"
  label_singular: "Testimonial"
  folder: "src/content/testimonials"
  create: true
  slug: "{{slug}}"
  fields:
    - { name: name, label: "Name", widget: string }
    - { name: role, label: "Role / company", widget: string, required: false }
    - { name: quote, label: "Quote", widget: text }
    - { name: order, label: "Order", widget: number, required: false, default: 0 }`,
  towns: `- name: towns
  label: "Service areas"
  label_singular: "Area"
  folder: "src/content/towns"
  create: true
  slug: "{{slug}}"
  fields:
    - { name: name, label: "Town name", widget: string }
    - { name: title, label: "Page heading (H1)", widget: string, required: false }
    - name: seo
      label: "SEO"
      widget: object
      collapsed: true
      required: false
      summary: "{{fields.title}}"
      fields:
        - { name: title, label: "Title", widget: string }
        - { name: description, label: "Description", widget: text }
        - { name: image, label: "Share image", widget: image, required: false, hint: "Social-share card (og:image), 1200×630. Site default used when empty." }
        - { name: ogRaw, label: "Share the image as-is", widget: boolean, required: false, default: false, hint: "Only matters when generated share cards are on (Identity settings): skip the card for this page and share the plain image instead." }
    - { name: order, label: "Order", widget: number, required: false, default: 0 }
    - { name: heroSubtitle, label: "Hero subtitle", widget: text, required: false }
    - { name: heroNote, label: "Hero note", widget: string, required: false }
    - { name: why, label: "Why us here (paragraphs)", widget: text, required: false }
    - name: problems
      label: "Problems we solve"
      widget: list
      required: false
      label_singular: "Problem"
      collapsed: true
      minimize_collapsed: true
      field: { name: item, label: "Problem", widget: string }
    - name: districts
      label: "Districts / areas"
      widget: list
      required: false
      label_singular: "District"
      collapsed: true
      minimize_collapsed: true
      field: { name: item, label: "District", widget: string }
    - { name: localCase, label: "Local case", widget: text, required: false }
    - name: services
      label: "Services offered here"
      widget: list
      required: false
      label_singular: "Service"
      collapsed: true
      minimize_collapsed: true
      field: { name: item, label: "Service", widget: string }
    - name: media
      label: "Media"
      widget: object
      collapsed: true
      hint: "The photo beside the page heading."
      fields:
        - { name: image, label: "Image", widget: image, required: false }
        - { name: imageAlt, label: "Image alt text", widget: string, required: false }`,
  services: `- name: services
  label: "Services"
  label_singular: "Service"
  folder: "src/content/services"
  create: true
  slug: "{{slug}}"
  fields:
    - { name: title, label: "Title (H1)", widget: string }
    - name: seo
      label: "SEO"
      widget: object
      collapsed: true
      required: false
      summary: "{{fields.title}}"
      fields:
        - { name: title, label: "Title", widget: string }
        - { name: description, label: "Description", widget: text }
        - { name: image, label: "Share image", widget: image, required: false, hint: "Social-share card (og:image), 1200×630. Site default used when empty." }
        - { name: ogRaw, label: "Share the image as-is", widget: boolean, required: false, default: false, hint: "Only matters when generated share cards are on (Identity settings): skip the card for this page and share the plain image instead." }
    - { name: navLabel, label: "Short label (menus/cards)", widget: string }
    - { name: summary, label: "Summary", widget: text, required: false, hint: "The lede under the title — also the card text in service lists." }
    - { name: order, label: "Order", widget: number, required: false, default: 0 }
    - name: media
      label: "Media"
      widget: object
      collapsed: true
      hint: "Shown on the service card in lists and beside the page header."
      fields:
        - { name: image, label: "Image", widget: image, required: false }
        - { name: imageAlt, label: "Image alt text", widget: string, required: false, hint: "Leave empty for decorative art." }
    - name: hero
      label: "Page header (composed pages)"
      widget: object
      collapsed: true
      required: false
      hint: "Only used when the page is built from sections below: renders a compact page header (title + summary + these extras, image beside the text) instead of the plain one."
      fields:
        - name: ticks
          label: "Ticks (checkmark lines)"
          widget: list
          required: false
          label_singular: "Line"
          collapsed: true
          minimize_collapsed: true
          hint: "Short ✓ lines under the summary — key reassurances."
          field: { name: text, label: "Line", widget: string }
        - { name: ctaLabel, label: "Button label", widget: string, required: false, hint: "Blank uses the site's quote-button text." }
        - { name: ctaHref, label: "Button link", widget: string, required: false, hint: "Blank links to the contact page." }
        - { name: cta2Label, label: "Second link label", widget: string, required: false, hint: "A quiet text link beside the button." }
        - { name: cta2Href, label: "Second link target", widget: string, required: false, hint: "E.g. #process to jump to a section with that anchor." }
${emitWidget(4)}
    - { name: body, label: "Long-form text (fallback)", widget: markdown, required: false, hint: "Only shown when no sections are built above. Prefer sections; this is the simple prose fallback." }`,
};

// A CMS editor for a config-defined listing, from its preset's field set.
function listingEditor(l) {
  const articleFields = `    - { name: title, label: "Title", widget: string }
    - { name: date, label: "Date", widget: datetime, date_format: "YYYY-MM-DD", time_format: false }
    - { name: excerpt, label: "Excerpt", widget: text, required: false }
    - { name: cover, label: "Cover image", widget: image, required: false }
    - { name: showCover, label: "Show cover", widget: boolean, required: false, default: false, hint: "Show a cover on cards + the article — your image, or a themed default if none." }
    - { name: body, label: "Body", widget: markdown }`;
  // Catalog specs are config-defined (Listing.specs) so every item shares the same fields.
  // Each becomes a string field keyed by its stable key; labels are the site's own strings.
  const specs = (Array.isArray(l.specs) ? l.specs : []).map((s, i) =>
    typeof s === 'string' ? { key: `spec_${i}`, label: s } : { key: s.key || `spec_${i}`, label: s.label });
  const specsField = specs.length
    ? `\n    - name: specs
      label: "Specs"
      widget: object
      collapsed: false
      fields:
${specs.map((s) => `        - { name: ${s.key}, label: ${q(s.label)}, widget: string, required: false }`).join('\n')}`
    : '';
  const catalogFields = `    - { name: title, label: "Title", widget: string }
    - { name: price, label: "Price", widget: string, required: false }
    - name: status
      label: "Status"
      widget: select
      default: available
      options:
        - { label: "Available", value: available }
        - { label: "Reserved", value: reserved }
        - { label: "Sold", value: sold }
    - { name: category, label: "Category", widget: string, required: false }
    - { name: cover, label: "Cover image", widget: image, required: false }
    - name: gallery
      label: "Gallery"
      widget: list
      required: false
      fields:
        - { name: image, label: "Image", widget: image }
        - { name: alt, label: "Alt text", widget: string, required: false }${specsField}
    - { name: date, label: "Date added", widget: datetime, date_format: "YYYY-MM-DD", time_format: false, required: false }
    - { name: body, label: "Description", widget: markdown, required: false }`;
  return `- name: ${l.id}
  label: ${q(l.label || l.id)}
  folder: "src/content/${l.id}"
  create: true
  slug: "{{slug}}"
  fields:
${l.preset === 'catalog' ? catalogFields : articleFields}`;
}

// Emit editor sections: the conventional collections the site has, then one per listing.
function emitCollections(indent) {
  const p = pad(indent);
  const ind = (s) => s.split('\n').map((l) => (l ? p + l : l)).join('\n');
  const fixed = Object.keys(COLLECTION_EDITORS).filter(collectionEnabled).map((name) => ind(COLLECTION_EDITORS[name]));
  const listing = LISTINGS.map((l) => ind(listingEditor(l)));
  return [...fixed, ...listing].join('\n');
}

// ── CMS backend (generated) ──────────────────────────────────────────────────
// Emit the Decap `backend:` block from the site's `cms` config so config.yml auth
// isn't hand-edited. Generic: only the fields the site sets are written. Defaults:
// backend git-gateway, branch main. (No `cms:generated` markers in a site's
// config.yml → nothing emitted, hand-authored backend preserved — back-compatible.)
function emitCms(indent) {
  const p = ' '.repeat(indent);
  const c = CMS || {};
  const L = [`${p}backend:`, `${p}  name: ${c.backend || 'git-gateway'}`];
  if (c.repo) L.push(`${p}  repo: ${c.repo}`);
  L.push(`${p}  branch: ${c.branch || 'main'}`);
  if (c.baseUrl) L.push(`${p}  base_url: ${c.baseUrl}`);
  if (c.authEndpoint) L.push(`${p}  auth_endpoint: ${c.authEndpoint}`);
  if (c.apiRoot) L.push(`${p}  api_root: ${c.apiRoot}`);
  // Disable Sveltia's built-in PAT sign-in on sites that use gateway OAuth (baseUrl set).
  // Gated on baseUrl so solo/local sites with no auth server keep the token fallback.
  if (c.baseUrl) L.push(`${p}  auth_methods: [oauth]`);
  // Sveltia sends the OAuth `site_id` from `site_domain`; the gateway's same-window
  // (Arc/mobile) fallback keys off it to find the site in KV. Defaults to the deploy host.
  if (c.siteDomain) L.push(`${p}  site_domain: ${c.siteDomain}`);
  if (c.gatewayUrl) L.push(`${p}  gateway_url: ${c.gatewayUrl}`);
  if (c.identityUrl) L.push(`${p}  identity_url: ${c.identityUrl}`);
  return L.join('\n');
}

// ── Settings file-collection panes (generated) ──────────────────────────────
// Identity / Contact / Theme / Header / Footer / Form-confirmation — the standard
// settings panes. Generated (were hand-authored per site = the #8 propagation gap), so
// engine changes here now flow to every site on `pnpm cms:gen`. The nav menu links +
// thanks buttons reuse the same emitters as before (per-site $pages / $menus options).
// Written at the canonical absolute indent (the `settings` collection sits at indent 2).
// ── "Delningskort" (share cards) settings pane (generated) ───────────────────
// A SECOND file pane on site.md (Sveltia preserves each pane's other frontmatter on
// save). Holds the site-default share image + the master switch + one section per
// generatable type — a listing (article/catalog, blog folded), plus Service areas
// (features.areas) and Services (features.services). The data lives at settings.ogImage
// and settings.og.{enabled,types} (read by Head.astro / routes/og.ts / src/og-pages.ts).
function shareTypeList() {
  const out = [];
  if (collectionEnabled('towns')) out.push({ key: 'towns', label: 'Service areas', kind: 'towns' });
  if (collectionEnabled('services')) out.push({ key: 'services', label: 'Services', kind: 'services' });
  for (const l of LISTINGS) out.push({ key: l.id, label: l.label || l.id, kind: l.preset });
  return out;
}
// Default overlay template + the variable hint, by type kind.
const SHARE_META = {
  towns: { overlay: '{title}', vars: '{title} {name}' },
  services: { overlay: '{title}', vars: '{title} {name}' },
  article: { overlay: '{title}', vars: '{title} {date} {excerpt} {name}' },
  catalog: { overlay: '{title} · {price}', vars: '{title} {price} {category} {status} {name}' },
};
function emitShareType(t, indent) {
  const p = pad(indent);
  const meta = SHARE_META[t.kind] || SHARE_META.article;
  return [
    `${p}- name: ${t.key}`,
    `${p}  label: ${q(t.label)}`,
    `${p}  widget: object`,
    `${p}  collapsed: true`,
    `${p}  fields:`,
    `${p}    - { name: enabled, label: "Generate cards for these", widget: boolean, required: false, default: false }`,
    `${p}    - name: style`,
    `${p}      label: "Card style"`,
    `${p}      widget: select`,
    `${p}      required: false`,
    `${p}      default: editorial`,
    `${p}      options:`,
    `${p}        - { label: "Editorial — text over a gradient at the bottom", value: editorial }`,
    `${p}        - { label: "Bold — big centred statement", value: bold }`,
    `${p}        - { label: "Ops — text panel on the left", value: ops }`,
    `${p}    - { name: overlayText, label: "Overlay text", widget: string, required: false, default: ${q(meta.overlay)}, hint: ${q('Text drawn on each card. Variables (filled per item): ' + meta.vars + '.')} }`,
    `${p}    - { name: scrim, label: "Scrim strength", widget: number, value_type: int, min: 0, max: 100, default: 55, required: false, hint: "How dark the gradient over the photo is (0–100). More = better text contrast, less photo." }`,
    `${p}    - { name: showLogo, label: "Show the wordmark", widget: boolean, required: false, default: true }`,
    `${p}    - { name: showTagline, label: "Show the tagline", widget: boolean, required: false, default: true }`,
    `${p}    - { name: tagline, label: "Tagline", widget: string, required: false, hint: "One line under the headline. Empty falls back to the footer tagline." }`,
    `${p}    - { name: accent, label: "Accent colour", widget: color, required: false, hint: "The accent rule and wordmark accent. Empty uses your brand colour." }`,
  ].join('\n');
}
function emitShareCards(indent) {
  const p = pad(indent);
  const types = shareTypeList();
  const typeFields = types.length
    ? [`${p}        - name: types`, `${p}          label: "By content type"`, `${p}          widget: object`,
       `${p}          collapsed: true`, `${p}          fields:`,
       ...types.map((t) => emitShareType(t, indent + 12))].join('\n')
    : `${p}        - { name: _notypes, label: "By content type", widget: hidden, required: false }`;
  return [
    `${p}- name: sharecards`,
    `${p}  label: "Share cards"`,
    `${p}  file: "src/content/settings/site.md"`,
    `${p}  fields:`,
    `${p}    - { name: ogImage, label: "Site default share image", widget: image, required: false, media_folder: "/public/media/share", public_folder: "/media/share", hint: "Shown when a page is shared (iMessage, Slack, social) and it has no card of its own. Use ~1200×630px." }`,
    // Always-rendered object (no `required: false`) so the master toggle + per-type
    // sections show inline — Sveltia wraps an optional object in an "Add …" button.
    `${p}    - name: og`,
    `${p}      label: "Generated share cards"`,
    `${p}      widget: object`,
    `${p}      hint: "Build a branded card per item — its photo with overlay text, wordmark and tagline. Off = share the site default image above."`,
    `${p}      fields:`,
    `${p}        - { name: enabled, label: "Generate share cards", widget: boolean, required: false, default: false, hint: "Master switch. Turn on, then enable the content types you want cards for below." }`,
    typeFields,
  ].join('\n');
}

function emitSettings() {
  const tp = emitTrackingPane(6);
  return `  - name: settings
    label: "Settings"
    files:
      - name: site
        label: "Identity"
        file: "src/content/settings/site.md"
        fields:
          - { name: name, label: "Business name", widget: string, hint: "Company name — used in the footer ©, the contact card, and search structured data. Not a page title." }
          - name: logo
            label: "Logo"
            widget: object
            hint: "Shown in the header and footer (each chooses what to display)."
            fields:
              - { name: image, label: "Logo mark (shown beside the text)", widget: image, required: false, media_folder: "/public/media/identity", public_folder: "/media/identity", hint: "An icon/mark. The wordmark is the text below, set in your display font." }
              - { name: alt, label: "Logo alt text", widget: string, required: false }
              - { name: textPre, label: "Wordmark text", widget: string, required: false }
              - { name: textAccent, label: "Wordmark accent (in brand colour)", widget: string, required: false }
          - { name: favicon, label: "Favicon", widget: image, required: false, media_folder: "/public/media/icons", public_folder: "/", hint: "Browser-tab icon — SVG recommended (scales to any size). Defaults to the shipped mark when empty." }
          - { name: appleIcon, label: "Home-screen icon", widget: image, required: false, media_folder: "/public/media/icons", public_folder: "/", hint: "iOS home-screen icon — a 180×180 PNG. Optional." }
${emitShareCards(6)}
      - name: contact
        label: "Contact"
        file: "src/content/contact/contact.md"
        fields:
          - { name: phone, label: "Phone", widget: string, required: false }
          - { name: phoneE164, label: "Phone (tel: link)", widget: string, required: false, hint: "Digits with country code, e.g. +46701234567 — used for the click-to-call link." }
          - { name: email, label: "Email", widget: string, required: false }
          - { name: protectContact, label: "Hide phone & email from scrapers", widget: boolean, required: false, default: false, hint: "Reveals them in the browser instead of putting them in the page source. Visitors still see and tap them; harvesters that don't run JavaScript get nothing." }
          - name: address
            label: "Address"
            widget: object
            collapsed: true
            hint: "Shown on the card + Find-us block, powers the map, and feeds local-search data."
            fields:
              - { name: street, label: "Street", widget: string, required: false }
              - { name: postcode, label: "Postcode", widget: string, required: false }
              - { name: city, label: "City", widget: string, required: false }
              - { name: country, label: "Country", widget: string, required: false }
              - { name: lat, label: "Latitude (map)", widget: number, required: false, value_type: float, hint: "From Google Maps: right-click the spot → the coordinates. e.g. 57.7089" }
              - { name: lng, label: "Longitude (map)", widget: number, required: false, value_type: float }
          - name: hours
            label: "Opening hours"
            widget: list
            required: false
            label_singular: "hours line"
            summary: "{{fields.days}} · {{fields.hours}}"
            fields:
              - { name: days, label: "Days", widget: string, hint: "e.g. Mon–Fri" }
              - { name: hours, label: "Hours", widget: string, hint: "e.g. 08:00–17:00, or Closed" }
          - { name: hoursNote, label: "Note under the hours", widget: string, required: false, hint: "Small print under the list — e.g. Closed 12:00–13:00 for lunch." }
          - name: holidayHours
            label: "Holiday / special hours"
            widget: list
            required: false
            label_singular: "holiday line"
            summary: "{{fields.when}} · {{fields.note}}"
            fields:
              - { name: when, label: "When", widget: string, hint: "e.g. Dec 24–26" }
              - { name: note, label: "Note", widget: string, hint: "e.g. Closed for the holidays" }
          - name: away
            label: "Away banner"
            widget: object
            collapsed: true
            hint: "Shows a notice on every contact card. Auto-hides after the date."
            fields:
              - { name: enabled, label: "Show the away banner", widget: boolean, required: false, default: false }
              - { name: message, label: "Message", widget: string, required: false, hint: "e.g. Away until Jan 8 — leave a message and we'll reply then." }
              - { name: until, label: "Auto-hide after", widget: datetime, date_format: "YYYY-MM-DD", time_format: false, required: false }
          - name: socials
            label: "Social profiles"
            widget: list
            required: false
            label_singular: "profile"
            summary: "{{fields.platform}}"
            fields:
              - { name: platform, label: "Platform", widget: string, hint: "Instagram, LinkedIn, Facebook…" }
              - { name: url, label: "URL", widget: string }
          - { name: orgNr, label: "Org. number", widget: string, required: false }
          - { name: founded, label: "Founded (year)", widget: string, required: false }
      - name: theme
        label: "Theme colours"
        file: "src/content/theme/theme.md"
        fields:
          - { name: brand, label: "Primary", widget: color, default: "#4338ca", hint: "Buttons, links and key accents." }
          - { name: ink, label: "Text", widget: color, default: "#1f2937", hint: "Default body-text colour." }
          - { name: onDark, label: "Text on primary", widget: color, default: "#ffffff", hint: "Button labels and text on dark/brand bands." }
          - { name: surface, label: "Tinted surface", widget: color, default: "#e0e7ff", hint: "Soft background for highlighted sections." }
          - { name: paper, label: "Page background", widget: color, default: "#ffffff", hint: "The main page background." }
          - { name: line, label: "Borders & lines", widget: color, default: "#e5e7eb", hint: "Card borders, dividers, rules." }
          - { name: secondary, label: "Secondary", widget: color, required: false, default: "#3b82f6", hint: "A second accent you deploy by choice (eyebrow, callout)." }
          - { name: highlight, label: "Highlight", widget: color, default: "#f59e0b", hint: "Attention accent — tags, badges, status. Used in isolation." }
          - name: eyebrow
            label: "Eyebrow style"
            widget: select
            required: false
            default: dash
            hint: "The small label above headings (e.g. “OUR SERVICES”) — site-wide."
            options:
              - { label: "Dash", value: dash }
              - { label: "Bullet", value: bullet }
              - { label: "Bold (no marker)", value: bold }
          - name: eyebrowColor
            label: "Eyebrow colour"
            widget: select
            required: false
            default: brand
            hint: "Which accent the eyebrow marker uses."
            options:
              - { label: "Brand", value: brand }
              - { label: "Secondary", value: secondary }
              - { label: "Highlight", value: highlight }
          - { name: dark, label: "Dark section background", widget: color, required: false, hint: "Background for blocks set to the Dark surface. Empty = derived from Primary." }
          - { name: darkInk, label: "Dark section text", widget: color, required: false, hint: "Text colour on dark sections. Empty = a light off-white." }
          - { name: darkLine, label: "Dark section borders", widget: color, required: false, hint: "Card borders / dividers on dark sections. Empty = a faint light rule." }
          - name: fontDisplay
            label: "Heading font"
            widget: select
            required: false
            hint: "Font for headings. Empty = system default."
            options:
              - { label: "System (default)", value: "system" }
              - { label: "Serif (elegant headlines)", value: "serif" }
              - { label: "Grotesk (clean sans)", value: "grotesk" }
              - { label: "Inter", value: "inter" }
              - { label: "Inter Tight", value: "inter-tight" }
              - { label: "Geometric (Futura-style)", value: "geometric" }
              - { label: "Rounded", value: "rounded" }
              - { label: "Slab serif", value: "slab" }
              - { label: "Condensed (narrow headlines)", value: "condensed" }
              - { label: "Humanist (open, legible)", value: "humanist" }
              - { label: "Script (handwritten)", value: "script" }
              - { label: "Monospace", value: "mono" }
              - { label: "Custom (uploaded below)", value: "custom" }
          - name: fontBody
            label: "Body font"
            widget: select
            required: false
            hint: "Font for body text. Empty = system default."
            options:
              - { label: "System (default)", value: "system" }
              - { label: "Serif (elegant headlines)", value: "serif" }
              - { label: "Grotesk (clean sans)", value: "grotesk" }
              - { label: "Inter", value: "inter" }
              - { label: "Inter Tight", value: "inter-tight" }
              - { label: "Geometric (Futura-style)", value: "geometric" }
              - { label: "Rounded", value: "rounded" }
              - { label: "Slab serif", value: "slab" }
              - { label: "Condensed (narrow headlines)", value: "condensed" }
              - { label: "Humanist (open, legible)", value: "humanist" }
              - { label: "Script (handwritten)", value: "script" }
              - { label: "Monospace", value: "mono" }
              - { label: "Custom (uploaded below)", value: "custom" }
          - { name: fontCustomFile, label: "Custom heading font file", widget: file, required: false, media_folder: "/public/media/fonts", public_folder: "/media/fonts", hint: "Used when Heading font = Custom. A .woff2 / .woff / .ttf / .otf file (a font file, not an SVG)." }
          - { name: fontCustomBodyFile, label: "Custom body font file", widget: file, required: false, media_folder: "/public/media/fonts", public_folder: "/media/fonts", hint: "Used when Body font = Custom. Leave empty to reuse the heading font for body." }
      - name: nav
        label: "Header"
        file: "src/content/navigation/nav.md"
        fields:
          - { name: sticky, label: "Sticky header", widget: boolean, required: false, default: false, hint: "Header stays fixed at the top while scrolling. Default: it scrolls away with the page." }
          - { name: showLogo, label: "Show logo mark", widget: boolean, required: false, default: true, hint: "Show the logo image (set under Identity) in the header." }
          - { name: showWordmark, label: "Show wordmark text", widget: boolean, required: false, default: true, hint: "Show the wordmark text (set under Identity) in the header." }
${emitNavLinks(10)}
      - name: footer
        label: "Footer"
        file: "src/content/footer/footer.md"
        fields:
          - { name: dark, label: "Dark footer", widget: boolean, required: false, default: false, hint: "Use the dark surface for the footer." }
          - { name: showLogo, label: "Show logo mark", widget: boolean, required: false, default: true, hint: "Show the logo image (set under Identity) in the footer." }
          - { name: showWordmark, label: "Show wordmark text", widget: boolean, required: false, default: true, hint: "Show the wordmark text (set under Identity) in the footer." }
          - { name: tagline, label: "Tagline", widget: string, required: false, hint: "A line under the logo." }
          - { name: showLinks, label: "Show quick links", widget: boolean, required: false, default: true }
${emitFooterLinks(10)}
          - { name: showTowns, label: "Show service areas", widget: boolean, required: false, default: false, hint: "Adds a column linking every entry in the Areas collection." }
          - { name: townsHeading, label: "Service areas · heading", widget: string, required: false, default: "Areas" }
          - { name: note, label: "Note", widget: string, required: false, hint: "Appended to the © line." }
      - label: "Form confirmation"
        name: thanks
        file: "src/content/thanks/thanks.md"
        fields:
          - name: variant
            label: "Layout"
            widget: select
            required: false
            default: classic
            hint: "Letter renders the visitor's message as a postmarked letter."
            options:
              - { label: "Classic", value: "classic" }
              - { label: "Letter (postmarked)", value: "letter" }
          - { name: heading, label: "Heading", widget: string, required: false, hint: "Big confirmation headline. Blank = localized default." }
          - { name: message, label: "Message", widget: text, required: false, hint: "Reassurance line under the heading. Blank = default." }
${emitThanksButtons(10)}
          - { name: showContact, label: "Show the direct-contact card", widget: boolean, required: false, default: true, hint: "Phone / email / hours from Site & contact." }${tp ? '\n' + tp : ''}`;
}

// Tracking & cookies settings pane — only when the `tracking` feature is on (toggle with
// stomme-enable). Emitted into a `tracking:generated` region on static-pane sites and folded
// into emitSettings on generated-settings sites. The feature flag is the master switch; this
// pane just holds the IDs. No IDs → the pane shows but nothing tracks.
function trackingPaneYaml(indent) {
  const p = ' '.repeat(indent);
  return [
    `${p}- label: "Tracking & cookies"`,
    `${p}  name: tracking`,
    `${p}  file: "src/content/tracking/tracking.md"`,
    `${p}  fields:`,
    `${p}    - { name: gtmId, label: "Google Tag Manager ID", widget: string, required: false, hint: "GTM-XXXXXX. Covers GA4 and most pixels via your container." }`,
    `${p}    - { name: ga4Id, label: "Google Analytics 4 ID", widget: string, required: false, hint: "G-XXXXXXX. Only if you load GA4 directly (not via GTM)." }`,
    `${p}    - { name: metaPixelId, label: "Meta (Facebook) Pixel ID", widget: string, required: false }`,
    `${p}    - { name: privacyUrl, label: "Privacy policy URL", widget: string, required: false, hint: "Linked from the cookie banner, e.g. /integritetspolicy." }`,
  ].join('\n');
}
function emitTrackingPane(indent) {
  return FEATURES && FEATURES.tracking ? trackingPaneYaml(indent) : '';
}

const EMITTERS = { blocks: emitWidget, collections: emitCollections, navlinks: emitNavLinks, thanksbuttons: emitThanksButtons, footerlinks: emitFooterLinks, settings: emitSettings, cms: emitCms, tracking: emitTrackingPane };

// Fill every `# >>> NAME:generated … # <<< NAME:generated` region (idempotent).
const lines = readFileSync(configPath, 'utf8').split('\n');
const cache = {};
const out = [];
const counts = {};
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  out.push(line);
  const m = line.match(MARKER_START);
  if (m && EMITTERS[m[1]]) {
    const name = m[1];
    const indent = line.indexOf('#');
    const key = `${name}:${indent}`;
    cache[key] ??= EMITTERS[name](indent);
    out.push(cache[key]);
    counts[name] = (counts[name] || 0) + 1;
    const endMarker = `# <<< ${name}:generated`;
    while (i + 1 < lines.length && !lines[i + 1].includes(endMarker)) i++;
  }
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (total === 0) {
  console.error('No `# >>> blocks:generated` markers found in', configPath);
  process.exit(1);
}
// Localize label/label_singular/hint values: normalize any known translation back to
// English, then map to the active locale. Unmapped values (custom labels, icon ids,
// dynamic page options) pass through unchanged.
function translateLabels(text) {
  return text.replace(/\b(label|label_singular|hint): "((?:[^"\\]|\\.)*)"/g, (m, key, val) => {
    const plain = val.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const en = REVERSE_ALL[plain] ?? plain;
    const next = FORWARD && FORWARD[en] !== undefined ? FORWARD[en] : en;
    if (next === plain) return m;
    return `${key}: "${next.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  });
}

// Sveltia CMS config normalization. Sveltia ignores Decap's top-level `locale:` (that
// only set Decap's UI language) and `local_backend:` (Sveltia's local edits use the File
// System Access API, no proxy) — both emit console warnings, so strip them. Field LABELS
// are still localized below via `translateLabels` (driven by CMS_LOCALE), independent of
// the removed `locale:` line.
let yaml = out.join('\n');
yaml = yaml.replace(/^locale:.*$\n?/m, '');
yaml = yaml.replace(/^local_backend:.*$\n?/m, '');
// Uploads live in served public/media (Sveltia resolves assets via public_folder URL; src/ isn't served).
yaml = yaml.replace(/^media_folder: .*$/m, 'media_folder: "/public/media"');
yaml = yaml.replace(/^public_folder: .*$/m, 'public_folder: "/media"');
// Per-collection folders (absolute): per-entry collections use {{slug}}, flat/file a static folder.
const mSlug = (dir) => ({ m: `/public/media/${dir}/{{slug}}`, p: `/media/${dir}/{{slug}}` });
const mFlat = (dir) => ({ m: `/public/media/${dir}`, p: `/media/${dir}` });
const COLLECTION_MEDIA = {
  home: mFlat('home'), pages: mSlug('pages'), towns: mSlug('towns'), services: mSlug('services'),
  faq: mFlat('faq'), testimonials: mFlat('testimonials'), settings: mFlat('settings'),
};
// Listings: catalog (for-sale) per item; article (news/blog) flat — kept apart, never mixed.
for (const l of LISTINGS) COLLECTION_MEDIA[l.id] = l.preset === 'catalog' ? mSlug(l.id) : mFlat(l.id);
{
  const srcLines = yaml.split('\n');
  const injected = [];
  for (let i = 0; i < srcLines.length; i++) {
    injected.push(srcLines[i]);
    const cm = srcLines[i].match(/^ {2}- name: (\S+)\s*$/); // top-level collection (indent 2)
    if (cm && COLLECTION_MEDIA[cm[1]] && !/^ {4}media_folder:/.test(srcLines[i + 1] || '')) {
      injected.push(`    media_folder: ${JSON.stringify(COLLECTION_MEDIA[cm[1]].m)}`);
      injected.push(`    public_folder: ${JSON.stringify(COLLECTION_MEDIA[cm[1]].p)}`);
    }
  }
  yaml = injected.join('\n');
}
// Convention: collection-level `seo` groups render collapsed. Hand-authored panes (the
// static home/pages SEO) predate this — normalize by inserting `collapsed: true` after
// `widget: object` when the seo object doesn't set it. Idempotent.
{
  const srcLines = yaml.split('\n');
  for (let i = 0; i < srcLines.length; i++) {
    const m = srcLines[i].match(/^(\s*)(- )?name: seo\s*$/);
    if (!m) continue;
    const propIndent = m[1].length + (m[2] ? 2 : 0);
    const prop = (j) => {
      const mm = (srcLines[j] || '').match(/^(\s*)(- )?([\w-]+):/);
      return mm && mm[1].length + (mm[2] ? 2 : 0) === propIndent ? mm[3] : null;
    };
    let widgetAt = -1, hasCollapsed = false;
    for (let j = i + 1; j < srcLines.length; j++) {
      const k = prop(j);
      if (k === null || k === 'fields') break; // left the field's own props
      if (k === 'widget' && /widget: object\s*$/.test(srcLines[j])) widgetAt = j;
      if (k === 'collapsed') hasCollapsed = true;
    }
    if (widgetAt !== -1 && !hasCollapsed) srcLines.splice(widgetAt + 1, 0, `${' '.repeat(propIndent)}collapsed: true`);
  }
  yaml = srcLines.join('\n');
}
// Sveltia shrinks the master to webp on upload; Astro still builds the responsive variants.
if (!/^media_libraries:/m.test(yaml)) {
  yaml = yaml.replace(/^public_folder: .*$/m, (l) =>
    `${l}\nmedia_libraries:\n  all:\n    slugify_filename: true\n    transformations:\n` +
    `      raster_image: { format: webp, quality: 82, width: 2048, height: 2048 }\n` +
    `      svg: { optimize: true }`);
}
// `output.omit_empty_optional_fields: true` — Sveltia otherwise writes every optional
// field explicitly on save (e.g. `cta2Label: ''`). Our field policy is "absent = off"
// (rule zero), so keep saved files minimal. Idempotent upsert at the top of the config.
if (!/^output:/m.test(yaml)) {
  yaml = `output:\n  omit_empty_optional_fields: true\n${yaml}`;
}
yaml = translateLabels(yaml);
writeFileSync(configPath, yaml);

// Ship the engine's generic preview templates into the site's admin so live page
// previews + readable settings previews work out of the box (loaded before the
// site's own previews.js). Regenerated each run, so engine updates flow through.
try {
  const previewsDest = resolve(root, 'public/admin/stomme-previews.js');
  mkdirSync(dirname(previewsDest), { recursive: true });
  let previewsSrc = readFileSync(resolve(here, '../admin/previews.js'), 'utf8');
  // Localize the login-button relabel (previews.js ships the English default label).
  const LOGIN_LABELS = { en: 'Log in', sv: 'Logga in', da: 'Log ind', nb_no: 'Logg inn', nb: 'Logg inn', nn: 'Logg inn', de: 'Anmelden', fr: 'Se connecter', es: 'Iniciar sesión', it: 'Accedi', nl: 'Inloggen', pt: 'Entrar', fi: 'Kirjaudu sisään' };
  const loginLabel = LOGIN_LABELS[CMS_LOCALE] || LOGIN_LABELS[String(CMS_LOCALE).split(/[-_]/)[0]] || 'Log in';
  previewsSrc = previewsSrc.replace(/var LOGIN_LABEL = '[^']*'; \/\/ stomme:login-label/, `var LOGIN_LABEL = ${JSON.stringify(loginLabel)}; // stomme:login-label`);
  // Register a styled preview for each config-defined listing collection (article →
  // post preview, catalog → catalog preview); otherwise Decap shows a raw field dump.
  if (LISTINGS.length) {
    const regs = LISTINGS.map((l) => {
      const specs = (Array.isArray(l.specs) ? l.specs : []).map((s, i) =>
        typeof s === 'string' ? { key: `spec_${i}`, label: s } : { key: s.key || `spec_${i}`, label: s.label });
      return `  stommeRegisterListing(${JSON.stringify(l.id)}, ${JSON.stringify(l.preset)}, ${JSON.stringify(specs)});`;
    }).join('\n');
    previewsSrc += `\n// Listing collection previews (generated by stomme-gen)\nif (window.stommeRegisterListing) {\n${regs}\n}\n`;
  }
  writeFileSync(previewsDest, previewsSrc);
} catch (e) {
  console.warn('  (stomme-previews.js copy skipped:', e.message + ')');
}

// Same-window auth handoff for /admin. Browsers that open the login in the current tab
// instead of a popup (Arc, some mobile) have no live window.opener to receive the token,
// so the gateway redirects back to /admin with the token in the URL fragment. This shim
// persists it the way Decap does and reloads. It MUST run before the Decap bundle (whose
// hash router would otherwise consume the fragment), so it's injected into <head>.
// Managed here (idempotent via the markers) so every site gets it — and stays current —
// on build, rather than living as a hand-edited per-site file.
const AUTH_SHIM = `      (function () {
        try {
          var m = (location.hash || '').match(/stomme_cms_token=([^&]+)/);
          if (!m) return;
          var token = decodeURIComponent(m[1]);
          if (!token) return;
          var email = '';
          try {
            var b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            b += '==='.slice((b.length + 3) % 4);
            email = (JSON.parse(atob(b)) || {}).email || '';
          } catch (e) {}
          localStorage.setItem('sveltia-cms.user', JSON.stringify({ name: email, login: email, email: email, token: token, backendName: 'github' }));
          history.replaceState(null, '', location.pathname + location.search);
          location.reload();
        } catch (e) {}
      })();`;
try {
  const indexPath = resolve(root, 'public/admin/index.html');
  let html = readFileSync(indexPath, 'utf8');
  const START = '<!-- >>> stomme-auth:generated (managed by stomme-gen — do not edit) -->';
  const END = '<!-- <<< stomme-auth:generated -->';
  const region = `${START}\n    <script>\n${AUTH_SHIM}\n    </script>\n    ${END}`;
  const s = html.indexOf(START), e = html.indexOf(END);
  if (s !== -1 && e !== -1) {
    html = html.slice(0, s) + region + html.slice(e + END.length); // refresh in place
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', `    ${region}\n  </head>`); // inject once
  }
  // Pin the CMS bundle to Sveltia: swap a legacy Decap CDN tag AND re-pin an existing
  // Sveltia tag at any version (so a version bump propagates on cms:gen). Idempotent once at
  // the pinned URL. `type="module"` is intentionally omitted — Sveltia warns if it's present.
  html = html.replace(
    /<script\s+src="https:\/\/unpkg\.com\/(?:decap-cms|@sveltia\/cms)@[^"]*"><\/script>/,
    `<script src="${SVELTIA_CMS_SRC}"></script>`,
  );
  // Editor theme (conservative): one hue drives Sveltia's light+dark schemes; system font;
  // softer radii. CSS custom properties only — they inherit through the shadow DOM, and
  // explicit colours would break the in-app light/dark toggle. Managed region, like the shim.
  // `!important` is load-bearing: Sveltia injects its own `:root,:host{--sui-…}` at runtime after this style, so equal-specificity later rules would otherwise win.
  // Surfaces derive from a background/border ramp (per light/dark via [data-theme]); tinting it toward the brand hue and steepening the border contrast is what makes the editor legible rather than flat grey. Overridden per mode so the light/dark toggle still works.
  const RAMP_LIGHT = `--sui-background-color-1-hsl: var(--sui-base-hue) 30% 99% !important; --sui-background-color-2-hsl: var(--sui-base-hue) 22% 97% !important; --sui-background-color-3-hsl: var(--sui-base-hue) 20% 94% !important; --sui-background-color-4-hsl: var(--sui-base-hue) 18% 91% !important; --sui-background-color-5-hsl: var(--sui-base-hue) 26% 81% !important; --sui-border-color-1-hsl: var(--sui-base-hue) 18% 55% !important; --sui-border-color-2-hsl: var(--sui-base-hue) 20% 80% !important; --sui-border-color-3-hsl: var(--sui-base-hue) 18% 84% !important;`;
  const RAMP_DARK = `--sui-background-color-1-hsl: var(--sui-base-hue) 18% 9% !important; --sui-background-color-2-hsl: var(--sui-base-hue) 18% 11% !important; --sui-background-color-3-hsl: var(--sui-base-hue) 18% 14% !important; --sui-background-color-4-hsl: var(--sui-base-hue) 18% 17% !important; --sui-background-color-5-hsl: var(--sui-base-hue) 20% 27% !important; --sui-border-color-1-hsl: var(--sui-base-hue) 16% 42% !important; --sui-border-color-2-hsl: var(--sui-base-hue) 18% 30% !important; --sui-border-color-3-hsl: var(--sui-base-hue) 18% 26% !important;`;
  const THEME_STYLE = `<style>:root{
      --sui-base-hue: 152 !important; /* per site: brand hue */
      --sui-font-family-default: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
      --sui-font-weight-normal: 400 !important;
      --sui-font-weight-bold: 650 !important;
      --sui-control-medium-border-radius: 6px !important;
      --sui-textbox-border-radius: 6px !important;
      --sui-button-medium-border-radius: 6px !important;
      --sui-checkbox-border-radius: 4px !important;
      --sui-textbox-font-size: 15px !important;
    }
    :root, :host, :root[data-theme=light], :host[data-theme=light] { ${RAMP_LIGHT} }
    :root[data-theme=dark], :host[data-theme=dark] { ${RAMP_DARK} }
    @media (prefers-color-scheme: dark) { :root:not([data-theme=light]), :host:not([data-theme=light]) { ${RAMP_DARK} } }</style>`;
  const T_START = '<!-- >>> stomme-theme:generated (managed by stomme-gen — do not edit) -->';
  const T_END = '<!-- <<< stomme-theme:generated -->';
  const themeRegion = `${T_START}\n    ${THEME_STYLE}\n    ${T_END}`;
  const ts = html.indexOf(T_START), te = html.indexOf(T_END);
  if (ts !== -1 && te !== -1) {
    html = html.slice(0, ts) + themeRegion + html.slice(te + T_END.length); // refresh in place
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', `    ${themeRegion}\n  </head>`); // inject once
  }
  writeFileSync(indexPath, html);
} catch (e) {
  console.warn('  (admin auth shim skipped:', e.message + ')');
}

// Resolve the site's stylesheet (inline the library @import) into the admin so the
// CMS preview mockups reflect the site theme — tokens AND any class overrides the
// site adds. previews.js loads it via registerPreviewStyle('/admin/stomme-site.css').
// Re-run cms:gen after editing global.css to refresh it.
try {
  const libCss = readFileSync(resolve(here, '../styles.css'), 'utf8');
  // Inline the engine stylesheet (scoped @gronare/stomme or bare specifier — the raw import
  // can't resolve in the browser and 404s under /admin/). The engine's body layout rules
  // (flex column + full height, for the sticky footer) would shift the inline preview
  // panes, so neutralize them right after the inlined block.
  const PREVIEW_BODY_RESET = '\n/* admin preview: undo the sticky-footer body layout */\nbody{display:block;min-height:auto}\n';
  // When a style is set, inline its tokens.css + theme.css right after the engine CSS and
  // before the site's own rules — the same cascade position as the live build — so the CMS
  // preview mockups are truthful. Reads are guarded: `astro build` (the integration) throws on
  // a genuinely missing theme, so a warning here is enough.
  let styleCss = '';
  if (STYLE_DIR) {
    const tokensP = resolve(STYLE_DIR, 'tokens.css');
    const themeP = resolve(STYLE_DIR, 'theme.css');
    const tokens = existsSync(tokensP) ? readFileSync(tokensP, 'utf8') : '';
    const themeCss = existsSync(themeP) ? readFileSync(themeP, 'utf8') : '';
    if (tokens || themeCss) styleCss = `\n/* stomme style "${STYLE}" — tokens + theme (CMS preview) */\n${tokens}\n${themeCss}\n`;
    else console.warn(`  (stomme-gen: style "${STYLE}" has no tokens.css/theme.css at ${STYLE_DIR})`);
  }
  const siteCss = readFileSync(resolve(root, 'src/styles/global.css'), 'utf8')
    .replace(/@import\s+["'](?:@[\w-]+\/)?stomme\/styles\.css["'];?/, () => libCss + PREVIEW_BODY_RESET + styleCss);
  // Theme tokens from theme.md → :root, so the INLINE preview mockups (Identity, Contact,
  // …) use the site's actual colours, not the build-time defaults baked into styles.css.
  // (iframe previews already load the real themed page.) Mirrors Base.astro's themeVars.
  let themeRoot = '';
  try {
    const tm = readFileSync(resolve(root, 'src/content/theme/theme.md'), 'utf8');
    const tv = (k) => { const m = tm.match(new RegExp(`^${k}:\\s*["']?([^"'\\n]+?)["']?\\s*$`, 'm')); return m ? m[1].trim() : null; };
    const map = { brand: '--color-brand', ink: '--color-ink', onDark: '--color-on-dark', surface: '--color-surface', paper: '--color-paper', line: '--color-line', highlight: '--color-highlight', secondary: '--color-secondary', dark: '--color-dark', darkInk: '--color-dark-ink', darkLine: '--color-dark-line' };
    const vars = [];
    for (const [k, cssVar] of Object.entries(map)) { const v = tv(k); if (v) vars.push(`${cssVar}:${v}`); }
    const eb = tv('eyebrowColor');
    vars.push(`--eyebrow-accent:var(--color-${eb === 'highlight' ? 'highlight' : eb === 'secondary' ? 'secondary' : 'brand'})`);
    themeRoot = `\n/* theme.md tokens (for inline CMS previews) */\n:root{${vars.join(';')}}\n`;
  } catch {}
  writeFileSync(resolve(root, 'public/admin/stomme-site.css'), siteCss + themeRoot);
} catch (e) {
  console.warn('  (stomme-site.css skipped:', e.message + ')');
}

// Ship the engine's default art (structural placeholder SVGs + the animated cover bg)
// into the site's public/images. Engine-managed: overwritten each run, so improvements
// flow with a version bump. A site that wants its own art sets a block's image field
// instead of editing these files.
try {
  const imgSrc = resolve(here, '../assets/images');
  if (existsSync(imgSrc)) cpSync(imgSrc, resolve(root, 'public/images'), { recursive: true });
} catch (e) {
  console.warn('  (default images skipped:', e.message + ')');
}

// Generate the block gallery reference (public/admin/blocks.html) from the catalog, so an
// editor can see what each section produces — Decap's own picker can't show pictograms.
try {
  const t = (s) => (FORWARD && FORWARD[s] !== undefined ? FORWARD[s] : s);
  const html = renderGallery(AVAILABLE_BLOCKS, { t, groupOrder: GROUP_ORDER, locale: CMS_LOCALE });
  writeFileSync(resolve(root, 'public/admin/blocks.html'), html);
} catch (e) {
  console.warn('  (blocks.html skipped:', e.message + ')');
}


// Seed an editable index page per listing (once, if absent): pageHeader + the preset's
// list block, pointed at the listing's collection + route. Edit or delete like any page.
for (const l of LISTINGS) {
  try {
    const slug = l.route.replace(/^\/+/, '') || l.id;
    const pagePath = resolve(root, 'src/content/pages', `${slug}.md`);
    if (existsSync(pagePath)) continue;
    const label = JSON.stringify(l.label || l.id);
    const block =
      l.preset === 'catalog'
        ? `  - type: catalogList\n    source: ${l.id}\n    base: ${l.route}\n    media:\n      showImages: true\n    layout:\n      filters: true\n      columns: 3`
        : `  - type: postList\n    source: ${l.id}\n    base: ${l.route}\n    media:\n      showImages: true\n    layout:\n      featured: true\n      columns: 3`;
    mkdirSync(dirname(pagePath), { recursive: true });
    writeFileSync(pagePath, `---\ntitle: ${label}\nseo:\n  title: ${label}\n  description: ${label}\nblocks:\n  - type: pageHeader\n    heading: ${label}\n${block}\n---\n`);
    console.log(`  ↳ seeded editable listing index: src/content/pages/${slug}.md (${l.id})`);
  } catch (e) {
    console.warn(`  (listing index seed skipped for ${l.id}:`, e.message + ')');
  }
}

// Keep the engine's schema-manifest.json current with collections.ts. It's derived from
// the engine's OWN schema (not the site's), so regenerate only when running against the
// engine SOURCE — i.e. a monorepo build with the engine linked (`link:`). In a real
// node_modules install the shipped manifest is authoritative and read-only, so skip.
// gen-schema-manifest writes relative to its own dir, always the engine package.
if (!here.includes('node_modules')) {
  try {
    const { generate } = await import('./gen-schema-manifest.mjs');
    const m = await generate();
    console.log(`  ↳ schema-manifest.json refreshed (${Object.keys(m.collections).length} collections)`);
  } catch (e) {
    console.warn('  (schema-manifest refresh skipped:', e.message + ')');
  }
}

console.log(`✓ stomme-gen: ${Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(', ')} · ${AVAILABLE_BLOCKS.length} block types · ${PAGE_OPTIONS.length} link options`);
if (counts.collections) {
  const editors = Object.keys(COLLECTION_EDITORS).filter(collectionEnabled);
  console.log(`  ↳ collection editors: ${editors.length ? editors.join(', ') : '(none present)'}`);
}
if (SKIPPED_BLOCKS.length) {
  console.log(`  ↳ ${SKIPPED_BLOCKS.length} block(s) skipped — collection absent: ${SKIPPED_BLOCKS.map((b) => `${b.type}→${b.collection}`).join(', ')}`);
}
