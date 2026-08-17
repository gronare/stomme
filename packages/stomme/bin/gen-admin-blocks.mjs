#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, copyFileSync, cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeSettingsPane } from '../src/settings-pane.mjs';
import { makeCollectionEditors } from '../src/collection-editors.mjs';
import { writeAdminShell } from '../src/admin-shell.mjs';
import { makeEmitters } from '../src/emit-fields.mjs';
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

const { listSummary, emitField, emitFlow, emitWidget, navLinkField, emitFooterLinks, emitNavLinks, buttonField, emitThanksButtons } = makeEmitters({ q, pad, AVAILABLE_BLOCKS, OPTION_SOURCES });

const { COLLECTION_EDITORS, listingEditor } = makeCollectionEditors({ q, emitField, emitWidget, buttonField });

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

const { generatedEditors, emitCollections, emitCms, emitSettings, emitTrackingPane } = makeSettingsPane({ q, pad, emitWidget, emitNavLinks, emitFooterLinks, emitThanksButtons, COLLECTION_EDITORS, listingEditor, collectionEnabled, FEATURES, LISTINGS, CMS, ADDON_PANES, ADDON_PANEL_FILES, getStaticCollections: () => STATIC_COLLECTIONS });

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

writeAdminShell({ root, here, SVELTIA_CMS_SRC });

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
