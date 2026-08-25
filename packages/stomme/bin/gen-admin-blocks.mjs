#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, copyFileSync, cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadAddonCms } from '../src/addon-cms.mjs';
import { buildOptionSources } from '../src/option-sources.mjs';
import { makeSettingsPane } from '../src/settings-pane.mjs';
import { makeCollectionEditors } from '../src/collection-editors.mjs';
import { writeAdminShell } from '../src/admin-shell.mjs';
import { makeEmitters } from '../src/emit-fields.mjs';
import { createJiti } from 'jiti';
import { renderGallery } from '../admin/blocks-gallery.mjs';
import { rewriteLabels, listingAliases } from '../src/label-paths.mjs';
import { r2LibraryYaml, resolveMediaConfig, withMaxFileSize } from '../src/media-config.mjs';

const root = process.cwd();
const here = dirname(fileURLToPath(import.meta.url));

// Pinned CMS bundle, swapped into each site's public/admin/index.html on build: bump deliberately — Sveltia is pre-1.0 and the editor is coupled to its DOM. STOMME_SVELTIA_SRC points at a local/vendored copy instead.
const SVELTIA_CMS_SRC = process.env.STOMME_SVELTIA_SRC || 'https://unpkg.com/@sveltia/cms@0.197.2/dist/sveltia-cms.js';

// Loaded through jiti rather than a bare dynamic import: Node's own type-stripping refuses any .ts file under node_modules, so importing schema.ts / site.config.ts breaks the moment its import graph reaches the installed package's .ts ('@gronare/stomme/kit', './catalog') — which is exactly what a registry install is. jiti transpiles .ts everywhere and resolves each module's bare specifiers from its own location.
const jiti = createJiti(import.meta.url);
const schemaPath = resolve(root, process.env.STOMME_SCHEMA || 'src/blocks/schema.ts');
const configPath = resolve(root, process.env.STOMME_CONFIG || 'public/admin/config.yml');

if (!existsSync(configPath)) {
  console.log(`stomme-gen: no ${process.env.STOMME_CONFIG || 'public/admin/config.yml'} — CMS-less site, nothing to generate`);
  process.exit(0);
}

const { BLOCKS: SITE_BLOCKS } = await jiti.import(schemaPath);
if (!Array.isArray(SITE_BLOCKS)) {
  console.error(`No BLOCKS export found in ${schemaPath}`);
  process.exit(1);
}

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
let FEATURES = null;
let CMS_LOCALE = 'en';
let CMS = null;
let LISTINGS = [];
let STYLE = process.env.STOMME_STYLE || null;
let MEDIA = resolveMediaConfig(null);
try {
  const mod = await jiti.import(resolve(root, 'src/site.config.ts'));
  if (mod.site && mod.site.routes) ROUTES = { ...ROUTES, ...mod.site.routes };
  if (mod.site && mod.site.cmsLocale) CMS_LOCALE = mod.site.cmsLocale;
  if (mod.site && mod.site.cms) CMS = mod.site.cms;
  if (mod.site && mod.site.style) STYLE = mod.site.style;
  if (mod.site && mod.site.media) MEDIA = resolveMediaConfig(mod.site.media);
  if (mod.features) FEATURES = { blog: false, areas: false, services: false, testimonials: false, faq: false, tracking: false, ...mod.features };
  if (Array.isArray(mod.listings))
    LISTINGS = mod.listings
      .filter((x) => x && x.id && x.route && (x.preset === 'article' || x.preset === 'catalog'))
      .map((x) => ({ ...x, route: x.route.startsWith('/') ? x.route : `/${x.route}` }));
} catch {
}
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

let LOCALIZED_BY_PATH = null;
let LOCALIZED_BY_TEXT = null;
const REVERSE_ALL = {};
try {
  const adminDir = new URL('../admin/', import.meta.url);
  for (const f of readdirSync(adminDir)) {
    const mm = f.match(/^labels\.([\w-]+)\.js$/);
    if (!mm) continue;
    const byPath = {};
    const byText = {};
    for (const [path, entry] of Object.entries((await import(new URL(f, adminDir))).default)) {
      const [en, loc] = Array.isArray(entry) ? entry : [null, entry];
      byPath[path] = loc;
      if (en !== null) { byText[en] = loc; REVERSE_ALL[loc] = en; }
    }
    if (mm[1] === CMS_LOCALE) { LOCALIZED_BY_PATH = byPath; LOCALIZED_BY_TEXT = byText; }
  }
} catch {
}
const localized = (path, en) => (LOCALIZED_BY_PATH ? LOCALIZED_BY_PATH[path] ?? LOCALIZED_BY_TEXT[en] ?? en : en);

