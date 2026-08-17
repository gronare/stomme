#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

check(/const substitute = \(src, re, replacement, what\) => \{/.test(gen) && /throw new Error\(`stomme-gen: \$\{what\}/.test(gen),
  'a generator substitution that matches nothing throws instead of silently shipping the default');
const rewrites = [...gen.matchAll(/substitute\((\w+), (\/[^,]+\/),/g)].map((m) => m[2]);
check(rewrites.length >= 2, `${rewrites.length} generated-asset rewrites are guarded`, rewrites.join('  '));
for (const re of rewrites) {
  const body = re.slice(1, -1).replace(/\\\//g, '/');
  const target = body.startsWith('var LOGIN_LABEL') ? previews : body.startsWith('var FAQ_TAGS') ? read('admin/editor.js') : null;
  if (target) check(new RegExp(body).test(target), `the declaration ${body.split(' =')[0]} still exists for the generator to rewrite`);
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} cross-file contracts hold`);
if (failed) { console.error('\n✗ cross-file contracts FAILED'); process.exit(1); }
