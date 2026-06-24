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
import { readFileSync, writeFileSync, readdirSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { renderGallery } from '../admin/blocks-gallery.mjs';

const root = process.cwd();
const here = dirname(fileURLToPath(import.meta.url));

// Load the site's TS config/catalog through jiti rather than a bare dynamic import.
// Node's built-in type-stripping refuses any .ts file under node_modules, so a plain
// import of schema.ts / site.config.ts breaks the moment their import graph reaches the
// installed package's .ts (e.g. '@gronare/stomme/kit', './catalog') — which is exactly
// where a real registry install lives. jiti transpiles .ts everywhere, including
// node_modules, and resolves each module's bare specifiers from its own location.
const jiti = createJiti(import.meta.url);
const schemaPath = resolve(root, process.env.BLOCKKIT_SCHEMA || 'src/blocks/schema.ts');
const configPath = resolve(root, process.env.BLOCKKIT_CONFIG || 'public/admin/config.yml');

// The site's catalog. Loaded via jiti so its bare '@gronare/stomme/kit' import resolves
// against the consumer's node_modules and transpiles cleanly even when installed there.
const { BLOCKS } = await jiti.import(schemaPath);
if (!Array.isArray(BLOCKS)) {
  console.error(`No BLOCKS export found in ${schemaPath}`);
  process.exit(1);
}

// Collection→route map from the site's own config (no longer hardcoded). The site
// exports `kit` (a KitConfig) from src/site.config.ts; Node strips its TS types.
// Falls back to the package defaults when absent.
let ROUTES = { services: '/services', towns: '/areas', blog: '/blog' };
let FEATURES = null; // null = no `features` declared → fall back to folder-existence
let CMS_LOCALE = 'en'; // Decap admin UI language (config.yml `locale:`); 'en' is Decap's default
try {
  const mod = await jiti.import(resolve(root, 'src/site.config.ts'));
  if (mod.kit && mod.kit.routes) ROUTES = { ...ROUTES, ...mod.kit.routes };
  if (mod.kit && mod.kit.cmsLocale) CMS_LOCALE = mod.kit.cmsLocale;
  if (mod.features) FEATURES = { blog: false, areas: false, services: false, testimonials: false, faq: false, ...mod.features };
} catch {
  /* no site.config — use defaults */
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
  const opts = [{ label: 'Startsida (/)', value: '/' }];
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

const OPTION_SOURCES = { '$pages': PAGE_OPTIONS, '$services': SERVICE_OPTIONS };

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
const AVAILABLE_BLOCKS = BLOCKS.filter((b) => !b.collection || collectionEnabled(b.collection));
const SKIPPED_BLOCKS = BLOCKS.filter((b) => b.collection && !collectionEnabled(b.collection));

// Cluster the "add section" picker (and the gallery) by group. Sort is stable, so blocks
// keep their catalog order within a group; unknown/missing groups fall to the end.
const GROUP_ORDER = ['Hero & headers', 'Text', 'Cards & lists', 'Media', 'Quote & highlight', 'Numbers', 'From collections', 'Calls to action', 'Automatic'];
const groupRank = (b) => { const i = GROUP_ORDER.indexOf(b.group); return i === -1 ? GROUP_ORDER.length : i; };
AVAILABLE_BLOCKS.sort((a, b) => groupRank(a) - groupRank(b));

// Emit a single field. Leaf widgets use flow style; list/object widgets expand.
function emitField(f, indent) {
  const p = pad(indent);
  const parts = [`name: ${f.name}`, `label: ${q(f.label)}`, `widget: ${f.widget}`];
  if (f.required === false) parts.push('required: false');
  if (f.default !== undefined) parts.push(`default: ${typeof f.default === 'string' ? q(f.default) : f.default}`);
  if (f.hint) parts.push(`hint: ${q(f.hint)}`);
  if (f.media_folder) parts.push(`media_folder: ${q(f.media_folder)}`);
  if (f.public_folder) parts.push(`public_folder: ${q(f.public_folder)}`);

  if (f.widget === 'list' && f.fields) {
    return [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: list`,
      ...(f.required === false ? [`${p}  required: false`] : []),
      `${p}  fields:`, ...f.fields.map((sf) => emitField(sf, indent + 4))].join('\n');
  }
  if (f.widget === 'list' && f.field) {
    return [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: list`,
      ...(f.required === false ? [`${p}  required: false`] : []),
      `${p}  field: ${emitFlow(f.field)}`].join('\n');
  }
  if (f.widget === 'object' && f.fields) {
    const head = [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: object`];
    if (f.required === false) head.push(`${p}  required: false`);
    if (f.hint) head.push(`${p}  hint: ${q(f.hint)}`);
    head.push(`${p}  fields:`);
    return [...head, ...f.fields.map((sf) => emitField(sf, indent + 4))].join('\n');
  }
  if (f.widget === 'select') {
    const opts = typeof f.options === 'string' ? OPTION_SOURCES[f.options] ?? [] : Array.isArray(f.options) ? f.options : [];
    const out = [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: select`];
    if (f.multiple) out.push(`${p}  multiple: true`);
    if (f.required === false) out.push(`${p}  required: false`);
    if (f.default !== undefined) out.push(`${p}  default: ${q(f.default)}`);
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

// ── Collection editors ──────────────────────────────────────────────────────
// Decap editor sections for the conventional content collections. Emitted (gated
// by collectionExists) into the `# >>> collections:generated` region so the CMS
// sidebar gains an editor for whatever collections a site actually has — no more
// hand-authoring them per site. A site with bespoke collections adds its own
// editors outside the markers. Field shapes mirror the recommended content.config
// schemas (towns/services match the TownPage/ServicePage templates).
// No field-level media_folder — Decap resolves it relative to the entry (breaks
// uploads from subfolder entries); the global media_folder in config.yml is used.
const IMG = '{ name: image, label: "Image", widget: image, required: false }';
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
    - { name: order, label: "Order", widget: number, required: false, default: 0 }`,
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
    - { name: order, label: "Order", widget: number, required: false, default: 0 }
    - { name: heroSubtitle, label: "Hero subtitle", widget: text, required: false }
    - { name: heroNote, label: "Hero note", widget: string, required: false }
    - { name: why, label: "Why us here (paragraphs)", widget: text, required: false }
    - name: problems
      label: "Problems we solve"
      widget: list
      required: false
      field: { name: item, label: "Problem", widget: string }
    - name: districts
      label: "Districts / areas"
      widget: list
      required: false
      field: { name: item, label: "District", widget: string }
    - { name: localCase, label: "Local case", widget: text, required: false }
    - name: services
      label: "Services offered here"
      widget: list
      required: false
      field: { name: item, label: "Service", widget: string }
    - ${IMG}
    - { name: imageAlt, label: "Image alt text", widget: string, required: false }
    - name: seo
      label: "SEO"
      widget: object
      fields:
        - { name: title, label: "Title", widget: string }
        - { name: description, label: "Description", widget: text }`,
  posts: `- name: posts
  label: "Blog posts"
  label_singular: "Post"
  folder: "src/content/posts"
  create: true
  slug: "{{slug}}"
  fields:
    - { name: title, label: "Title", widget: string }
    - { name: date, label: "Date", widget: datetime, date_format: "YYYY-MM-DD", time_format: false }
    - { name: excerpt, label: "Excerpt", widget: text, required: false }
    - { name: cover, label: "Cover image", widget: image, required: false }
    - { name: body, label: "Body", widget: markdown }`,
  services: `- name: services
  label: "Services"
  label_singular: "Service"
  folder: "src/content/services"
  create: true
  slug: "{{slug}}"
  fields:
    - { name: title, label: "Title (H1)", widget: string }
    - { name: navLabel, label: "Short label (menus/cards)", widget: string }
    - { name: summary, label: "Summary", widget: text, required: false }
    - { name: order, label: "Order", widget: number, required: false, default: 0 }
    - name: bullets
      label: "Bullets"
      widget: list
      required: false
      field: { name: item, label: "Bullet", widget: string }
    - ${IMG}
    - { name: imageAlt, label: "Image alt text", widget: string, required: false }
    - name: seo
      label: "SEO"
      widget: object
      fields:
        - { name: title, label: "Title", widget: string }
        - { name: description, label: "Description", widget: text }
    - { name: body, label: "Body", widget: markdown }`,
};

// Emit editor sections for whichever conventional collections the site has.
function emitCollections(indent) {
  const p = pad(indent);
  const present = Object.keys(COLLECTION_EDITORS).filter(collectionEnabled);
  return present.map((name) => COLLECTION_EDITORS[name].split('\n').map((l) => (l ? p + l : l)).join('\n')).join('\n');
}

const EMITTERS = { blocks: emitWidget, collections: emitCollections };

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

// Set Decap's admin UI language from the site's cmsLocale (top-level config.yml `locale:`).
// Upsert keeps it idempotent: replace the line if present, else prepend it.
let yaml = out.join('\n');
const localeLine = `locale: ${CMS_LOCALE}`;
yaml = /^locale:.*$/m.test(yaml) ? yaml.replace(/^locale:.*$/m, localeLine) : `${localeLine}\n${yaml}`;
yaml = translateLabels(yaml);
writeFileSync(configPath, yaml);

// Ship the engine's generic preview templates into the site's admin so live page
// previews + readable settings previews work out of the box (loaded before the
// site's own previews.js). Regenerated each run, so engine updates flow through.
try {
  const previewsDest = resolve(root, 'public/admin/stomme-previews.js');
  mkdirSync(dirname(previewsDest), { recursive: true });
  copyFileSync(resolve(here, '../admin/previews.js'), previewsDest);
} catch (e) {
  console.warn('  (stomme-previews.js copy skipped:', e.message + ')');
}

// Resolve the site's stylesheet (inline the library @import) into the admin so the
// CMS preview mockups reflect the site theme — tokens AND any class overrides the
// site adds. previews.js loads it via registerPreviewStyle('/admin/stomme-site.css').
// Re-run cms:gen after editing global.css to refresh it.
try {
  const libCss = readFileSync(resolve(here, '../styles.css'), 'utf8');
  const siteCss = readFileSync(resolve(root, 'src/styles/global.css'), 'utf8').replace(/@import\s+["']stomme\/styles\.css["'];?/, libCss);
  writeFileSync(resolve(root, 'public/admin/stomme-site.css'), siteCss);
} catch (e) {
  console.warn('  (stomme-site.css skipped:', e.message + ')');
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

// When blog is enabled, seed an editable index page at the blog route — once, only if
// absent, never overwriting edits. It's a normal managed page (pageHeader + postList), so
// the blog has a default index that's composed of blocks and editable in the CMS rather
// than a fixed template. Delete it to opt out (or turn the feature off).
try {
  if (collectionEnabled('posts')) {
    const slug = (ROUTES.blog || '/blog').replace(/^\/+/, '') || 'blog';
    const pagePath = resolve(root, 'src/content/pages', `${slug}.md`);
    if (!existsSync(pagePath)) {
      mkdirSync(dirname(pagePath), { recursive: true });
      writeFileSync(
        pagePath,
        '---\ntitle: "Blog"\nseo:\n  title: "Blog"\n  description: "Latest posts, guides and updates."\nblocks:\n  - type: pageHeader\n    eyebrow: Blog\n    heading: Blog\n    intro: "Latest posts, guides and updates."\n  - type: postList\n    featured: true\n    showImages: true\n    columns: 3\n---\n',
      );
      console.log(`  ↳ seeded editable blog index: src/content/pages/${slug}.md`);
    }
  }
} catch (e) {
  console.warn('  (blog index seed skipped:', e.message + ')');
}

console.log(`✓ stomme-gen: ${Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(', ')} · ${AVAILABLE_BLOCKS.length} block types · ${PAGE_OPTIONS.length} link options`);
if (counts.collections) {
  const editors = Object.keys(COLLECTION_EDITORS).filter(collectionEnabled);
  console.log(`  ↳ collection editors: ${editors.length ? editors.join(', ') : '(none present)'}`);
}
if (SKIPPED_BLOCKS.length) {
  console.log(`  ↳ ${SKIPPED_BLOCKS.length} block(s) skipped — collection absent: ${SKIPPED_BLOCKS.map((b) => `${b.type}→${b.collection}`).join(', ')}`);
}
