#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const typeFields = [...ogPages.slice(ogPages.indexOf('TYPE_FIELDS')).matchAll(/'([a-z][A-Za-z]*)'/g)].map((m) => m[1]);
check(typeFields.length > 0, `the OG renderer resolves ${new Set(typeFields).size} distinct card fields`);

const encodesReversed = /reverse\(\)\.join\(''\)/.test(protect) && /btoa|Buffer\.from/.test(protect);
const decodesReversed = /atob\([^)]*\)/.test(entrypoints) && /reverse\(\)\.join\(''\)/.test(entrypoints);
check(encodesReversed && decodesReversed,
  'src/protect.ts encodes reversed+base64 and src/entrypoints.mjs decodes the same way',
  `encode=${encodesReversed} decode=${decodesReversed}`);

const throwsOnMiss = /const substitute = \(src, re, replacement, what\) => \{/.test(gen) && /throw new AnchorMissing\(`stomme-gen: \$\{what\}/.test(gen);
const escapesCatch = (gen.match(/if \(e instanceof AnchorMissing\) throw e;/g) || []).length >= 2;
check(throwsOnMiss, 'a generator substitution that matches nothing throws');
check(escapesCatch, 'that throw escapes the copy try/catch instead of degrading to a warning');
const guardSrc = gen.match(/const substitute = \(src, re, replacement, what\) => \{[\s\S]*?\n\};/)?.[0];
const substitute = guardSrc && new Function('AnchorMissing', `${guardSrc}\nreturn substitute;`)(class extends Error {});
let identicalSurvives = false;
try { substitute('  var FAQ_TAGS = [];\n', /var FAQ_TAGS = \[[^\]]*\];/, 'var FAQ_TAGS = [];', 'the FAQ tag list'); identicalSurvives = true; } catch {}
let renameStillThrows = false;
try { substitute('  var FAQ_TAGS_RENAMED = [];\n', /var FAQ_TAGS = \[[^\]]*\];/, 'var FAQ_TAGS = ["a"];', 'the FAQ tag list'); } catch { renameStillThrows = true; }
check(identicalSurvives, 'a rewrite whose replacement equals the source is not mistaken for a missing anchor (a site whose FAQ entries carry no tags)');
check(renameStillThrows, 'a genuinely renamed declaration still throws');

const rewrites = [...gen.matchAll(/substitute\((\w+), (\/[^,]+\/),/g)].map((m) => m[2]);
check(rewrites.length >= 2, `${rewrites.length} generated-asset rewrites are guarded`, rewrites.join('  '));
for (const re of rewrites) {
  const body = re.slice(1, -1).replace(/\\\//g, '/');
  const target = body.startsWith('var LOGIN_LABEL') ? previews : body.startsWith('var FAQ_TAGS') ? read('admin/editor.js') : null;
  if (target) check(new RegExp(body).test(target), `the declaration ${body.split(' =')[0]} still exists for the generator to rewrite`);
}

const { byPath: REFERENCE, blocks, groups, yamls } = await referenceLabels();

// Sveltia writes every declared default into blocks the editor never touched, so a default on a free-text widget puts words on a live page nobody wrote. Suggested wording goes in the hint; select/boolean/number/colour defaults are visual no-ops and stay.
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
const gallerySrc = read('admin/blocks-gallery.mjs');
const galleryKeys = new Set([
  ...[...gallerySrc.matchAll(/\bt\('([\w.]+)'/g)].map((m) => m[1]),
  ...groups.map((g) => `gallery.group.${g}`),
  ...blocks.map((b) => `block.${b.type}.summary`),
]);
check(REFERENCE.size > 500 && galleryKeys.size > 30,
  `the engine emits ${REFERENCE.size} translatable field paths and ${galleryKeys.size} gallery strings`);

// What is left is deliberate: icon and font names (identifiers, not prose), hidden fields nobody sees, and labels a site supplies for its own listings. Every other emitted path carries a translation, either by path or by the English-text fallback.
const UNTRANSLATED_CEILING = { 'labels.sv.js': 130 };

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

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} cross-file contracts hold`);
if (failed) { console.error('\n✗ cross-file contracts FAILED'); process.exit(1); }