const MARKER_START = /# >>> (\w+):generated/;
const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const pad = (n) => ' '.repeat(n);

const { PAGE_OPTIONS, FAQ_TAG_OPTIONS, OPTION_SOURCES, collectionEnabled, AVAILABLE_BLOCKS, SKIPPED_BLOCKS, GROUP_ORDER } = buildOptionSources({ root, ROUTES, FEATURES, LISTINGS, BLOCKS });

const { listSummary, emitField, emitFlow, emitWidget, navLinkField, emitFooterLinks, emitNavLinks, buttonField, emitThanksButtons } = makeEmitters({ q, pad, AVAILABLE_BLOCKS, OPTION_SOURCES });

const { COLLECTION_EDITORS, listingEditor } = makeCollectionEditors({ q, emitField, emitWidget, buttonField });

const { ADDON_PANES, ADDON_PANEL_FILES } = await loadAddonCms({ slotsDir: process.env.STOMME_SLOTS_DIR, ROUTES, FEATURES, emitWidget, emitField, buttonField, navLinkField });

const { generatedEditors, emitCollections, emitCms, emitSettings, emitTrackingPane } = makeSettingsPane({ q, pad, emitWidget, emitNavLinks, emitFooterLinks, emitThanksButtons, COLLECTION_EDITORS, listingEditor, collectionEnabled, FEATURES, LISTINGS, CMS, ADDON_PANES, ADDON_PANEL_FILES, getStaticCollections: () => STATIC_COLLECTIONS });

const EMITTERS = { blocks: emitWidget, collections: emitCollections, navlinks: emitNavLinks, thanksbuttons: emitThanksButtons, footerlinks: emitFooterLinks, settings: emitSettings, cms: emitCms, tracking: emitTrackingPane };

const lines = readFileSync(configPath, 'utf8').split('\n');
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
const LABEL_ALIASES = listingAliases(LISTINGS);
function translateLabels(text) {
  return rewriteLabels(text, (path, current) => localized(path, REVERSE_ALL[current] ?? current), { aliases: LABEL_ALIASES });
}

let yaml = out.join('\n');
yaml = yaml.replace(/^locale:.*$\n?/m, '');
yaml = yaml.replace(/^local_backend:.*$\n?/m, '');
yaml = yaml.replace(/^media_folder: .*$/m, 'media_folder: "/public/media"');
yaml = yaml.replace(/^public_folder: .*$/m, 'public_folder: "/media"');
const mSlug = (dir) => ({ m: `/public/media/${dir}/{{slug}}`, p: `/media/${dir}/{{slug}}` });
const mFlat = (dir) => ({ m: `/public/media/${dir}`, p: `/media/${dir}` });
const COLLECTION_MEDIA = {
  home: mFlat('home'), pages: mSlug('pages'), towns: mSlug('towns'), services: mSlug('services'),
  faq: mFlat('faq'), testimonials: mFlat('testimonials'), settings: mFlat('settings'),
};
for (const l of LISTINGS) COLLECTION_MEDIA[l.id] = l.preset === 'catalog' ? mSlug(l.id) : mFlat(l.id);
{
  const srcLines = yaml.split('\n');
  const injected = [];
  for (let i = 0; i < srcLines.length; i++) {
    injected.push(srcLines[i]);
    const cm = srcLines[i].match(/^ {2}- name: (\S+)\s*$/);
    if (cm && COLLECTION_MEDIA[cm[1]] && !/^ {4}media_folder:/.test(srcLines[i + 1] || '')) {
      injected.push(`    media_folder: ${JSON.stringify(COLLECTION_MEDIA[cm[1]].m)}`);
      injected.push(`    public_folder: ${JSON.stringify(COLLECTION_MEDIA[cm[1]].p)}`);
    }
  }
  yaml = injected.join('\n');
}
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
      if (k === null || k === 'fields') break;
      if (k === 'widget' && /widget: object\s*$/.test(srcLines[j])) widgetAt = j;
      if (k === 'collapsed') hasCollapsed = true;
    }
    if (widgetAt !== -1 && !hasCollapsed) srcLines.splice(widgetAt + 1, 0, `${' '.repeat(propIndent)}collapsed: true`);
  }
  yaml = srcLines.join('\n');
}
if (!/^media_libraries:/m.test(yaml)) {
  yaml = yaml.replace(/^public_folder: .*$/m, (l) =>
    `${l}\nmedia_libraries:\n  all:\n    slugify_filename: true\n    transformations:\n` +
    `      raster_image: { format: webp, quality: 82, width: 2048, height: 2048 }\n` +
    `      svg: { optimize: true }`);
}
if (!/^  cloudflare_r2:/m.test(yaml)) yaml = yaml.replace(/^media_libraries:\n/m, (l) => l + r2LibraryYaml(MEDIA));
yaml = withMaxFileSize(yaml, MEDIA);
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

