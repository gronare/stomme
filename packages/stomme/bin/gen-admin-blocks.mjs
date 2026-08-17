#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, copyFileSync, cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import { renderGallery } from '../admin/blocks-gallery.mjs';

const root = process.cwd();
const here = dirname(fileURLToPath(import.meta.url));

// Pinned CMS bundle, swapped into each site's public/admin/index.html on build: bump deliberately — Sveltia is pre-1.0 and the editor is coupled to its DOM. STOMME_SVELTIA_SRC points at a local/vendored copy instead.
const SVELTIA_CMS_SRC = process.env.STOMME_SVELTIA_SRC || 'https://unpkg.com/@sveltia/cms@0.190.0/dist/sveltia-cms.js';

// Loaded through jiti rather than a bare dynamic import: Node's own type-stripping refuses any .ts file under node_modules, so importing schema.ts / site.config.ts breaks the moment its import graph reaches the installed package's .ts ('@gronare/stomme/kit', './catalog') — which is exactly what a registry install is. jiti transpiles .ts everywhere and resolves each module's bare specifiers from its own location.
const jiti = createJiti(import.meta.url);
const schemaPath = resolve(root, process.env.STOMME_SCHEMA || 'src/blocks/schema.ts');
const configPath = resolve(root, process.env.STOMME_CONFIG || 'public/admin/config.yml');

// No config.yml means the site has no public/admin at all (handed to a customer who edits the markdown), and everything this generator writes lives under public/admin — so exit 0 rather than fail the `pnpm build` that runs it.
if (!existsSync(configPath)) {
  console.log(`stomme-gen: no ${process.env.STOMME_CONFIG || 'public/admin/config.yml'} — CMS-less site, nothing to generate`);
  process.exit(0);
}

const { BLOCKS: SITE_BLOCKS } = await jiti.import(schemaPath);
if (!Array.isArray(SITE_BLOCKS)) {
  console.error(`No BLOCKS export found in ${schemaPath}`);
  process.exit(1);
}

// STOMME_SLOTS_DIR may ship a `block-catalog.mjs` exporting `BLOCKS`: the picker entries for the types its `blocks.mjs` registers, without which the component renders but no editor can ever choose it. A site's own catalog wins on a type clash, since schema.ts is the file its owner edits.
const BLOCKS = await (async () => {
  const slotsDir = process.env.STOMME_SLOTS_DIR;
  const file = slotsDir ? resolve(slotsDir, 'block-catalog.mjs') : null;
  if (!file || !existsSync(file)) return SITE_BLOCKS;
  try {
    const mod = await jiti.import(pathToFileURL(file).href);
    const added = (Array.isArray(mod.BLOCKS) ? mod.BLOCKS : []).filter((b) => b && b.type);
    const own = new Set(SITE_BLOCKS.map((b) => b.type));
    const fresh = added.filter((b) => !own.has(b.type));
    if (fresh.length) console.log(`  · addon blocks: ${fresh.map((b) => b.type).join(', ')}`);
    return [ ...SITE_BLOCKS, ...fresh ];
  } catch (e) {
    console.warn(`  ⚠ addon blocks: ${resolve(file)} could not be read (${e.message}) — skipped`);
    return SITE_BLOCKS;
  }
})();

let ROUTES = { services: '/services', towns: '/areas', blog: '/blog' };
let FEATURES = null; // null = no `features` declared → fall back to folder-existence
// Language of the generated /admin FIELD LABELS, applied at generation time via translateLabels() + admin/labels.<locale>.js — NOT a config.yml `locale:` line, which Sveltia ignores and which is stripped below. 'en' = the untranslated English source.
let CMS_LOCALE = 'en';
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
// The blog is an article listing in all but name, so desugar it and let one code path (editor, seeded index, dropdown source) cover both; the posts-folder fallback mirrors collectionEnabled for sites with no `features` config.
const blogEnabled = FEATURES
  ? !!FEATURES.blog
  : (() => { try { return readdirSync(resolve(root, 'src/content/posts')).some((f) => f.endsWith('.md')); } catch { return false; } })();
if (blogEnabled && !LISTINGS.some((l) => l.id === 'posts')) {
  LISTINGS.unshift({ id: 'posts', route: ROUTES.blog || '/blog', label: 'Blog', preset: 'article' });
}

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

// FORWARD is the active locale's dict (English ships none); REVERSE_ALL maps every shipped translation back to English so an already-localized config is normalized before re-localizing — that is what makes the pass idempotent and reversible across locale flips.
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

// A block may declare a source `collection` — src/content/<name>/, its glob base. When that folder is absent the block is dropped from the picker instead of being offered with nothing to load. Settings-backed blocks declare none and always show.
function collectionExists(name) {
  try {
    readdirSync(resolve(root, 'src/content', name));
    return true;
  } catch {
    return false;
  }
}
const FEATURE_OF = { faq: 'faq', testimonials: 'testimonials', towns: 'areas', posts: 'blog', services: 'services' };
function collectionEnabled(name) {
  if (name === 'home') return true; // every site has a home page
  // Pages are enabled unless EXPLICITLY disabled — a deliberate exception to "absent = off", since the collection predates feature flags and absent-means-off would orphan every existing site's page content.
  if (name === 'pages') return !(FEATURES && FEATURES.pages === false);
  if (FEATURES && FEATURE_OF[name]) return !!FEATURES[FEATURE_OF[name]];
  return collectionExists(name);
}
const hasCatalog = LISTINGS.some((l) => l.preset === 'catalog');
const hasArticle = !!(FEATURES && FEATURES.blog) || LISTINGS.some((l) => l.preset === 'article');
const presetOk = (b) => (b.type !== 'catalogList' || hasCatalog) && (b.type !== 'postList' || hasArticle);
const AVAILABLE_BLOCKS = BLOCKS.filter((b) => (!b.collection || collectionEnabled(b.collection)) && presetOk(b));

const NO_SAMPLE = BLOCKS.filter((b) => !(b.sample || (Array.isArray(b.samples) && b.samples.length)));
if (NO_SAMPLE.length) console.warn(`  ⚠ lookbook: no sample for ${NO_SAMPLE.map((b) => b.type).join(', ')} — add \`sample\`/\`samples\` in the catalog (block won't render in /lookbook)`);
const SKIPPED_BLOCKS = BLOCKS.filter((b) => (b.collection && !collectionEnabled(b.collection)) || !presetOk(b));

// The menu value encodes "<collectionId>::<routeBase>" — Header splits on it to query the collection AND build per-entry links, so the separator is a contract.
const MENU_OPTIONS = [];
if (collectionEnabled('services')) MENU_OPTIONS.push({ label: 'Services', value: `services::${ROUTES.services || '/services'}` });
if (collectionEnabled('towns')) MENU_OPTIONS.push({ label: 'Areas', value: `towns::${ROUTES.towns || '/areas'}` });
for (const l of LISTINGS) MENU_OPTIONS.push({ label: l.label || l.id, value: `${l.id}::${l.route}` }); // blog is in LISTINGS too
OPTION_SOURCES['$menus'] = MENU_OPTIONS;

// Cluster the "add section" picker (and the gallery) by group. The sort is STABLE, so blocks keep their catalog order within a group; an unknown or missing group ranks last.
const GROUP_ORDER = ['Hero & headers', 'Text', 'Cards & lists', 'Media', 'Quote & highlight', 'Numbers', 'From collections', 'Calls to action', 'Automatic'];
const groupRank = (b) => { const i = GROUP_ORDER.indexOf(b.group); return i === -1 ? GROUP_ORDER.length : i; };
AVAILABLE_BLOCKS.sort((a, b) => groupRank(a) - groupRank(b));

// The CMS labels a collapsed row with the FIRST field's value (an empty icon picker reads "No icon"), so derive a summary instead — eyebrow when present, then the identifying field; empty placeholders render as nothing. An explicit `summary` on the Field def wins.
const SUMMARY_PRIORITY = ['title', 'name', 'label', 'question', 'quote', 'heading', 'statement', 'term', 'caption', 'text', 'alt', 'value'];
function listSummary(fields) {
  const names = fields.map((f) => f.name);
  const parts = [];
  if (names.includes('eyebrow')) parts.push('{{fields.eyebrow}}');
  const main = SUMMARY_PRIORITY.find((n) => names.includes(n));
  if (main) parts.push(`{{fields.${main}}}`);
  return parts.length ? parts.join(' ') : null;
}

