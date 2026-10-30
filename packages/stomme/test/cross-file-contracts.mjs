#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { parse as parseYaml } from 'yaml';
import { referenceLabels } from './label-reference.mjs';

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(pkg, p), 'utf8');
const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const fonts = read('src/fonts.ts');
const pane = read('src/settings-pane.mjs');
const previews = read('admin/previews.js');
const gen = read('bin/gen-admin-blocks.mjs');
const ogPages = read('src/og-pages.ts');
const protect = read('src/protect.ts');
const entrypoints = read('src/entrypoints.mjs');

const stackBlock = fonts.slice(fonts.indexOf('FONT_STACKS'), fonts.indexOf('export interface Webfont'));
const stacks = Object.fromEntries([...stackBlock.matchAll(/^\s{2}'?([a-z-]+)'?:\s*'([^']+)'/gm)].map((m) => [m[1], m[2]]));
const webfonts = [...fonts.matchAll(/^\s{2}'?([a-z-]+)'?:\s*\{\s*$/gm)].map((m) => m[1]);
check(Object.keys(stacks).length >= 8, `src/fonts.ts declares ${Object.keys(stacks).length} font stacks`);

const paneFontOptions = [...pane.matchAll(/\{ label: "[^"]*", value: "([a-z-]+)" \}/g)].map((m) => m[1]);
const fontOptions = paneFontOptions.filter((v) => v in stacks || webfonts.includes(v) || v === 'custom');
const orphans = paneFontOptions.filter((v) => /^(system|serif|grotesk|rounded|slab|geometric|condensed|humanist|script|mono|inter|inter-tight)$/.test(v) && !(v in stacks) && !webfonts.includes(v));
check(orphans.length === 0, 'every font the CMS offers exists in src/fonts.ts', `orphaned: ${orphans.join(', ')}`);
check(fontOptions.length > 0, `the CMS offers ${fontOptions.length} resolvable font options`);

const previewStacks = [...previews.matchAll(/^\s*'?([a-z-]+)'?:\s*'([^']+)'/gm)].filter(([, k]) => k in stacks);
const families = (v) => v.split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).join('|');
const drift = previewStacks.filter(([, k, v]) => families(stacks[k]) !== families(v)).map(([, k]) => k);
check(previewStacks.length > 0 && drift.length === 0,
  `the CMS preview lists the same families as src/fonts.ts for ${previewStacks.length} stacks`, `drifted: ${drift.join(', ')}`);

const IMAGE_ALIAS = { 'linked-image': 'image' };
const registeredComponents = [...new Set([...previews.slice(previews.indexOf('var IMAGE_COMPONENT')).matchAll(/\bid: '([^']+)'/g)].map((m) => m[1]))];
const listedComponents = (gen.match(/const EDITOR_COMPONENTS = \[([^\]]*)\]/)?.[1] ?? '').split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
const unreachable = registeredComponents.filter((id) => !listedComponents.includes(id) && !listedComponents.includes(IMAGE_ALIAS[id]));
check(registeredComponents.length >= 3 && listedComponents.length >= 3 && unreachable.length === 0,
  `every rich-text component admin/previews.js registers is named in the generator's editor_components list (${listedComponents.join(', ')})`,
  `unreachable: ${unreachable.join(', ')}`);
check(new Set(listedComponents).size === listedComponents.length,
  'the generated editor_components list names each id once', `duplicated: ${listedComponents.join(', ')}`);
check(/editor_components: \[\$\{EDITOR_COMPONENTS\.join\(', '\)\}\]/.test(gen),
  'the generator writes field_defaults.richtext.editor_components from EDITOR_COMPONENTS rather than leaving Sveltia to build the default');

const typeFields = [...ogPages.slice(ogPages.indexOf('TYPE_FIELDS')).matchAll(/'([a-z][A-Za-z]*)'/g)].map((m) => m[1]);
check(typeFields.length > 0, `the OG renderer resolves ${new Set(typeFields).size} distinct card fields`);

const encodesReversed = /reverse\(\)\.join\(''\)/.test(protect) && /btoa|Buffer\.from/.test(protect);
const decodesReversed = /atob\([^)]*\)/.test(entrypoints) && /reverse\(\)\.join\(''\)/.test(entrypoints);
check(encodesReversed && decodesReversed,
  'src/protect.ts encodes reversed+base64 and src/entrypoints.mjs decodes the same way',
  `encode=${encodesReversed} decode=${decodesReversed}`);

const contactForm = read('blocks/ContactForm.astro');
const formSamples = read('src/form-samples.ts');
const recapFields = [...(contactForm.match(/const recapLabels = JSON\.stringify\(\{([^}]*)\}/)?.[1] ?? '').matchAll(/(\w+):/g)].map((m) => m[1]);
const unmirrored = recapFields.filter((f) => !new RegExp(`${f}Label`).test(formSamples));
check(recapFields.length > 0 && unmirrored.length === 0,
  `the thanks preview samples every field the form captures at submit (${recapFields.join(', ')})`,
  `missing from src/form-samples.ts: ${unmirrored.join(', ')}`);
const overrides = [...contactForm.matchAll(/^\s+(\w+): (label\w+) \|\| \(c\.(\w+)/gm)].map((m) => [m[2], m[3]]).filter(([, str]) => recapFields.includes(str));
const driftedOverrides = overrides.filter(([prop, str]) => !new RegExp(`b\\.${prop} \\|\\| \\(c\\.${str}`).test(formSamples));
check(overrides.length >= 3 && driftedOverrides.length === 0,
  'the preview resolves each overridable label exactly as the form does (block override, else the site string)',
  `drifted: ${driftedOverrides.map(([p]) => p).join(', ')}`);

const footer = read('chrome/Footer.astro');
const styles = read('styles.css');
const legalList = footer.match(/<ul class="footer-legal">[\s\S]*?<\/ul>/)?.[0] ?? '';
check(/<SlotFooterLegalEnd \/>/.test(legalList), 'the footer-legal-end slot is mounted inside the legal list, not merely aliased');
check(/'footer-legal-end'/.test(read('integration.mjs')), 'the integration declares the slot the footer mounts');
check(!/legal\.length > 0 && \(\s*<ul class="footer-legal">/.test(footer),
  'the legal list renders whether or not the site supplies legal links — only the slot knows whether it filled it');
const legalHover = styles.match(/^\.footer-legal \.footer-link:hover \{([^}]*)\}/m)?.[1] ?? '';
const hoverToken = legalHover.match(/var\((--[\w-]+)/)?.[1];
check(!!hoverToken && hoverToken !== '--color-brand',
  'the legal-row hover reads a token, not a brand colour a dark footer may share with its own ground', legalHover.trim());
check(!!hoverToken && new RegExp(`\\n\\s*${hoverToken}:`).test(styles.match(/^\.site-footer--dark \{[\s\S]*?\n\}/m)?.[0] ?? ''),
  `.site-footer--dark remaps ${hoverToken}, so the hover stays legible on the dark ground`);
check(!/:visited/.test(styles), 'no :visited rule anywhere — a link keeps one colour in every state but hover');

const throwsOnMiss = /const substitute = \(src, re, replacement, what\) => \{/.test(gen) && /throw new AnchorMissing\(`stomme-gen: \$\{what\}/.test(gen);
const escapesCatch = (gen.match(/if \(e instanceof AnchorMissing\) throw e;/g) || []).length >= 2;
check(throwsOnMiss, 'a generator substitution that matches nothing throws');
check(escapesCatch, 'that throw escapes the copy try/catch instead of degrading to a warning');
const guardSrc = gen.match(/const substitute = \(src, re, replacement, what\) => \{[\s\S]*?\n\};/)?.[0];
const substitute = guardSrc && new Function('AnchorMissing', `${guardSrc}\nreturn substitute;`)(class extends Error {});
let identicalSurvives = false;
try { substitute("  var LOGIN_LABEL = 'Log in';\n", /var LOGIN_LABEL = '[^']*';/, "var LOGIN_LABEL = 'Log in';", 'the admin login label'); identicalSurvives = true; } catch {}
let renameStillThrows = false;
try { substitute("  var LOGIN_LABEL_RENAMED = 'Log in';\n", /var LOGIN_LABEL = '[^']*';/, "var LOGIN_LABEL = 'Logga in';", 'the admin login label'); } catch { renameStillThrows = true; }
check(identicalSurvives, 'a rewrite whose replacement equals the source is not mistaken for a missing anchor (an English admin)');
check(renameStillThrows, 'a genuinely renamed declaration still throws');

const rewrites = [...gen.matchAll(/substitute\((\w+), (\/[^,]+\/),/g)].map((m) => m[2]);
check(rewrites.length >= 2, `${rewrites.length} generated-asset rewrites are guarded`, rewrites.join('  '));
for (const re of rewrites) {
  const body = re.slice(1, -1).replace(/\\\//g, '/');
  const target = body.startsWith('var LOGIN_LABEL') || body.startsWith('var COMPONENT_LABELS') ? previews
    : body.startsWith('var BLOCK_PICKER') || body.startsWith('var pickerSearch') ? read('admin/editor.js') : null;
  if (target) check(new RegExp(body).test(target), `the declaration ${body.split(' =')[0]} still exists for the generator to rewrite`);
}

const { byPath: REFERENCE, blocks, groups, yamls, listings: referenceListings } = await referenceLabels();

// Sveltia writes every declared default into blocks the editor never touched, so a default on a free-text widget puts words on a live page nobody wrote. Suggested wording goes in the hint; the other defaults are held to what a block renders with the key left out, further down.
const FREE_TEXT = /^(string|text|markdown)$/;
const bare = (s) => s.replace(/"(?:[^"\\]|\\.)*"/g, '""');
const freeTextDefaults = [];
for (const yaml of yamls) {
  const lines = yaml.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = bare(lines[i]);
    const flow = l.match(/^\s*-?\s*\{(.*)\}\s*$/);
    if (flow) {
      const w = flow[1].match(/(?:^|,)\s*widget:\s*([a-z]+)/);
      const name = flow[1].match(/(?:^|,)\s*name:\s*([\w-]+)/);
      if (w && FREE_TEXT.test(w[1]) && /(?:^|,)\s*default:/.test(flow[1])) freeTextDefaults.push(name ? name[1] : lines[i].trim());
      continue;
    }
    const block = l.match(/^(\s*)widget:\s*([a-z]+)\s*$/);
    if (!block || !FREE_TEXT.test(block[2])) continue;
    const indent = block[1].length;
    for (let j = i + 1; j < lines.length; j++) {
      const n = bare(lines[j]);
      if (!n.trim()) continue;
      const col = n.length - n.trimStart().length;
      if (col < indent || /^\s*-/.test(n)) break;
      if (col === indent && /^\s*default:/.test(n)) freeTextDefaults.push(lines[j].trim());
    }
  }
}
check(freeTextDefaults.length === 0,
  'no string/text/markdown field in the generated config declares a default — a default there is page copy Sveltia writes into blocks nobody edited',
  [...new Set(freeTextDefaults)].join(', '));
const gallerySrc = `${read('admin/blocks-gallery.mjs')}\n${read('admin/block-picker.mjs')}`;
const galleryKeys = new Set([
  ...[...gallerySrc.matchAll(/\bt\('([\w.]+)'/g)].map((m) => m[1]),
  ...groups.map((g) => `gallery.group.${g}`),
  ...blocks.map((b) => `block.${b.type}.keywords`),
]);
check(REFERENCE.size > 500 && galleryKeys.size > 30,
  `the engine emits ${REFERENCE.size} translatable field paths and ${galleryKeys.size} gallery strings`);

// What is left is deliberate: icon and font names (identifiers, not prose), hidden fields nobody sees, labels a site supplies for its own listings, and the seeded options standing in for that content in the reference. Every other emitted path carries a translation, either by path or by the English-text fallback.
const UNTRANSLATED_CEILING = { 'labels.sv.js': 141 };

for (const file of readdirSync(resolve(pkg, 'admin')).filter((f) => /^labels\.[\w-]+\.js$/.test(f)).sort()) {
  const dict = (await import(resolve(pkg, 'admin', file))).default;
  const keys = Object.keys(dict);
  const orphans = keys.filter((k) => !REFERENCE.has(k) && !galleryKeys.has(k));
  check(orphans.length === 0, `every key in admin/${file} names a path the generator still emits`,
    `${orphans.length} orphaned: ${orphans.slice(0, 8).join(', ')}${orphans.length > 8 ? ' …' : ''}`);
  const shapeless = keys.filter((k) => !Array.isArray(dict[k]) || dict[k].length !== 2);
  check(shapeless.length === 0, `every entry in admin/${file} is an [English source, translation] pair`,
    shapeless.slice(0, 8).join(', '));
  const stale = keys.filter((k) => REFERENCE.has(k) && Array.isArray(dict[k]) && dict[k][0] !== REFERENCE.get(k));
  check(stale.length === 0, `every translation in admin/${file} still answers the English the generator emits`,
    stale.slice(0, 6).map((k) => `${k}\n        dictionary: ${dict[k][0]}\n        emitted:    ${REFERENCE.get(k)}`).join('\n      '));
  const untranslated = [...REFERENCE.keys()].filter((k) => dict[k] === undefined);
  const ceiling = UNTRANSLATED_CEILING[file];
  check(ceiling === undefined || untranslated.length <= ceiling,
    `admin/${file} leaves no more strings in English than it did (${untranslated.length} of ${REFERENCE.size}, ceiling ${ceiling})`,
    `${untranslated.length - (ceiling ?? 0)} more than the ceiling — add the entries, or lower the ceiling deliberately`);
  console.log(`  · admin/${file}: ${keys.length} entries · ${untranslated.length} emitted paths left in English`);
}

const config = read('src/config.ts');
const cmsType = config.slice(config.indexOf('  cms?: {'), config.indexOf('  };', config.indexOf('  cms?: {')));
const typedCmsKeys = new Set([...cmsType.matchAll(/^\s{4}([a-zA-Z]+)\?:/gm)].map((m) => m[1]));
const readCmsKeys = new Set([...`${pane}\n${gen}`.matchAll(/\b(?:c|CMS)\s*&&\s*CMS\.([a-zA-Z]+)|\bc\.([a-zA-Z]+)/g)].map((m) => m[1] || m[2]));
const untyped = [...readCmsKeys].filter((k) => !typedCmsKeys.has(k));
check(readCmsKeys.size >= 8 && untyped.length === 0, `every site.cms key the generator reads is in the SiteConfig type (${readCmsKeys.size} keys)`, `missing from the type: ${untyped.join(', ')}`);

const optionsType = read('integration.d.ts').match(/interface StommeIntegrationOptions \{([\s\S]*?)\n\}/)?.[1] ?? '';
const typedOptions = new Set([...optionsType.matchAll(/^\s{2}([a-zA-Z]+)\?:/gm)].map((m) => m[1]));
const readOptions = new Set([...read('integration.mjs').matchAll(/\boptions\.([a-zA-Z]+)/g)].map((m) => m[1]));
const untypedOptions = [...readOptions].filter((k) => !typedOptions.has(k));
check(readOptions.size >= 5 && untypedOptions.length === 0, `every integration option the code reads is in StommeIntegrationOptions (${readOptions.size} options)`, `missing from the type: ${untypedOptions.join(', ')}`);

const literalPrefixes = readdirSync(resolve(pkg, 'blocks')).filter((f) => f.endsWith('.astro'))
  .filter((f) => /<ContactLink\b[^>]*\bprefix="[^"]*[A-Za-z]/.test(read(`blocks/${f}`)));
check(literalPrefixes.length === 0, 'no block hands ContactLink a word as a literal prefix; the word comes from the site strings so it follows the language', literalPrefixes.join(', '));

const migrations = JSON.parse(read('block-migrations.json')).migrations;
const unmigrated = readdirSync(resolve(pkg, 'blocks')).filter((f) => f.endsWith('.astro')).flatMap((f) => {
  const src = read(`blocks/${f}`);
  const type = src.match(/data-stomme-block="([a-zA-Z]+)"/)?.[1];
  return [...src.matchAll(/resolveButton\(\s*[\w.?]+\s*,\s*([\w.?]+)/g)]
    .map((m) => m[1].split('.').pop())
    .filter((label) => !migrations.some((g) => g.blocks.includes(type) && g.label === label))
    .map((label) => `${type}.${label}`);
});
check(migrations.length >= 7 && unmigrated.length === 0, 'every legacy button pair a block still renders through resolveButton has an entry in block-migrations.json', unmigrated.join(', '));
check(JSON.parse(read('package.json')).files.includes('block-migrations.json'), 'block-migrations.json is in the package files, so the published package ships it');

const manifestBlocks = JSON.parse(read('blocks-manifest.json')).blocks;
const undeclaredLayout = readdirSync(resolve(pkg, 'blocks')).filter((f) => f.endsWith('.astro')).flatMap((f) => {
  const src = read(`blocks/${f}`);
  const type = src.match(/data-stomme-block="([a-zA-Z]+)"/)?.[1];
  if (!manifestBlocks[type]) return [];
  const declared = (manifestBlocks[type].fields.find((x) => x.name === 'layout')?.fields ?? []).map((x) => x.name);
  return [...new Set([...src.matchAll(/layout\?\.([a-zA-Z]+)/g)].map((m) => m[1]))].filter((k) => !declared.includes(k)).map((k) => `${type}.layout.${k}`);
});
check(undeclaredLayout.length === 0, 'every layout option a block component honours is declared in the catalog, so the CMS offers it', undeclaredLayout.join(', '));

const { defaultBlocks } = await createJiti(import.meta.url).import(resolve(pkg, 'catalog.ts'));
const rendererOf = new Map(readdirSync(resolve(pkg, 'blocks')).filter((f) => f.endsWith('.astro')).map((f) => {
  const src = read(`blocks/${f}`);
  return [src.match(/data-stomme-block="([a-zA-Z]+)"/)?.[1], src];
}));
const renderers = [...rendererOf.values(), ...readdirSync(resolve(pkg, 'src')).filter((f) => f.endsWith('.astro')).map((f) => read(`src/${f}`))].join('\n');
const blockRenderer = read('src/BlockRenderer.astro');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A default the renderer reaches without a literal `?? default` fallback: each regex is the line in the renderer that makes the key left out render as the default.
const ABSENT_AS_DEFAULT = {
  'style.surface': [blockRenderer, /block\.style\?\.surface \? surfaceClass\[block\.style\.surface\] : undefined/, /surfaceClass[^\n]*= \{(?![^}]*standard)/],
  'layout.beside': [blockRenderer, /RATIOS = new Set\(\['equal', 'narrow', 'wide'\]\)/],
  'hero media.ratio': [rendererOf.get('hero'), /RATIOS[^\n]*= \{ wide: [^}]*square: [^}]*\}/, /media\.ratio \? RATIOS\[media\.ratio\] : undefined/],
  'hero layout.mediaPosition': [rendererOf.get('hero'), /layout\?\.mediaPosition === 'below'/],
  'textImage media.kind': [rendererOf.get('textImage'), /media\.kind === 'video'/],
  'textImage media.fit': [rendererOf.get('textImage'), /media\.fit === 'cutout'/],
  'postList text': [rendererOf.get('postList'), /props\.text === 'full'/],
  'postList media.style': [rendererOf.get('postList'), /media\?\.style === 'corner'/],
  'featureGrid layout.columns': [read('styles.css'), /var\(--fg-cols, 3\)/],
  'subpages layout.variant': [rendererOf.get('subpages'), /String\(Astro\.props\.layout!\.variant\) : 'cards'/],
  'subpages layout.columns': [rendererOf.get('subpages'), /Number\(Astro\.props\.layout\?\.columns\) \|\| 2/],
  'contactSwitch layout.variant': [read('src/contact-switch.ts'), /: 'segmented';/],
};
const defaultFields = (fields, prefix = '') => fields.flatMap((f) => {
  const path = prefix ? `${prefix}.${f.name}` : f.name;
  const own = f.default !== undefined ? [{ f, path }] : [];
  return [...own, ...(Array.isArray(f.fields) ? defaultFields(f.fields, f.widget === 'list' ? `${path}[]` : path) : [])];
});
const onByDefault = [];
const notTheAbsent = [];
for (const b of defaultBlocks) {
  for (const { f, path } of defaultFields(b.fields)) {
    const key = `${b.type} ${path}`;
    if (f.widget === 'boolean') {
      if (f.default !== false) onByDefault.push(key);
      if (new RegExp(`\\b${escape(f.name)}\\s*(?:!==\\s*false|\\?\\?\\s*true)`).test(renderers)) notTheAbsent.push(`${key} (renders on when left out)`);
      continue;
    }
    if (Array.isArray(f.default)) { if (f.default.length) onByDefault.push(key); continue; }
    if (f.widget === 'string' || f.widget === 'text' || f.widget === 'markdown') continue;
    const held = ABSENT_AS_DEFAULT[key] ?? ABSENT_AS_DEFAULT[path.split('.').slice(-2).join('.')];
    if (held) {
      const [src, ...lines] = held;
      if (!src || !lines.every((re) => re.test(src))) notTheAbsent.push(`${key} (the renderer line that makes it ${JSON.stringify(f.default)} moved)`);
      continue;
    }
    const literal = typeof f.default === 'string' ? `'${escape(f.default)}'` : escape(String(f.default));
    const src = rendererOf.get(b.type) ?? '';
    if (!new RegExp(`\\b${escape(f.name)}\\s*\\?\\?\\s*${literal}(?![\\w'])`).test(src)) notTheAbsent.push(`${key} (no \`${f.name} ?? ${literal}\` in its renderer)`);
  }
}
check(onByDefault.length === 0, 'no catalog switch defaults on and no list defaults non-empty: Sveltia writes a default into every entry that lacks the key, so it must be what the key left out renders', onByDefault.join(', '));
check(notTheAbsent.length === 0, 'every other catalog default is what its block renders with the key left out', notTheAbsent.join('\n    '));

const { stommeCollections } = await createJiti(import.meta.url, { alias: { 'astro:content': resolve(pkg, 'bin/_astro-content-stub.mjs') } }).import(resolve(pkg, 'collections.ts'));
const schemas = Object.fromEntries(Object.entries(stommeCollections(referenceListings)).map(([k, c]) => [k, c.schema]));
const unwrap = (z) => {
  while (z && ['ZodDefault', 'ZodOptional', 'ZodNullable', 'ZodEffects'].includes(z._def.typeName)) z = z._def.innerType ?? z._def.schema;
  return z;
};
const childOf = (z, name) => {
  const u = unwrap(z);
  if (!u) return undefined;
  if (u._def.typeName === 'ZodObject') return u.shape[name];
  if (u._def.typeName === 'ZodRecord') return u._def.valueType;
  if (u._def.typeName === 'ZodArray') return childOf(u.element, name);
  return undefined;
};
const absentOf = (z) => { const r = z.safeParse(undefined); return r.success ? { value: r.data } : null; };
const header = read('chrome/Header.astro');
// A pane default the schema leaves without an absent value but a renderer resolves anyway: each [source, regex] pair is a line that makes the key left out render as the CMS default, and one of those lines must spell the default itself.
const collectionsSrc = read('collections.ts');
const PANE_ABSENT_AS_DEFAULT = {
  'theme muted': [[styles, /^\s*--color-muted: #6b7280;/m]],
  'theme secondary': [[styles, /^\s*--color-secondary: #0ea5e9;/m]],
  'navigation sticky': [[header, /nav\.sticky === true \|\| nav\.sticky === 'true'/], [collectionsSrc, /sticky: z\.union\(\[z\.boolean\(\), z\.enum\(\['true', 'false', 'phone'\]\)\]\)\.default\(false\)/]],
  'thanks variant': [[read('Thanks.astro'), /^\s*variant = 'classic',$/m]],
  'pages order': [[read('src/pages.ts'), /const rank = \(value: unknown\): number => \(typeof value === 'number' && Number\.isFinite\(value\) \? value : 0\)/]],
  'settings og.types[].headlineField': [[ogPages, /HEADLINE_DEFAULT: Record<OgTypeKind, string> = \{ article: 'title', catalog: 'title', towns: 'name', services: 'title' \}/]],
  'settings og.types[].sublineField': [[ogPages, /SUBLINE_DEFAULT: Record<OgTypeKind, string> = \{ article: 'none', catalog: 'price', towns: 'none', services: 'none' \}/]],
};
// The one deliberate exception: a page made in the CMS starts published, while a hand-written file without the key stays unbuilt.
const PANE_DEFAULT_DIFFERS = new Set(['pages published']);
const paneFields = (fields, schema, collection, prefix = '') => (fields ?? []).flatMap((f) => {
  if (f.widget === 'list' && f.types) return [];
  const node = schema && childOf(schema, f.name);
  const recordStep = !!node && unwrap(schema)._def.typeName === 'ZodRecord';
  const path = recordStep ? `${prefix}[]` : prefix ? `${prefix}.${f.name}` : f.name;
  const own = f.default !== undefined ? [{ f, node, key: `${collection} ${path}` }] : [];
  return [...own, ...(Array.isArray(f.fields) ? paneFields(f.fields, node, collection, path) : [])];
});
const paneDefaults = new Map();
for (const yaml of yamls) {
  const doc = parseYaml(yaml);
  for (const c of doc.collections ?? []) {
    const units = c.folder ? [{ dir: c.folder, fields: c.fields }] : (c.files ?? []).map((f) => ({ dir: f.file, fields: f.fields }));
    for (const u of units) {
      const collection = String(u.dir).split('/')[2];
      for (const d of paneFields(u.fields, schemas[collection], collection)) if (!paneDefaults.has(d.key)) paneDefaults.set(d.key, d);
    }
  }
}
const paneDrift = [];
for (const [key, { f, node }] of paneDefaults) {
  if (PANE_DEFAULT_DIFFERS.has(key)) continue;
  const held = PANE_ABSENT_AS_DEFAULT[key];
  if (held) {
    const hits = held.map(([src, re]) => src.match(re)?.[0]);
    if (!hits.every(Boolean) || !hits.some((h) => h.includes(String(f.default)))) paneDrift.push(`${key} (the renderer line that makes it ${JSON.stringify(f.default)} moved or names another value)`);
    continue;
  }
  const absent = node && absentOf(node);
  if (!absent) { paneDrift.push(`${key} (no schema default for the CMS's ${JSON.stringify(f.default)})`); continue; }
  const value = f.widget === 'boolean' && absent.value === undefined ? false : absent.value;
  if (JSON.stringify(value) !== JSON.stringify(f.default)) paneDrift.push(`${key} (the CMS starts ${JSON.stringify(f.default)}, a file without the key renders ${JSON.stringify(value)})`);
}
check(paneDefaults.size >= 30, `the settings panes and collection editors declare ${paneDefaults.size} defaults`);
check(paneDrift.length === 0, 'every settings-pane and collection-editor default is what the site renders with the key left out', paneDrift.join('\n    '));
check(paneDefaults.get('pages published')?.f.default === true && absentOf(schemas.pages.shape.published)?.value === false,
  'pages published stays the one allowed difference: the CMS starts a page published, a file without the key is not built');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} cross-file contracts hold`);
if (failed) { console.error('\n✗ cross-file contracts FAILED'); process.exit(1); }