class AnchorMissing extends Error {}
const substitute = (src, re, replacement, what) => {
  if (!re.test(src)) throw new AnchorMissing(`stomme-gen: ${what} — the declaration this rewrites is gone or renamed (${re})`);
  return src.replace(re, replacement);
};

try {
  const previewsDest = resolve(root, 'public/admin/stomme-previews.js');
  mkdirSync(dirname(previewsDest), { recursive: true });
  let previewsSrc = readFileSync(resolve(here, '../admin/previews.js'), 'utf8');
  const LOGIN_LABELS = { en: 'Log in', sv: 'Logga in', da: 'Log ind', nb_no: 'Logg inn', nb: 'Logg inn', nn: 'Logg inn', de: 'Anmelden', fr: 'Se connecter', es: 'Iniciar sesión', it: 'Accedi', nl: 'Inloggen', pt: 'Entrar', fi: 'Kirjaudu sisään' };
  const loginLabel = LOGIN_LABELS[CMS_LOCALE] || LOGIN_LABELS[String(CMS_LOCALE).split(/[-_]/)[0]] || 'Log in';
  previewsSrc = substitute(previewsSrc, /var LOGIN_LABEL = '[^']*';/, `var LOGIN_LABEL = ${JSON.stringify(loginLabel)};`, 'the admin login label');
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
  if (e instanceof AnchorMissing) throw e;
  console.warn('  (stomme-previews.js copy skipped:', e.message + ')');
}

try {
  const editorDest = resolve(root, 'public/admin/stomme-editor.js');
  mkdirSync(dirname(editorDest), { recursive: true });
  let editorSrc = readFileSync(resolve(here, '../admin/editor.js'), 'utf8');
  editorSrc = substitute(editorSrc, /var FAQ_TAGS = \[[^\]]*\];/,
    `var FAQ_TAGS = ${JSON.stringify(FAQ_TAG_OPTIONS.map((o) => o.value))};`, 'the FAQ tag list');
  writeFileSync(editorDest, editorSrc);
} catch (e) {
  if (e instanceof AnchorMissing) throw e;
  console.warn('  (stomme-editor.js copy skipped:', e.message + ')');
}

writeAdminShell({ root, here, SVELTIA_CMS_SRC });

try {
  const libCss = readFileSync(resolve(here, '../styles.css'), 'utf8');
  const PREVIEW_BODY_RESET = '\n/* admin preview: undo the sticky-footer body layout */\nbody{display:block;min-height:auto}\n';
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

try {
  const imgSrc = resolve(here, '../assets/images');
  if (existsSync(imgSrc)) cpSync(imgSrc, resolve(root, 'public/images'), { recursive: true });
} catch (e) {
  console.warn('  (default images skipped:', e.message + ')');
}

try {
  const t = (key, fallback) => localized(key, fallback);
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

try {
  const { blocksToManifest } = await import('./gen-blocks-manifest.mjs');
  const { defaultBlocks } = await jiti.import('@gronare/stomme/catalog');
  const engineManifest = blocksToManifest(defaultBlocks).blocks;
  const engineTypes = new Set(defaultBlocks.map((d) => d.type));
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