function emitField(f, indent) {
  const p = pad(indent);
  const parts = [`name: ${f.name}`, `label: ${q(f.label)}`, `widget: ${f.widget}`];
  if (f.required === false) parts.push('required: false');
  if (f.default !== undefined) parts.push(`default: ${typeof f.default === 'string' ? q(f.default) : f.default}`);
  if (f.hint) parts.push(`hint: ${q(f.hint)}`);
  if (f.media_folder) parts.push(`media_folder: ${q(f.media_folder)}`);
  if (f.public_folder) parts.push(`public_folder: ${q(f.public_folder)}`);

  const collapseProps = () => [
    ...(f.label_singular ? [`${p}  label_singular: ${q(f.label_singular)}`] : []),
    ...(f.collapsed !== undefined ? [`${p}  collapsed: ${f.collapsed}`] : []),
    // minimize_collapsed deliberately NOT emitted: with per-item cards, hiding the whole list behind a single "N items" row is a redundant extra click.
  ];
  // `widget: 'blocks'` in a catalog field means "sections here too": the container gets the real type list minus every container type, so the CMS cannot build a doll's house.
  if (f.widget === 'blocks') {
    const types = AVAILABLE_BLOCKS.filter((b) => !b.fields.some((x) => x.widget === 'blocks'));
    const lines = [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: list`,
      ...(f.required === false ? [`${p}  required: false`] : []),
      ...collapseProps(),
      ...(f.hint ? [`${p}  hint: ${q(f.hint)}`] : []),
      `${p}  summary: "{{fields.eyebrow}} {{fields.heading}}{{fields.quote}}"`,
      `${p}  types:`];
    for (const b of types) {
      lines.push(`${p}    - name: ${b.type}`, `${p}      label: ${q(b.label)}`, `${p}      widget: object`);
      lines.push(`${p}      fields:`);
      lines.push(...(b.fields.length
        ? b.fields.map((sf) => emitField(sf, indent + 8))
        : [`${p}        - { name: _auto, label: "Auto", widget: hidden }`]));
    }
    return lines.join('\n');
  }
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
    // Gate convention: an object whose first field is the boolean `enabled` renders as a switch-card (THEME_CSS GATED + editor.js), and collapsed:false is load-bearing there — the switch must stay mounted in BOTH UI states, since open/closed is the custom .stomme-open class and never Sveltia's disclosure.
    const gated = f.fields[0]?.widget === 'boolean' && f.fields[0]?.name === 'enabled';
    if (gated) head.push(`${p}  collapsed: false`);
    else if (f.collapsed !== undefined) head.push(`${p}  collapsed: ${f.collapsed}`);
    if (f.summary) head.push(`${p}  summary: ${q(f.summary)}`);
    if (f.hint) head.push(`${p}  hint: ${q(f.hint)}`);
    head.push(`${p}  fields:`);
    return [...head, ...f.fields.map((sf) => emitField(sf, indent + 4))].join('\n');
  }
  // A relation without `collection` + `value_field` shows a picker that resolves nothing.
  if (f.widget === 'relation') {
    const list = (v) => `[${(Array.isArray(v) ? v : [v]).map(q).join(', ')}]`;
    return [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: relation`,
      ...(f.required === false ? [`${p}  required: false`] : []),
      `${p}  collection: ${q(f.collection)}`,
      `${p}  value_field: ${q(f.value_field || '{{slug}}')}`,
      ...(f.search_fields ? [`${p}  search_fields: ${list(f.search_fields)}`] : []),
      ...(f.display_fields ? [`${p}  display_fields: ${list(f.display_fields)}`] : []),
      ...(f.multiple ? [`${p}  multiple: true`] : []),
      ...(f.hint ? [`${p}  hint: ${q(f.hint)}`] : [])].join('\n');
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
    `${p}  collapsed: true`,
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

// Rendered chrome-less inline by the editor theme — a nav label's link is inherent, and both fields blank makes a dropdown-only header. collapsed:false is load-bearing for that flat rendering: the children must stay mounted.
function navLinkField(pageHint = 'Pick a page on the site. Leave blank for a dropdown-only header (the label just opens its menu).') {
  return {
    name: 'link', label: 'Link', widget: 'object', collapsed: false, fields: [
      { name: 'page', label: 'Page', widget: 'select', options: '$pages', required: false, hint: pageHint },
      { name: 'url', label: '…or a custom URL', widget: 'string', required: false, hint: 'External link, tel: or mailto: — overrides the page above.' },
    ],
  };
}

function emitFooterLinks(indent) {
  const footerLink = () => ({
    name: 'link', label: 'Link', widget: 'object', collapsed: false, fields: [
      { name: 'page', label: 'Page', widget: 'select', options: '$pages', required: false, hint: 'Pick a page on the site.' },
      { name: 'url', label: '…or a custom URL', widget: 'string', required: false, hint: 'External link, tel: or mailto: — overrides the page above.' },
    ],
  });
  const linkList = (name, label) => ({
    name, label, widget: 'list', required: false, collapsed: true, label_singular: 'Link', summary: '{{fields.label}}', fields: [
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
    name: 'items', label: 'Menu links', widget: 'list', required: false, collapsed: true, label_singular: 'Menu link', summary: '{{fields.label}}', fields: [
      { name: 'label', label: 'Label', widget: 'string' },
      navLinkField(),
      { name: 'menu', label: 'Dropdown from collection', widget: 'select', options: '$menus', required: false, hint: 'Optional. Fill a dropdown with every entry of a collection (e.g. all services). Overrides manual sub-links below.' },
      { name: 'children', label: '…or manual sub-links', widget: 'list', required: false, collapsed: true, label_singular: 'Sub-link', summary: '{{fields.label}}', fields: [{ name: 'label', label: 'Label', widget: 'string' }, navLinkField()] },
    ],
  };
  const cta = {
    name: 'cta', label: 'Button', widget: 'object', required: false, collapsed: true, summary: '{{fields.label}}', fields: [
      { name: 'label', label: 'Label', widget: 'string' },
      navLinkField(),
    ],
  };
  return [emitField(items, indent), emitField(cta, indent)].join('\n');
}

// A thanks button is the same { label, link } shape as the header CTA (it reuses navLinkField) and is resolved at render by resolveLink (stomme/href).
function buttonField(name, label, labelHint) {
  return {
    name, label, widget: 'object', required: false, collapsed: true, summary: '{{fields.label}}', fields: [
      { name: 'label', label: 'Label', widget: 'string', required: false, hint: labelHint },
      navLinkField('Pick a page on the site.'),
    ],
  };
}
function emitThanksButtons(indent) {
  return [
    emitField(buttonField('button', 'Primary button', 'Blank = localized default ("Back to home").'), indent),
    emitField(buttonField('button2', 'Second button'), indent),
  ].join('\n');
}

// No field-level media_folder in any editor below: the CMS resolves it relative to the entry, which breaks uploads from subfolder entries — the global media_folder in config.yml is the one that works.
// A collection whose component sorts by `order` declares `reorder: true`: Sveltia gains a Reorder mode that writes index+1 into the hidden `order` field on Done.
const COLLECTION_EDITORS = {
  home: `- name: home
  label: "Home page"
  files:
    - name: home
      label: "Home"
      file: "src/content/home/home.md"
      fields:
        - name: seo
          label: "SEO"
          widget: object
          collapsed: true
          fields:
            - { name: title, label: "SEO title", widget: string }
            - { name: description, label: "SEO description", widget: text }
${emitWidget(8)}`,
  pages: `- name: pages
  label: "Pages"
  label_singular: "Page"
  folder: "src/content/pages"
  create: true
  slug: "{{slug}}"
  fields:
    - { name: title, label: "Title", widget: string }
    - { name: published, label: "Published", widget: boolean, default: true, required: false, hint: "Uncheck to hide the page — unpublished pages aren't built." }
    - name: seo
      label: "SEO"
      widget: object
      collapsed: true
      fields:
        - { name: title, label: "SEO title", widget: string }
        - { name: description, label: "SEO description", widget: text }
${emitWidget(4)}`,
  faq: `- name: faq
  label: "FAQ"
  label_singular: "Question"
  folder: "src/content/faq"
  create: true
  reorder: true
  summary: "{{fields.question}}"
  slug: "{{slug}}"
  fields:
    - { name: question, label: "Question", widget: string }
    - { name: answer, label: "Answer", widget: text }
    - { name: order, widget: hidden, required: false, default: 0 }
    - name: tags
      label: "Tags"
      widget: list
      required: false
      collapsed: true
      summary: "{{fields.tag}}"
      hint: "Scope the question to pages: an FAQ block filtered on a tag (e.g. a service or town) shows every question carrying it. Click a suggested tag to add it, or type a new one."
      field: { name: tag, label: "Tag", widget: string }`,
  testimonials: `- name: testimonials
  label: "Testimonials"
  label_singular: "Testimonial"
  folder: "src/content/testimonials"
  create: true
  reorder: true
  summary: "{{fields.name}}"
  slug: "{{slug}}"
  fields:
    - { name: name, label: "Name", widget: string }
    - { name: role, label: "Role / company", widget: string, required: false }
    - { name: quote, label: "Quote", widget: text }
    - { name: order, widget: hidden, required: false, default: 0 }`,
  towns: `- name: towns
  label: "Service areas"
  label_singular: "Area"
  folder: "src/content/towns"
  create: true
  reorder: true
  summary: "{{fields.name}}"
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
    - { name: order, widget: hidden, required: false, default: 0 }
    - { name: heroSubtitle, label: "Hero subtitle", widget: text, required: false }
    - { name: heroNote, label: "Hero note", widget: string, required: false }
    - { name: why, label: "Why us here (paragraphs)", widget: text, required: false }
    - name: problems
      label: "Problems we solve"
      widget: list
      required: false
      label_singular: "Problem"
      collapsed: true
      field: { name: item, label: "Problem", widget: string }
    - name: districts
      label: "Districts / areas"
      widget: list
      required: false
      label_singular: "District"
      collapsed: true
      field: { name: item, label: "District", widget: string }
    - { name: localCase, label: "Local case", widget: text, required: false }
    - name: services
      label: "Services offered here"
      widget: list
      required: false
      label_singular: "Service"
      collapsed: true
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
  reorder: true
  summary: "{{fields.navLabel}}"
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
    - { name: order, widget: hidden, required: false, default: 0 }
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
      hint: "Only used when the page is built from sections below: renders a compact page header (title + summary + these extras, image beside the text) instead of the plain one."
      fields:
        - name: ticks
          label: "Ticks (checkmark lines)"
          widget: list
          required: false
          label_singular: "Line"
          collapsed: true
          hint: "Short ✓ lines under the summary — key reassurances."
          field: { name: text, label: "Line", widget: string }
${emitField({ ...buttonField('cta', 'Button'), hint: "The header always shows a button — blank label and link fall back to the site's quote button and the contact page." }, 8)}
${emitField({ ...buttonField('cta2', 'Second button'), hint: 'A quiet text link beside the button — e.g. link to #process to jump to a section with that anchor.' }, 8)}
${emitWidget(4)}
    - { name: body, label: "Long-form text (fallback)", widget: markdown, required: false, hint: "Only shown when no sections are built above. Prefer sections; this is the simple prose fallback." }`,
};

function listingEditor(l) {
  const articleFields = `    - { name: title, label: "Title", widget: string }
    - { name: date, label: "Date", widget: datetime, date_format: "YYYY-MM-DD", time_format: false }
    - { name: excerpt, label: "Excerpt", widget: text, required: false }
    - { name: cover, label: "Cover image", widget: image, required: false }
    - { name: showCover, label: "Show cover", widget: boolean, required: false, default: false, hint: "Show a cover on cards + the article — your image, or a themed default if none." }
    - { name: body, label: "Body", widget: markdown }`;
  // A bare string spec keys off its position (spec_0, spec_1…), so renaming a label never orphans stored data — but REORDERING does. Give an explicit key to be safe.
  const specs = (Array.isArray(l.specs) ? l.specs : []).map((s, i) =>
    typeof s === 'string' ? { key: `spec_${i}`, label: s } : { key: s.key || `spec_${i}`, label: s.label });
  const specsField = specs.length
    ? `\n    - name: specs
      label: "Specs"
      widget: object
      collapsed: true
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
      collapsed: true
      label_singular: "Image"
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

// STOMME_SLOTS_DIR may ship a `cms.mjs` exporting `collections`: { feature, yaml } entries, or a function called with the site's own { routes, features }, `blocks(indent)` — the very picker the engine's own page editors embed — and `fields`. Each `yaml` is one collection authored at indent 0, emitted only when features[feature] is truthy; no dir / no file ⇒ config.yml unchanged.
let ADDON_PANES = [];
const ADDON_PANEL_FILES = {};
{
  const slotsDir = process.env.STOMME_SLOTS_DIR;
  const manifest = slotsDir ? resolve(slotsDir, 'cms.mjs') : null;
  if (manifest && existsSync(manifest)) {
    try {
      const mod = await import(pathToFileURL(manifest).href);
      const declared = mod.collections ?? mod.default;
      const entries = typeof declared === 'function'
        ? declared({
            routes: ROUTES, features: FEATURES, blocks: emitWidget,
            fields: {
              button: (name, label, indent = 8, hint) => emitField(buttonField(name, label, hint), indent),
              link: (name, label, indent = 8, hint) =>
                emitField({ ...navLinkField(hint), name, label }, indent),
            },
          })
        : declared;
      // `panelFiles` is { <collection>: [ { feature, yaml } ] }: files spliced into the `files:` list of a collection the engine already emits, so an extension's own setting lands under Settings beside the header and the identity instead of as a lone collection at the bottom of the sidebar. Gated on the feature, and given the same context a collection gets — a panel file is a page like any other and the block picker is the site's own.
      const addonCtx = {
        routes: ROUTES, features: FEATURES, blocks: emitWidget,
        fields: {
          button: (name, label, indent = 8, hint) => emitField(buttonField(name, label, hint), indent),
          link: (name, label, indent = 8, hint) =>
            emitField({ ...navLinkField(hint), name, label }, indent),
        },
      };
      const panels = typeof mod.panelFiles === 'function' ? mod.panelFiles(addonCtx) : mod.panelFiles;
      for (const [collection, list] of Object.entries(panels || {})) {
        ADDON_PANEL_FILES[collection] = (Array.isArray(list) ? list : []).filter((e) => {
          if (!e || typeof e.feature !== 'string' || !e.feature || typeof e.yaml !== 'string' || !e.yaml.trim()) {
            console.warn('  ⚠ addon cms: skipped a malformed panel file (needs a non-empty `feature` and `yaml`)');
            return false;
          }
          return !FEATURES || !!FEATURES[e.feature];
        });
      }

      ADDON_PANES = (Array.isArray(entries) ? entries : []).filter((e) => {
        if (!e || typeof e.feature !== 'string' || !e.feature || typeof e.yaml !== 'string' || !e.yaml.trim()) {
          console.warn('  ⚠ addon cms: skipped a malformed entry (needs a non-empty `feature` and `yaml`)');
          return false;
        }
        return !FEATURES || !!FEATURES[e.feature];
      });
    } catch (e) {
      // A broken manifest must not silently cost the site every generated pane.
      throw new Error(`stomme-gen: failed to load the CMS manifest from STOMME_SLOTS_DIR (${manifest}): ${e?.message || e}`);
    }
  }
}

// A hand-authored collection of the same name OUTSIDE the generated regions wins: STATIC_COLLECTIONS suppresses its generated counterpart, so a site keeping (or customizing) a static pane never gets a duplicate.
const generatedEditors = () => Object.keys(COLLECTION_EDITORS).filter(collectionEnabled).filter((n) => !STATIC_COLLECTIONS.has(n));
function emitCollections(indent) {
  const p = pad(indent);
  const ind = (s) => s.split('\n').map((l) => (l ? p + l : l)).join('\n');
  const fixed = generatedEditors().map((name) => ind(COLLECTION_EDITORS[name]));
  const listing = LISTINGS.map((l) => ind(listingEditor(l)));
  // Addon panes last, so an out-of-tree extension can never displace a site's own editors.
  const addon = ADDON_PANES.map((e) => ind(e.yaml.replace(/\n+$/, '')));
  return [...fixed, ...listing, ...addon].join('\n');
}

// Only the fields the site's `cms` config sets are written; the defaults are git-gateway on main. No `cms:generated` markers in a site's config.yml ⇒ nothing emitted and a hand-authored backend survives.
function emitCms(indent) {
  const p = ' '.repeat(indent);
  const c = CMS || {};
  const L = [`${p}backend:`, `${p}  name: ${c.backend || 'git-gateway'}`];
  if (c.repo) L.push(`${p}  repo: ${c.repo}`);
  L.push(`${p}  branch: ${c.branch || 'main'}`);
  if (c.baseUrl) L.push(`${p}  base_url: ${c.baseUrl}`);
  if (c.authEndpoint) L.push(`${p}  auth_endpoint: ${c.authEndpoint}`);
  if (c.apiRoot) L.push(`${p}  api_root: ${c.apiRoot}`);
  // Gated on baseUrl: only a site with gateway OAuth loses Sveltia's built-in PAT sign-in — solo/local sites with no auth server keep the token fallback.
  if (c.baseUrl) L.push(`${p}  auth_methods: [oauth]`);
  // Sveltia sends the OAuth `site_id` from `site_domain`, and the gateway's same-window (Arc/mobile) fallback keys off it to find the site in KV; it defaults to the deploy host.
  if (c.siteDomain) L.push(`${p}  site_domain: ${c.siteDomain}`);
  if (c.gatewayUrl) L.push(`${p}  gateway_url: ${c.gatewayUrl}`);
  if (c.identityUrl) L.push(`${p}  identity_url: ${c.identityUrl}`);
  return L.join('\n');
}

// A SECOND file pane on site.md — Sveltia preserves each pane's other frontmatter on save. The data lands at settings.ogImage and settings.og.{enabled,types}, read by Head.astro / routes/og.ts / src/og-pages.ts.
function shareTypeList() {
  const out = [];
  if (collectionEnabled('towns')) out.push({ key: 'towns', label: 'Service areas', kind: 'towns' });
  if (collectionEnabled('services')) out.push({ key: 'services', label: 'Services', kind: 'services' });
  for (const l of LISTINGS) out.push({ key: l.id, label: l.label || l.id, kind: l.preset });
  return out;
}
// Per type kind: that type's known text fields — the keys must exist in src/og-pages.ts TYPE_FIELDS — plus "Business name" (the site name).
const SHARE_FIELDS = {
  towns: [['name', 'Town name'], ['title', 'Title'], ['heroSubtitle', 'Hero subtitle']],
  services: [['title', 'Title'], ['navLabel', 'Nav label'], ['summary', 'Summary']],
  article: [['title', 'Title'], ['date', 'Date'], ['excerpt', 'Excerpt']],
  catalog: [['title', 'Title'], ['price', 'Price'], ['status', 'Status'], ['category', 'Category'], ['date', 'Date added']],
};
// Select defaults (mirrored by the renderer fallbacks in src/og-pages.ts).
const SHARE_DEFAULTS = { towns: { headline: 'name', subline: 'none' }, catalog: { headline: 'title', subline: 'price' } };
function emitShareType(t, indent) {
  const p = pad(indent);
  const fields = SHARE_FIELDS[t.kind] || SHARE_FIELDS.article;
  const dflt = SHARE_DEFAULTS[t.kind] || { headline: 'title', subline: 'none' };
  const labelOf = (v) => (v === 'none' ? 'None' : (fields.find(([k]) => k === v) || [])[1] || v);
  const opts = fields.map(([v, l]) => `${p}        - { label: ${q(l)}, value: ${v} }`);
  const business = `${p}        - { label: "Business name", value: business }`;
  return [
    `${p}- name: ${t.key}`,
    `${p}  label: ${q(t.label)}`,
    `${p}  widget: object`,
    // Gate convention: collapsed:false is load-bearing — the enabled switch must stay mounted in both UI states, since open/closed is the custom .stomme-open class and never Sveltia's disclosure (THEME_CSS GATED + editor.js).
    `${p}  collapsed: false`,
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
    `${p}    - name: headlineField`,
    `${p}      label: "Headline"`,
    `${p}      widget: select`,
    `${p}      required: false`,
    `${p}      default: ${dflt.headline}`,
    `${p}      hint: ${q("The card's big line — filled from each item. Empty = " + labelOf(dflt.headline) + '.')}`,
    `${p}      options:`,
    ...opts,
    business,
    `${p}    - name: sublineField`,
    `${p}      label: "Second line"`,
    `${p}      widget: select`,
    `${p}      required: false`,
    `${p}      default: ${dflt.subline}`,
    `${p}      hint: ${q('A smaller line under the headline. Empty = ' + labelOf(dflt.subline) + '.')}`,
    `${p}      options:`,
    `${p}        - { label: "None", value: none }`,
    ...opts,
    business,
    `${p}    - { name: scrim, label: "Scrim strength", widget: number, value_type: int, min: 0, max: 100, default: 55, required: false, hint: "How dark the gradient over the photo is (0–100). More = better text contrast, less photo." }`,
    `${p}    - { name: showLogo, label: "Show the wordmark", widget: boolean, required: false, default: true }`,
    `${p}    - { name: accent, label: "Accent colour", widget: color, required: false, hint: "The accent rule and wordmark accent. Empty uses your brand colour." }`,
  ].join('\n');
}
function emitShareCards(indent) {
  const p = pad(indent);
  const types = shareTypeList();
  // The og + og.types wrappers exist only for the data path (og.enabled, og.types.<key>): the editor renders them CHROME-LESS by data-key-path in THEME_CSS so the pane reads flat, and collapsed:false is load-bearing — their content must always be visible.
  const typeFields = types.length
    ? [`${p}        - name: types`, `${p}          label: "Per content type"`, `${p}          widget: object`,
       `${p}          collapsed: false`,
       `${p}          hint: "Turn a type on and open it to pick its card style and text lines."`,
       `${p}          fields:`,
       ...types.map((t) => emitShareType(t, indent + 12))].join('\n')
    : `${p}        - { name: _notypes, label: "Per content type", widget: hidden, required: false }`;
  return [
    `${p}- name: sharecards`,
    `${p}  label: "Share cards"`,
    `${p}  file: "src/content/settings/site.md"`,
    `${p}  fields:`,
    `${p}    - { name: ogImage, label: "Site default share image", widget: image, required: false, media_folder: "/public/media/share", public_folder: "/media/share", hint: "Shown when a page is shared (iMessage, Slack, social) and it has no card of its own. Use ~1200×630px." }`,
    // Always-rendered object (no `required: false`): Sveltia wraps an optional object behind an "Add …" button, which would hide the master toggle and the per-type sections.
    `${p}    - name: og`,
    `${p}      label: "Generated share cards"`,
    `${p}      widget: object`,
    `${p}      collapsed: false`,
    `${p}      fields:`,
    `${p}        - { name: enabled, label: "Generate a card per item", widget: boolean, required: false, default: false, hint: "Each item's photo becomes a 1200×630 card with your wordmark and a headline. Off = everything shares the site default image above." }`,
    typeFields,
  ].join('\n');
}

// emitSettings takes no indent, unlike every other emitter: its panes are written at absolute indentation, with the `settings` collection itself at indent 2.
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
            collapsed: true
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
            collapsed: true
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
            collapsed: true
            label_singular: "holiday line"
            summary: "{{fields.when}} · {{fields.note}}"
            fields:
              - { name: when, label: "When", widget: string, hint: "e.g. Dec 24–26" }
              - { name: note, label: "Note", widget: string, hint: "e.g. Closed for the holidays" }
          - name: away
            label: "Away banner"
            widget: object
            collapsed: false
            hint: "Shows a notice on every contact card. Auto-hides after the date."
            fields:
              - { name: enabled, label: "Show the away banner", widget: boolean, required: false, default: false }
              - { name: message, label: "Message", widget: string, required: false, hint: "e.g. Away until Jan 8 — leave a message and we'll reply then." }
              - { name: until, label: "Auto-hide after", widget: datetime, date_format: "YYYY-MM-DD", time_format: false, required: false }
          - name: socials
            label: "Social profiles"
            widget: list
            required: false
            collapsed: true
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
          - { name: showContact, label: "Show the direct-contact card", widget: boolean, required: false, default: true, hint: "Phone / email / hours from Site & contact." }${tp ? '\n' + tp : ''}${addonPanelFiles('settings', 6)}`;
}

// Files an out-of-tree extension contributes to a collection the engine emits. Appended last, so a site's own settings can never be displaced by one.
function addonPanelFiles(collection, indent) {
  const entries = ADDON_PANEL_FILES[collection] || [];
  if (!entries.length) return '';

  const p = pad(indent);
  return '\n' + entries
    .map((e) => e.yaml.replace(/\n+$/, '').split('\n').map((l) => (l ? p + l : l)).join('\n'))
    .join('\n');
}

// Only emitted when the `tracking` feature is on: into a `tracking:generated` region on static-pane sites, folded into emitSettings on generated-settings ones. The feature flag is the master switch; this pane only holds the IDs.
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

const lines = readFileSync(configPath, 'utf8').split('\n');
// Top-level collections hand-authored OUTSIDE any generated region (indent-2 entries of `collections:`) — these suppress their generated counterpart in emitCollections.
const STATIC_COLLECTIONS = new Set();
{
  let inRegion = false;
  for (const l of lines) {
    if (MARKER_START.test(l)) { inRegion = true; continue; }
    if (/# <<< \w+:generated/.test(l)) { inRegion = false; continue; }
    const m = inRegion ? null : l.match(/^ {2}- name: (\S+)\s*$/);
    if (m) STATIC_COLLECTIONS.add(m[1]);
  }
}
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
// Normalize any known translation back to English, then map to the active locale; unmapped values (custom labels, icon ids, dynamic page options) pass through unchanged.
function translateLabels(text) {
  return text.replace(/\b(label|label_singular|hint): "((?:[^"\\]|\\.)*)"/g, (m, key, val) => {
    const plain = val.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const en = REVERSE_ALL[plain] ?? plain;
    const next = FORWARD && FORWARD[en] !== undefined ? FORWARD[en] : en;
    if (next === plain) return m;
    return `${key}: "${next.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  });
}

// Sveltia ignores Decap's top-level `locale:` (Decap's own UI language) and `local_backend:` (Sveltia's local edits use the File System Access API, no proxy) and warns in the console about both, so strip them — field LABELS are localized by translateLabels instead.
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
// Convention: collection-level `seo` groups render collapsed. Hand-authored panes predate it, so insert `collapsed: true` after `widget: object` when the seo object sets none. Idempotent.
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
// Without `output.omit_empty_optional_fields` Sveltia writes every optional field explicitly on save (`cta2Label: ''`), against the field policy that absent = off. Idempotent upsert at the top of the config.
if (!/^output:/m.test(yaml)) {
  yaml = `output:\n  omit_empty_optional_fields: true\n${yaml}`;
}
yaml = translateLabels(yaml);

// Sveltia's local mode requires the picked directory to BE the repository root (it checks for `.git`) and resolves every path from there, so a site living in a subdirectory needs its paths written from the repo root — that is `cms.repoPath`. Only filesystem paths move: `public_folder` is a URL on the built site, and every image 404s if it gains the prefix.
const REPO_PATH = String((CMS && CMS.repoPath) || '').trim().replace(/^\/+|\/+$/g, '');
if (REPO_PATH) {
  yaml = yaml
    .replace(/^(\s*)(folder|file): "(?!\/)/gm, `$1$2: "${REPO_PATH}/`)
    .replace(/^(\s*)media_folder: "\//gm, `$1media_folder: "/${REPO_PATH}/`)
    .replace(/(\{[^}\n]*?)media_folder: "\//g, `$1media_folder: "/${REPO_PATH}/`);
  console.log(`  · monorepo: paths written from the repo root (${REPO_PATH}/…)`);
}

writeFileSync(configPath, yaml);

// The slots dir may ship a `previews.js` registering preview templates for the collections it contributes; copied beside the engine's own and loaded between it and the site's, so it can build on the engine's generic templates and the site still has the last word.
try {
  const slotsDir = process.env.STOMME_SLOTS_DIR;
  const src = slotsDir ? resolve(slotsDir, 'previews.js') : null;
  const dest = resolve(root, 'public/admin/stomme-addon-previews.js');
  if (src && existsSync(src)) {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    console.log('  ↳ addon previews: stomme-addon-previews.js');
  } else if (existsSync(dest)) {
    rmSync(dest);
  }
} catch (e) {
  console.warn('  (addon previews copy skipped:', e.message + ')');
}

try {
  const previewsDest = resolve(root, 'public/admin/stomme-previews.js');
  mkdirSync(dirname(previewsDest), { recursive: true });
  let previewsSrc = readFileSync(resolve(here, '../admin/previews.js'), 'utf8');
  // Localize the login-button relabel (previews.js ships the English default label).
  const LOGIN_LABELS = { en: 'Log in', sv: 'Logga in', da: 'Log ind', nb_no: 'Logg inn', nb: 'Logg inn', nn: 'Logg inn', de: 'Anmelden', fr: 'Se connecter', es: 'Iniciar sesión', it: 'Accedi', nl: 'Inloggen', pt: 'Entrar', fi: 'Kirjaudu sisään' };
  const loginLabel = LOGIN_LABELS[CMS_LOCALE] || LOGIN_LABELS[String(CMS_LOCALE).split(/[-_]/)[0]] || 'Log in';
  previewsSrc = previewsSrc.replace(/var LOGIN_LABEL = '[^']*'; \/\/ stomme:login-label/, `var LOGIN_LABEL = ${JSON.stringify(loginLabel)}; // stomme:login-label`);
  // A listing collection with no registered preview shows a raw field dump in the CMS.
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

// The distinct FAQ tags are templated into the editor script so the tags editor can offer them as chips.
try {
  const editorDest = resolve(root, 'public/admin/stomme-editor.js');
  mkdirSync(dirname(editorDest), { recursive: true });
  let editorSrc = readFileSync(resolve(here, '../admin/editor.js'), 'utf8');
  editorSrc = editorSrc.replace(/var FAQ_TAGS = \[[^\]]*\]; \/\/ stomme:faq-tags/,
    `var FAQ_TAGS = ${JSON.stringify(FAQ_TAG_OPTIONS.map((o) => o.value))}; // stomme:faq-tags`);
  writeFileSync(editorDest, editorSrc);
} catch (e) {
  console.warn('  (stomme-editor.js copy skipped:', e.message + ')');
}

// Same-window auth handoff: browsers that open the login in the current tab instead of a popup (Arc, some mobile) have no live window.opener to receive the token, so the gateway redirects back to /admin with it in the URL fragment and this shim persists it the way Sveltia does. It MUST run before the CMS bundle, whose hash router would otherwise consume the fragment — hence <head>.
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
  // Re-pins an existing Sveltia tag at any version as well as swapping a legacy Decap one, so a version bump propagates on cms:gen. `type="module"` is deliberately omitted — Sveltia warns when it is present.
  html = html.replace(
    /<script\s+src="https:\/\/unpkg\.com\/(?:decap-cms|@sveltia\/cms)@[^"]*"><\/script>/,
    `<script src="${SVELTIA_CMS_SRC}"></script>`,
  );
  // Loaded after the CMS bundle and cache-busted by a content hash, so a plain reload always gets the current version.
  {
    let src = ''; try { src = readFileSync(resolve(here, '../admin/editor.js'), 'utf8'); } catch (e) {}
    let h = 0; for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
    const addonTag = '<script src="/admin/stomme-addon-previews.js"></script>';
    const hasAddonPreviews = existsSync(resolve(root, 'public/admin/stomme-addon-previews.js'));
    if (hasAddonPreviews && !html.includes(addonTag)) {
      html = html.replace('<script src="/admin/previews.js"></script>',
        `${addonTag}\n    <script src="/admin/previews.js"></script>`);
    } else if (!hasAddonPreviews && html.includes(addonTag)) {
      html = html.replace(new RegExp(`\\s*${addonTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '');
    }
    const tag = `<script src="/admin/stomme-editor.js?v=${(h >>> 0).toString(36)}"></script>`;
    if (/<script src="\/admin\/stomme-editor\.js[^"]*"><\/script>/.test(html)) {
      html = html.replace(/<script src="\/admin\/stomme-editor\.js[^"]*"><\/script>/, tag);
    } else {
      html = html.replace(`<script src="${SVELTIA_CMS_SRC}"></script>`, `<script src="${SVELTIA_CMS_SRC}"></script>\n    ${tag}`);
    }
  }
  // Editor theme: CSS custom properties only — they inherit through the shadow DOM, and explicit colours would break Sveltia's in-app light/dark toggle.
  // `!important` is load-bearing: Sveltia injects its own `:root,:host{--sui-…}` at runtime after this style, so equal-specificity later rules would otherwise win.
  // Surfaces + accent derive from a per-mode ramp; kept NEUTRAL (near-zero saturation) so the editor reads as clean grey, with steeper lightness steps + darker borders for box definition. Accent is a desaturated slate — Sveltia bakes 80-100% saturation into --sui-primary-accent-color*, so each is overridden. Per site: set --sui-base-hue + raise accent saturation for a brand accent.
  const RAMP_LIGHT = `--sui-background-color-1-hsl: var(--sui-base-hue) 6% 100% !important; --sui-background-color-2-hsl: var(--sui-base-hue) 7% 96.5% !important; --sui-background-color-3-hsl: var(--sui-base-hue) 8% 93.5% !important; --sui-background-color-4-hsl: var(--sui-base-hue) 8% 89.5% !important; --sui-background-color-5-hsl: var(--sui-base-hue) 10% 81% !important; --sui-border-color-1-hsl: var(--sui-base-hue) 9% 56% !important; --sui-border-color-2-hsl: var(--sui-base-hue) 10% 77% !important; --sui-border-color-3-hsl: var(--sui-base-hue) 10% 83% !important;`;
  const RAMP_DARK = `--sui-background-color-1-hsl: var(--sui-base-hue) 8% 10% !important; --sui-background-color-2-hsl: var(--sui-base-hue) 8% 12.5% !important; --sui-background-color-3-hsl: var(--sui-base-hue) 8% 15.5% !important; --sui-background-color-4-hsl: var(--sui-base-hue) 9% 19% !important; --sui-background-color-5-hsl: var(--sui-base-hue) 10% 29% !important; --sui-border-color-1-hsl: var(--sui-base-hue) 9% 44% !important; --sui-border-color-2-hsl: var(--sui-base-hue) 10% 31% !important; --sui-border-color-3-hsl: var(--sui-base-hue) 10% 26% !important;`;
  const ACCENT_LIGHT = `--sui-primary-accent-color: hsl(var(--sui-base-hue) 14% 40%) !important; --sui-primary-accent-color-light: hsl(var(--sui-base-hue) 14% 46%) !important; --sui-primary-accent-color-dark: hsl(var(--sui-base-hue) 16% 33%) !important; --sui-primary-accent-color-text: hsl(var(--sui-base-hue) 20% 38%) !important; --sui-primary-accent-color-translucent: hsl(var(--sui-base-hue) 14% 44% / 26%) !important; --sui-primary-accent-color-inverted: hsl(var(--sui-base-hue) 8% 100%) !important;`;
  const ACCENT_DARK = `--sui-primary-accent-color: hsl(var(--sui-base-hue) 13% 66%) !important; --sui-primary-accent-color-light: hsl(var(--sui-base-hue) 13% 73%) !important; --sui-primary-accent-color-dark: hsl(var(--sui-base-hue) 14% 57%) !important; --sui-primary-accent-color-text: hsl(var(--sui-base-hue) 18% 70%) !important; --sui-primary-accent-color-translucent: hsl(var(--sui-base-hue) 13% 64% / 30%) !important; --sui-primary-accent-color-inverted: hsl(var(--sui-base-hue) 12% 12%) !important;`;
  // Collapsible object-widget gates: OBJ_ANY = has a disclosure at all, OBJ_C = collapsed, OBJ_E = expanded. Gate on the widget's own disclosure (a summary node only exists when it computes non-empty); direct-child paths keep nested objects from matching their ancestors.
  const OBJ = 'section.field[data-field-type=object]';
  const OBJ_DISC = '> .field-wrapper > .wrapper > .header > div:first-child > button';
  const OBJ_ANY = `${OBJ}:has(${OBJ_DISC}[aria-expanded])`;
  const OBJ_C = `${OBJ}:has(${OBJ_DISC}[aria-expanded="false"])`;
  const OBJ_E = `${OBJ}:has(${OBJ_DISC}[aria-expanded="true"])`;
  // OPT = an optional object (required:false → Sveltia mounts an "Add …" checkbox at > .field-wrapper > .sui.checkbox, ALWAYS present): the deliberately class-heavy :has() argument out-specifies OBJ_C/OBJ_E (whose arguments carry :first-child + two attributes) so OPT rules win in the added states.
  const OPT = `${OBJ}:has(> .field-wrapper > .sui.checkbox .inner > button.sui.button[role=checkbox])`;
  const OPT_ON = `${OPT}:has(> .field-wrapper > .sui.checkbox .inner > button[role=checkbox][aria-checked="true"])`;
  const OPT_E = `${OPT}:has(${OBJ_DISC}[aria-expanded="true"])`;
  // GATED = an object whose first child field is the boolean `enabled` (the gate convention, mirrored in editor.js; the chrome-less og wrapper is excluded). Emitted collapsed:false so the children stay mounted, the switch exists in every state and the selector self-detects without a path list — and the two gestures are independent: the switch writes `enabled`, a card click toggles .stomme-open (editor.js) while Sveltia's own disclosure stays hidden, because collapsing it would unmount the switch.
  const KIDS = '> .field-wrapper > .wrapper > .item-list';
  const GATE_BOOL = `${KIDS} > section.field[data-field-type=boolean][data-key-path$=".enabled"]:first-child`;
  const GATED = `${OBJ}:not([data-key-path="og"]):has(${GATE_BOOL})`;
  // Chevron affordance shared by GATED + added-OPT cards (Material Symbols ships with Sveltia).
  const CHEVRON = `content:"expand_more"!important;font-family:"Material Symbols Outlined"!important;font-size:20px!important;line-height:1!important;flex:0 0 auto!important;opacity:.5!important;transform:rotate(-90deg)!important;transition:transform 160ms!important;`;
  // LINK = a link-shaped object (page select + url string children) — self-detecting, rendered chrome-less inline, children mounted via collapsed:false.
  const LINK = `${OBJ}:has(${KIDS} > section.field[data-field-type=select][data-key-path$=".page"]):has(${KIDS} > section.field[data-key-path$=".url"])`;
  // The centred 768px field column Sveltia uses — mirrored where we re-lay-out fields.
  const COL_PAD = 'max(16px, calc((100% - 768px) / 2))';
  // Card outer width (border-box) = the 768px column + 16px interior padding + 1px border per side, so a card's CHILD fields land on exactly the same column as top-level fields — one width for every card kind. It caps at min(CARD_W, 100% - 32px) so a narrow pane (preview open) fills the pane minus the 16px field padding, which is why top-level PLAIN fields need the inverse treatment (TOP_* below): their 768px column must shrink by the 34px card frame to keep landing on the card-child column at every pane width, not just wide ones.
  const CARD_W = '802px';
  const CARD_MAX = `min(${CARD_W}, 100% - 32px)`;
  // Top-level fields (not nested in a card/item): booleans align via padding because their own grid ignores the field-wrapper, lists keep the CARD_W wrapper, and object cards release header/wrapper to the card width with stronger rules of their own.
  const TOP = 'section.field:not(section.field section.field)';
  const TOP_PLAIN = `${TOP}:not([data-field-type=list]):not([data-field-type=boolean]):not([data-field-type=object])`;
  const TOP_LABELED = `${TOP}:not([data-field-type=boolean]):not([data-field-type=object])`;
  const THEME_CSS = `:root{
      --sui-base-hue: 220 !important; /* neutral default; per site: brand hue (raise accent saturation too) */
      --sui-font-family-default: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
      --sui-font-weight-normal: 400 !important;
      --sui-font-weight-bold: 650 !important;
      --sui-control-medium-border-radius: 6px !important;
      --sui-textbox-border-radius: 6px !important;
      --sui-button-medium-border-radius: 6px !important;
      --sui-checkbox-border-radius: 4px !important;
      --sui-textbox-font-size: 15px !important;
    }
    :root, :host, :root[data-theme=light], :host[data-theme=light] { ${RAMP_LIGHT} ${ACCENT_LIGHT} }
    :root[data-theme=dark], :host[data-theme=dark] { ${RAMP_DARK} ${ACCENT_DARK} }
    @media (prefers-color-scheme: dark) { :root:not([data-theme=light]), :host:not([data-theme=light]) { ${RAMP_DARK} ${ACCENT_DARK} } }
    /* List-item polish. Sveltia is light-DOM, so plain CSS reaches its internals; these target internal class names (not a public API — re-tune on a Sveltia upgrade). Section row = .item whose OWN header carries a .type pill (variable-type lists); the pill/card chrome stays scoped to those, the one-row + drag treatment applies to EVERY list item. */
    .type{background:hsl(150 44% 86%)!important;color:hsl(150 55% 24%)!important;border-radius:999px!important;padding:5px 13px!important;margin:0 4px!important;font-size:12px!important;font-weight:700!important;letter-spacing:.06em!important;text-transform:uppercase!important;line-height:1.5!important;white-space:nowrap!important;flex:0 0 auto!important;}
    .item:has(> .header .type){border:1px solid hsl(var(--sui-border-color-2-hsl))!important;border-radius:10px!important;margin-bottom:20px!important;overflow:hidden!important;background:hsl(var(--sui-background-color-1-hsl))!important;box-shadow:0 1px 3px hsl(var(--sui-base-hue) 8% 50% / 8%)!important;}
    .item:has(> .header .type):hover{border-color:hsl(var(--sui-border-color-1-hsl))!important;}
    .item:has(> .header .type) > .header{padding:14px 16px!important;background:hsl(var(--sui-background-color-2-hsl))!important;}
    /* Expanded section: a border separates the header bar from the fields below. Sveltia hard-sets height:29px on .header (box-sizing:border-box), which swallows the padding and squeezes the pill — force height:auto so the padding gives the pill real breathing room. */
    .item:has(> .header .type):has(> .header > div:first-child > button[aria-expanded="true"]) > .header{border-bottom:1px solid hsl(var(--sui-border-color-3-hsl))!important;height:auto!important;min-height:0!important;padding:16px!important;}
    /* Move Up/Down arrows are replaced by whole-item drag (stomme-editor.js) on EVERY list item: hide the header's middle control group and dock the ⋮/✕ group right (Sveltia gives each header group a fixed ~205px width). NB: the disclosure is \`> .header > div:first-child > button[aria-expanded]\` — the ⋮ menu button ALSO has aria-expanded (always false while closed), so any collapsed-state selector must use the first-group path, never a bare \`button[aria-expanded="false"]\`. */
    section[data-field-type=list] .item > .header > div:first-child{width:auto!important;flex:0 0 auto!important;}
    section[data-field-type=list] .item > .header > div:nth-child(2){display:none!important;}
    section[data-field-type=list] .item > .header > div:nth-child(3){width:auto!important;flex:0 0 auto!important;margin-left:auto!important;}
    /* COLLAPSED list item = one row (mockup): the item becomes a flex row, the header joins it via display:contents, and the summary — rendered by Sveltia inside .item-body ONLY while collapsed — is ordered between the disclosure and the ⋮/✕ controls. Styled in place, never moved, so Sveltia re-renders can't desync it. Gated on the disclosure state so EXPANDED items keep a normal header row (bug: this trick used to apply always). */
    section[data-field-type=list] .item:has(> .header > div:first-child > button[aria-expanded="false"]){display:flex!important;align-items:center!important;gap:10px!important;padding:9px 14px!important;cursor:pointer!important;user-select:none!important;}
    section[data-field-type=list] .item:has(> .header > div:first-child > button[aria-expanded="false"]) > .header{display:contents!important;}
    section[data-field-type=list] .item:has(> .header > div:first-child > button[aria-expanded="false"]) > .header > div:first-child{order:1!important;}
    section[data-field-type=list] .item:has(> .header > div:first-child > button[aria-expanded="false"]) > .item-body{order:2!important;flex:1 1 auto!important;min-width:0!important;overflow:hidden!important;}
    section[data-field-type=list] .item:has(> .header > div:first-child > button[aria-expanded="false"]) > .header > div:nth-child(3){order:3!important;}
    section[data-field-type=list] .item > .item-body > .summary{font-weight:600!important;padding:0!important;margin:0!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:ellipsis!important;}
    section[data-field-type=list] .item > .item-body > .summary *{display:inline!important;white-space:nowrap!important;}
    /* The whole-list collapse chevron on a list's toolbar is redundant chrome: every item below collapses individually and Expand/Collapse All does bulk. Hide it (the count + the bulk buttons stay). Its depth inside .toolbar.top varies by Sveltia version (a direct child beside .summary, or nested in a .label group), so match it anywhere in the toolbar — but the toolbar's Add button ALSO carries aria-expanded, so menu buttons must stay excluded or "Add" disappears with it. */
    section[data-field-type=list] > .field-wrapper > .sui.group > .inner > .toolbar.top button[aria-expanded]:not([aria-haspopup]){display:none!important;}
    /* Expanded list items WITHOUT a .type pill (fixed-type lists, e.g. cards) show Sveltia's default grey header bar with no label — a stray-looking strip. Blend it into the card (card bg, slim, just a divider) instead of leaving the raw grey default. */
    section[data-field-type=list] .item:not(:has(> .header .type)):has(> .header > div:first-child > button[aria-expanded="true"]) > .header{background:hsl(var(--sui-background-color-1-hsl))!important;height:auto!important;min-height:0!important;padding:10px 14px!important;border-bottom:1px solid hsl(var(--sui-border-color-3-hsl))!important;}
    /* Collapsible OBJECT groups (SEO + Media/Layout/Appearance) share the card language. Collapsed = one row [chevron][label][summary…][⋮] with the hint wrapping to a second line; expanded = label bar (chevron docked beside ⋮) with the fields below. Gated on the widget's own disclosure so plain inline objects are untouched. */
    /* Card geometry: every top-level card is CARD_W wide so its CHILD fields — 16px field padding, then each child's own 768px .field-wrapper cap — land exactly on the SAME centred 768px column as top-level fields (SEO title aligns with Title). The card's own inner .field-wrapper cap is released so children flow to the card width; nested cards sit in narrower parents where the cap is a no-op. Mirrors Sveltia's field-wrapper max-width — re-tune on a Sveltia upgrade. */
    ${OBJ_ANY}{border:1px solid hsl(var(--sui-border-color-2-hsl))!important;border-radius:10px!important;max-width:${CARD_MAX}!important;margin:14px auto!important;background:hsl(var(--sui-background-color-1-hsl))!important;overflow:hidden!important;}
    ${OBJ_ANY}:hover{border-color:hsl(var(--sui-border-color-1-hsl))!important;}
    ${OBJ_ANY} > .field-wrapper{max-width:none!important;}
    /* Sveltia caps a field's > header and > .footer at the same 768px column — inside an 802px card the header bar would stop 34px short of the right edge (a notch in the top-right corner). Release them to the card width. */
    ${OBJ_ANY} > header, ${OBJ_ANY} > .footer, ${OPT} > header, ${OPT} > .footer{max-width:none!important;}
    /* Section cards share the same geometry: the list's field column widens to CARD_W so each item card = CARD_W and the fields INSIDE items land on the 768px column too — one card width, one field column, everywhere. */
    section[data-field-type=list] > .field-wrapper{max-width:${CARD_W}!important;}
    /* Top-level plain fields join the card-child column at EVERY pane width: Sveltia's 768px caps (header/wrapper/footer, margin-inline auto) only line up with card children while the pane is wide enough to centre them — in a narrow pane (preview open) they fill and sit 17px outside the column. Shrinking the caps by the 34px card frame keeps inputs AND labels on the same edges as fields inside section/object cards; at wide widths min() returns 768px and nothing changes. */
    ${TOP_PLAIN} > .field-wrapper{max-width:min(768px, 100% - 34px)!important;}
    ${TOP_LABELED} > header, ${TOP_LABELED} > .footer{max-width:min(768px, 100% - 34px)!important;}
    /* Top-level booleans (e.g. Published) align via their padding instead — 33px floor = 16px pane inset + 17px card frame; the centred term takes over exactly when the plain-field min() does. */
    ${TOP}[data-field-type=boolean]{padding:16px max(33px, calc((100% - 768px) / 2))!important;}
    /* Nested object cards (inside a list item OR inside another object) keep a horizontal inset for breathing room; only top-level cards use the centred column. og.types is excluded: it is a chrome-less wrapper that must span its parent so the type cards inside align with the master-toggle card (its own margin rule below would otherwise lose this specificity fight). */
    section[data-field-type=list] .item ${OBJ}:has(${OBJ_DISC}[aria-expanded]), ${OBJ} ${OBJ}:not([data-key-path="og.types"]):has(${OBJ_DISC}[aria-expanded]){max-width:none!important;margin:14px 16px!important;}
    ${OBJ_ANY} > header .required{display:none!important;}
    ${OBJ_C}{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:10px!important;padding:9px 14px!important;cursor:pointer!important;user-select:none!important;}
    ${OBJ_C} > header{display:contents!important;}
    ${OBJ_C} > header h4{order:2!important;flex:0 0 auto!important;}
    ${OBJ_C} > header .sui.spacer{display:none!important;}
    ${OBJ_C} > header > button{order:4!important;}
    ${OBJ_C} > .field-wrapper{display:contents!important;}
    ${OBJ_C} > .field-wrapper > .wrapper{display:contents!important;}
    ${OBJ_C} > .field-wrapper > .wrapper > .header{display:contents!important;}
    ${OBJ_C} > .field-wrapper > .wrapper > .header > div:first-child{order:1!important;width:auto!important;flex:0 0 auto!important;}
    ${OBJ_C} > .field-wrapper > .wrapper > .header > div:nth-child(n+2){display:none!important;}
    ${OBJ_C} > .field-wrapper > .wrapper > .item-list{order:3!important;flex:1 1 auto!important;min-width:0!important;}
    ${OBJ_C} > .field-wrapper > .wrapper > .item-list > .summary{padding:0!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:ellipsis!important;opacity:.75!important;}
    ${OBJ_C} > .footer{order:5!important;flex:0 0 100%!important;margin:0!important;padding:0!important;}
    ${OBJ_E}{position:relative!important;padding:0!important;}
    ${OBJ_E} > header{margin:0!important;height:auto!important;min-height:0!important;padding:16px 16px 16px 48px!important;background:hsl(var(--sui-background-color-2-hsl))!important;border-bottom:1px solid hsl(var(--sui-border-color-3-hsl))!important;}
    ${OBJ_E} > .field-wrapper > .wrapper{border:none!important;background:transparent!important;}
    ${OBJ_E} > .field-wrapper > .wrapper > .header{position:absolute!important;top:14px!important;left:12px!important;background:transparent!important;}
    ${OBJ_E} > .field-wrapper > .wrapper > .header > div{width:auto!important;flex:0 0 auto!important;}
    ${OBJ_E} > .footer{margin:0!important;padding:8px 14px 10px!important;}
    /* BOOLEAN fields read as one row — [switch] label, hint under the label — instead of Sveltia's stacked label/switch/hint. The padding mirrors the centred 768px field column. */
    section.field[data-field-type=boolean]{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;column-gap:14px!important;align-items:center!important;padding:16px ${COL_PAD}!important;}
    section.field[data-field-type=boolean] > header{grid-column:2!important;grid-row:1!important;margin:0!important;padding:0!important;height:auto!important;min-height:0!important;max-width:none!important;}
    section.field[data-field-type=boolean] > .field-wrapper{grid-column:1!important;grid-row:1 / span 2!important;margin:0!important;width:auto!important;max-width:none!important;}
    section.field[data-field-type=boolean] > .footer{grid-column:2!important;grid-row:2!important;margin:2px 0 0!important;padding:0!important;max-width:none!important;}
    /* LINK-shaped objects (page + url) render chrome-less INLINE — a link belongs to its label; it is never an "Add …" step or a nested drawer. The two fields sit side by side where there is room. An object literally named "link" drops its redundant label; named ones ("Button link") keep it as a plain field label. */
    ${LINK}{display:block!important;position:static!important;border:none!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;max-width:none!important;margin:0!important;padding:0!important;overflow:visible!important;}
    section[data-field-type=list] .item ${LINK}, ${OBJ} ${LINK}{max-width:none!important;margin:0!important;}
    ${LINK} > header{display:flex!important;position:static!important;margin:0!important;height:auto!important;min-height:0!important;padding:16px ${COL_PAD} 0!important;background:transparent!important;border:none!important;}
    ${LINK}[data-key-path$=".link"] > header{display:none!important;}
    ${LINK} > .field-wrapper{display:block!important;margin:0!important;max-width:none!important;width:auto!important;}
    ${LINK} > .field-wrapper > .wrapper{display:block!important;border:none!important;background:transparent!important;}
    ${LINK} > .field-wrapper > .wrapper > .header{display:none!important;}
    ${LINK} > .field-wrapper > .wrapper > .item-list{display:grid!important;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr))!important;align-items:start!important;}
    ${LINK} > .field-wrapper > .wrapper > .item-list > section.field{border:none!important;}
    /* The Add-checkbox of optional objects renders as a SWITCH matching real boolean toggles. */
    ${OBJ} > .field-wrapper > .sui.checkbox .inner > button[role=checkbox]{width:42px!important;height:24px!important;min-width:42px!important;flex:0 0 auto!important;border-radius:999px!important;border:none!important;background:hsl(var(--sui-background-color-5-hsl))!important;position:relative!important;padding:0!important;transition:background 160ms!important;}
    ${OBJ} > .field-wrapper > .sui.checkbox .inner > button[role=checkbox] .icon{display:none!important;}
    ${OBJ} > .field-wrapper > .sui.checkbox .inner > button[role=checkbox]::after{content:""!important;position:absolute!important;top:3px!important;left:3px!important;width:18px!important;height:18px!important;border-radius:50%!important;background:#fff!important;box-shadow:0 1px 2px rgb(0 0 0 / 0.25)!important;transition:transform 160ms!important;}
    ${OBJ} > .field-wrapper > .sui.checkbox .inner > button[role=checkbox][aria-checked=true]{background:var(--sui-primary-accent-color)!important;}
    ${OBJ} > .field-wrapper > .sui.checkbox .inner > button[role=checkbox][aria-checked=true]::after{transform:translateX(18px)!important;}
    /* OPTIONAL groups (required:false objects — thanks buttons, header CTA, per-entry SEO): ONE header row [switch] label — the on/off switch IS the header, no separate "Add X" text row. The switch is pinned (absolute, same spot in unadded / on-collapsed / on-expanded states) so it NEVER moves when clicked. TWO independent gestures, same as GATED: the switch adds/removes the group (data); once ON, a card click drives Sveltia's own disclosure (editor.js) — collapsed by default (collapsed:true emitted), a chevron appears, fields below when open. Unadded, the row is inert apart from the switch. */
    ${OPT}{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:10px!important;position:relative!important;border:1px solid hsl(var(--sui-border-color-2-hsl))!important;border-radius:10px!important;max-width:${CARD_MAX}!important;margin:14px auto!important;background:hsl(var(--sui-background-color-1-hsl))!important;overflow:hidden!important;padding:12px 14px 12px 72px!important;min-height:48px!important;cursor:default!important;user-select:none!important;}
    ${OPT_ON}{cursor:pointer!important;}
    ${OPT_ON} > header::before{${CHEVRON}order:0!important;}
    /* rotation keyed on OPT_ON + the disclosure — a bare OPT_E loses the specificity fight against OPT_ON's checkbox :has() */
    ${OPT_ON}:has(${OBJ_DISC}[aria-expanded="true"]) > header::before{transform:none!important;}
    ${OPT}:hover{border-color:hsl(var(--sui-border-color-1-hsl))!important;}
    section[data-field-type=list] .item ${OPT}, ${OBJ} ${OPT}{max-width:none!important;margin:14px 16px!important;}
    ${OPT} > header{display:contents!important;}
    ${OPT} > header h4{order:1!important;flex:0 0 auto!important;}
    ${OPT} > header .sui.spacer{display:none!important;}
    ${OPT} > header .required{display:none!important;}
    ${OPT} > header > button{order:4!important;margin-left:auto!important;}
    ${OPT} > .field-wrapper{display:contents!important;}
    ${OPT} > .field-wrapper > .sui.checkbox{position:absolute!important;top:24px!important;left:16px!important;transform:translateY(-50%)!important;padding:0!important;margin:0!important;z-index:1!important;}
    ${OPT} > .field-wrapper > .sui.checkbox label{display:none!important;}
    ${OPT} > .field-wrapper > .wrapper{display:contents!important;}
    ${OPT} > .field-wrapper > .wrapper > .header{display:none!important;}
    ${OPT} > .field-wrapper > .wrapper > .item-list{order:2!important;flex:1 1 auto!important;min-width:0!important;}
    ${OPT} > .field-wrapper > .wrapper > .item-list > .summary{padding:0!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:ellipsis!important;opacity:.75!important;}
    ${OPT} > .footer{order:8!important;flex:0 0 100%!important;margin:0!important;padding:0!important;}
    ${OPT_E}{cursor:default!important;}
    ${OPT_E} > header{cursor:pointer!important;}
    ${OPT_E} > .field-wrapper > .wrapper > .item-list{order:9!important;flex:1 1 100%!important;min-width:0!important;margin:12px -14px -12px -72px!important;border-top:1px solid hsl(var(--sui-border-color-3-hsl))!important;}
    /* GATED groups (first child = the boolean \`enabled\`; e.g. share-card types, away mode): a switch-card with TWO independent gestures — the pinned switch toggles \`enabled\` (data, Sveltia's own click), a card click toggles .stomme-open (editor.js), a pure UI state that defaults to CLOSED. Closed = one row [switch] chevron label + hint; open = the row becomes a header bar with ALL config fields below. Open/closed is independent of enabled, so a disabled card can still be inspected. */
    ${GATED}{position:relative!important;user-select:none!important;}
    ${GATED} > header{display:flex!important;align-items:center!important;margin:0!important;height:auto!important;min-height:48px!important;padding:12px 16px 12px 72px!important;background:hsl(var(--sui-background-color-2-hsl))!important;border-bottom:1px solid hsl(var(--sui-border-color-3-hsl))!important;cursor:pointer!important;}
    ${GATED} > header::before{${CHEVRON}margin-right:10px!important;}
    ${GATED}.stomme-open > header::before{transform:none!important;}
    ${GATED} > .field-wrapper > .wrapper > .header{display:none!important;}
    ${GATED} ${GATE_BOOL}{display:block!important;position:absolute!important;top:24px!important;left:16px!important;transform:translateY(-50%)!important;width:42px!important;padding:0!important;margin:0!important;z-index:1!important;border:none!important;background:transparent!important;}
    ${GATED} ${GATE_BOOL} > header, ${GATED} ${GATE_BOOL} > .footer{display:none!important;}
    ${GATED} ${GATE_BOOL} > .field-wrapper{margin:0!important;width:auto!important;grid-column:auto!important;}
    /* closed (default): the row IS the card — plain background, no divider; the config fields are hidden (the pinned \`enabled\` switch stays); the group hint reads as the row's second line, aligned under the label. */
    ${GATED}:not(.stomme-open){cursor:pointer!important;}
    ${GATED}:not(.stomme-open) > header{background:hsl(var(--sui-background-color-1-hsl))!important;border-bottom:none!important;}
    ${GATED}:not(.stomme-open) ${KIDS} > section.field:not(:first-child){display:none!important;}
    ${GATED}:not(.stomme-open) > .footer{margin:0!important;padding:0 16px 12px 72px!important;}
    /* Share-cards flat wrappers: the og + og.types objects exist only for the data path (og.enabled, og.types.<key>) — render them CHROME-LESS (no card border/header/collapse) so the pane reads: master toggle → type cards (the approved mockup). Selectors reuse OBJ_ANY so they outrank the generic object-card rules above; both wrappers are emitted collapsed:false and stay expanded (no disclosure left to collapse them). */
    ${OBJ_ANY}:is([data-key-path="og"],[data-key-path="og.types"]){border:none!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;overflow:visible!important;padding:0!important;}
    ${OBJ_ANY}:is([data-key-path="og"],[data-key-path="og.types"]) > header{display:none!important;}
    ${OBJ_ANY}:is([data-key-path="og"],[data-key-path="og.types"]) > .field-wrapper > .wrapper > .header{display:none!important;}
    /* og.types keeps a quiet section label + hint (mockup "Per content type"): its header returns as a plain heading and the hint moves above the cards via flex order. */
    /* max-width:none is load-bearing: og.types must span its parent (og already carries the CARD_MAX cap) or the type cards fall 16px inside the master-toggle card. */
    ${OBJ_ANY}[data-key-path="og.types"]{display:flex!important;flex-direction:column!important;margin:14px 0!important;max-width:none!important;}
    /* Under flex, the field-wrapper's own margin-inline:auto would shrink it to fit-content — pin it full width. */
    ${OBJ_ANY}[data-key-path="og.types"] > .field-wrapper{width:100%!important;margin:0!important;max-width:none!important;}
    /* The wrapper spans CARD_W (cards overhang the 768px column by 17px each side), so a 17px inset lands the section label + hint on the same x as the field labels around it (labels sit at the column edge). */
    ${OBJ_ANY}[data-key-path="og.types"] > header{display:flex!important;order:-2!important;position:static!important;background:transparent!important;border:none!important;height:auto!important;min-height:0!important;padding:18px 17px 0!important;}
    ${OBJ_ANY}[data-key-path="og.types"] > header > button,${OBJ_ANY}[data-key-path="og.types"] > header .required{display:none!important;}
    ${OBJ_ANY}[data-key-path="og.types"] > .footer{order:-1!important;margin:0!important;padding:2px 17px 0!important;}
    /* Type cards fill the settings column (they'd otherwise take the nested 16px inset). */
    ${OBJ_ANY}[data-key-path="og.types"] > .field-wrapper > .wrapper > .item-list > ${OBJ_ANY}{max-width:none!important;margin:14px 0!important;}
    /* Type-card labels read as the editor's green type pills (mockup language). */
    ${OBJ}[data-key-path^="og.types."][data-field-type=object] > header h4{background:hsl(150 44% 86%)!important;color:hsl(150 55% 24%)!important;border-radius:999px!important;padding:4px 12px!important;font-size:12px!important;font-weight:700!important;letter-spacing:.06em!important;text-transform:uppercase!important;line-height:1.5!important;flex:0 0 auto!important;}
    /* The master toggle as a prominent card: [switch] [label + hint] on one row. */
    section.field[data-key-path="og.enabled"]{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;column-gap:14px!important;align-items:center!important;border:1px solid hsl(var(--sui-border-color-2-hsl))!important;border-radius:10px!important;background:hsl(var(--sui-background-color-1-hsl))!important;box-shadow:0 1px 3px hsl(var(--sui-base-hue) 8% 50% / 8%)!important;padding:14px 16px!important;margin:14px 0!important;}
    section.field[data-key-path="og.enabled"] > header{grid-column:2!important;grid-row:1!important;margin:0!important;padding:0!important;height:auto!important;min-height:0!important;}
    section.field[data-key-path="og.enabled"] > .field-wrapper{grid-column:1!important;grid-row:1 / span 2!important;}
    section.field[data-key-path="og.enabled"] > .footer{grid-column:2!important;grid-row:2!important;margin:0!important;padding:0!important;}
    /* Drag feedback (stomme-editor.js drives Sveltia's own move-up/down on drop). */
    .item.stomme-dragging{opacity:.4!important;}
    .item.stomme-drop-before{box-shadow:0 -3px 0 -1px var(--sui-primary-accent-color)!important;}
    .item.stomme-drop-after{box-shadow:0 3px 0 -1px var(--sui-primary-accent-color)!important;}
    /* FAQ tag suggestions (stomme-editor.js): existing tags as click-to-add chips. */
    .stomme-tag-chips{display:flex;flex-wrap:wrap;gap:8px;width:100%;justify-content:flex-start;padding:10px 0 4px;}
    .stomme-tag-chip{appearance:none;border:1px dashed hsl(var(--sui-border-color-1-hsl));border-radius:999px;background:hsl(var(--sui-background-color-2-hsl));color:var(--sui-secondary-foreground-color);font:inherit;font-size:12px;line-height:1;padding:7px 12px;cursor:pointer;transition:background 120ms,color 120ms,border-color 120ms;}
    .stomme-tag-chip:hover{background:var(--sui-primary-accent-color-translucent);border-color:var(--sui-primary-accent-color);color:var(--sui-primary-accent-color-text);border-style:solid;}`;
  const T_START = '<!-- >>> stomme-theme:generated (managed by stomme-gen — do not edit) -->';
  const T_END = '<!-- <<< stomme-theme:generated -->';
  // External, content-hashed stylesheet: an inline <style> in index.html is not cache-busted, so a plain reload keeps serving stale theme CSS.
  let th = 0; for (let i = 0; i < THEME_CSS.length; i++) th = (th * 31 + THEME_CSS.charCodeAt(i)) | 0;
  try { writeFileSync(resolve(root, 'public/admin/stomme-theme.css'), THEME_CSS); }
  catch (e) { console.warn('  (stomme-theme.css skipped:', e.message + ')'); }
  const themeRegion = `${T_START}\n    <link rel="stylesheet" href="/admin/stomme-theme.css?v=${(th >>> 0).toString(36)}">\n    ${T_END}`;
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

// The site stylesheet with the library @import inlined, so the CMS preview mockups reflect the site theme — tokens and any class overrides the site adds. previews.js loads it as registerPreviewStyle('/admin/stomme-site.css'), and it only refreshes on cms:gen.
try {
  const libCss = readFileSync(resolve(here, '../styles.css'), 'utf8');
  // The engine stylesheet is inlined because the raw import (scoped or bare) cannot resolve in the browser and 404s under /admin/; its body layout rules (flex column + full height, for the sticky footer) would shift the inline preview panes, so they are neutralized right after the inlined block.
  const PREVIEW_BODY_RESET = '\n/* admin preview: undo the sticky-footer body layout */\nbody{display:block;min-height:auto}\n';
  // A style's tokens.css + theme.css are inlined after the engine CSS and before the site's own rules — the same cascade position as the live build — so the preview mockups are truthful. `astro build` throws on a genuinely missing theme, so a warning is enough here.
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
  // theme.md tokens → :root so the INLINE preview mockups use the site's actual colours instead of the build-time defaults baked into styles.css (iframe previews already load the real themed page). Mirrors Base.astro's themeVars.
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

// Engine-managed art, overwritten each run: a site that wants its own sets a block's image field instead of editing these files.
try {
  const imgSrc = resolve(here, '../assets/images');
  if (existsSync(imgSrc)) cpSync(imgSrc, resolve(root, 'public/images'), { recursive: true });
} catch (e) {
  console.warn('  (default images skipped:', e.message + ')');
}

try {
  const t = (s) => (FORWARD && FORWARD[s] !== undefined ? FORWARD[s] : s);
  const html = renderGallery(AVAILABLE_BLOCKS, { t, groupOrder: GROUP_ORDER, locale: CMS_LOCALE });
  writeFileSync(resolve(root, 'public/admin/blocks.html'), html);
} catch (e) {
  console.warn('  (blocks.html skipped:', e.message + ')');
}


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

// Derived from the ENGINE's own schema, not the site's, so it is only regenerated when running against the engine SOURCE — a monorepo build with the engine linked. In a real node_modules install the shipped manifest is authoritative and read-only. gen-schema-manifest writes relative to its own dir, always the engine package.
if (!here.includes('node_modules')) {
  try {
    const { generate } = await import('./gen-schema-manifest.mjs');
    const m = await generate();
    console.log(`  ↳ schema-manifest.json refreshed (${Object.keys(m.collections).length} collections)`);
  } catch (e) {
    console.warn('  (schema-manifest refresh skipped:', e.message + ')');
  }
  try {
    const { generate } = await import('./gen-blocks-manifest.mjs');
    const m = await generate();
    console.log(`  ↳ blocks-manifest.json refreshed (${Object.keys(m.blocks).length} block types)`);
  } catch (e) {
    console.warn('  (blocks-manifest refresh skipped:', e.message + ')');
  }
}

// Per-site CUSTOM-DELTA manifest: the same filename as the engine's own blocks-manifest.json, but holding only the SITE's custom subset — types it adds or SHADOWS — projected through the same blocksToManifest contract, so a reader can merge it over the engine manifest and validate custom blocks field-by-field instead of reporting them as unknown. Unguarded on purpose, unlike the engine-manifest refresh above: this must run wherever stomme is INSTALLED IN A SITE (cwd = site root, BLOCKS = the site's catalog).
try {
  const { blocksToManifest } = await import('./gen-blocks-manifest.mjs');
  const { defaultBlocks } = await jiti.import('@gronare/stomme/catalog');
  const engineManifest = blocksToManifest(defaultBlocks).blocks;
  const engineTypes = new Set(defaultBlocks.map((d) => d.type));
  // Custom = a type absent from the engine, OR a same-type SHADOW whose field projection differs (an extra field, a widened option set).
  const delta = BLOCKS.filter((b) => {
    if (!engineTypes.has(b.type)) return true;
    return JSON.stringify(blocksToManifest([b]).blocks[b.type]) !== JSON.stringify(engineManifest[b.type]);
  });
  const manifest = blocksToManifest(delta);
  const outPath = resolve(root, 'public/admin/blocks-manifest.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
  const names = Object.keys(manifest.blocks);
  console.log(`  ↳ custom blocks-manifest.json: ${names.length ? names.join(', ') : '(none — engine defaults only)'}`);
} catch (e) {
  console.warn('  (custom blocks-manifest skipped:', e.message + ')');
  // Never leave a STALE delta from a previous build: this file is merged site-wins over the engine manifest, so a leftover entry could MASK a real change on a block the site no longer shadows — writing nothing at all merely loses the site-specific detail.
  try {
    const outPath = resolve(root, 'public/admin/blocks-manifest.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify({ blocks: {} }, null, 2) + '\n');
  } catch {}
}

console.log(`✓ stomme-gen: ${Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(', ')} · ${AVAILABLE_BLOCKS.length} block types · ${PAGE_OPTIONS.length} link options`);
if (counts.collections) {
  const editors = generatedEditors();
  console.log(`  ↳ collection editors: ${editors.length ? editors.join(', ') : '(none present)'}`);
  const kept = [...STATIC_COLLECTIONS].filter((n) => COLLECTION_EDITORS[n] && collectionEnabled(n));
  if (kept.length) console.log(`  ↳ hand-authored panes kept (outside markers): ${kept.join(', ')}`);
  if (ADDON_PANES.length) console.log(`  ↳ addon panes: ${ADDON_PANES.map((e) => e.feature).join(', ')}`);
}
if (SKIPPED_BLOCKS.length) {
  console.log(`  ↳ ${SKIPPED_BLOCKS.length} block(s) skipped — collection absent: ${SKIPPED_BLOCKS.map((b) => `${b.type}→${b.collection}`).join(', ')}`);
}
