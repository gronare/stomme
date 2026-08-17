#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEmitters } from '../src/emit-fields.mjs';
import { makeCollectionEditors } from '../src/collection-editors.mjs';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (ok, name, detail = '') => {
  results.push([!!ok, name]);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const pad = (n) => ' '.repeat(n);
const AVAILABLE_BLOCKS = [{ type: 'hero', label: 'Hero', fields: [{ name: 'heading', label: 'Heading', widget: 'string' }] }];
const OPTION_SOURCES = { '$pages': [{ label: 'Home (/)', value: '/' }], '$menus': [] };
const E = makeEmitters({ q, pad, AVAILABLE_BLOCKS, OPTION_SOURCES });

const buttonCalls = [];
const { COLLECTION_EDITORS, listingEditor } = makeCollectionEditors({
  q,
  emitField: E.emitField,
  emitWidget: E.emitWidget,
  buttonField: (...a) => { buttonCalls.push(a.filter((x) => x !== undefined)); return E.buttonField(...a); },
});

const entries = Object.entries(COLLECTION_EDITORS);
const fieldNames = (yaml) => [...yaml.matchAll(/^\s*- (?:\{ )?name: (\w+)/gm)].map((m) => m[1]);
const block = (yaml, headRe) => {
  const lines = yaml.split('\n');
  const start = lines.findIndex((l) => headRe.test(l));
  if (start === -1) return '';
  const depth = lines[start].search(/\S/);
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === '' || lines[end].search(/\S/) > depth)) end += 1;
  return lines.slice(start, end).join('\n');
};

console.log('· collection panes');
check(entries.length >= 6 && ['home', 'pages', 'faq', 'testimonials', 'towns', 'services'].every((n) => COLLECTION_EDITORS[n]),
  `the engine ships ${entries.length} built-in collection panes`, Object.keys(COLLECTION_EDITORS).join(', '));
check(Object.keys(COLLECTION_EDITORS)[0] === 'home', 'home is the first pane in the CMS sidebar');
for (const [key, yaml] of entries) {
  check(new RegExp(`^- name: ${key}\\n`).test(yaml), `the '${key}' pane declares the same collection name as its map key`, yaml.split('\n')[0]);
}

const optionSrc = readFileSync(resolve(PKG, 'src/option-sources.mjs'), 'utf8');
const featureOf = Object.keys(Object.fromEntries(
  [...optionSrc.slice(optionSrc.indexOf('const FEATURE_OF')).match(/\{[^}]*\}/)[0].matchAll(/(\w+):/g)].map((m) => [m[1], 1]),
));
check(featureOf.length >= 5, `option-sources maps ${featureOf.length} collections to a feature flag`, featureOf.join(', '));
const unrouted = Object.keys(COLLECTION_EDITORS).filter((k) => k !== 'home' && k !== 'pages' && !featureOf.includes(k));
check(unrouted.length === 0,
  'every pane key is one collectionEnabled() knows by name — settings-pane filters the keys through it, so an unknown key silently falls back to folder existence',
  `unmapped: ${unrouted.join(', ')}`);

console.log('\n· pane shapes');
check(/^ {2}files:$/m.test(COLLECTION_EDITORS.home) && /file: "src\/content\/home\/home\.md"/.test(COLLECTION_EDITORS.home),
  'home is a single-file pane pointing at src/content/home/home.md');
for (const [key, yaml] of entries.filter(([k]) => k !== 'home')) {
  check(new RegExp(`^ {2}folder: "src/content/${key}"$`, 'm').test(yaml), `the '${key}' pane stores entries in src/content/${key}`);
  check(/^ {2}create: true$/m.test(yaml) && /^ {2}slug: "\{\{slug\}\}"$/m.test(yaml), `the '${key}' pane lets the owner create entries and slugs them from the title`);
}
const readDirs = [...new Set([...optionSrc.matchAll(/'src\/content\/([a-z]+)'/g)].map((m) => m[1]))];
check(readDirs.length >= 3, `option-sources scans ${readDirs.length} content folders for picker options`, readDirs.join(', '));
for (const dir of readDirs) {
  check(entries.some(([, yaml]) => yaml.includes(`folder: "src/content/${dir}"`)),
    `the folder option-sources scans for '${dir}' is the folder its pane writes to`);
}

console.log('\n· section builders');
const withBlocks = entries.filter(([, yaml]) => /^ *- name: blocks$/m.test(yaml)).map(([k]) => k);
check(JSON.stringify(withBlocks) === '["home","pages","services"]', 'exactly the page-like panes get a section builder', withBlocks.join(', '));
check(/^ {8}- name: blocks$/m.test(COLLECTION_EDITORS.home), "home's section builder sits under its file entry (indent 8)");
check(/^ {4}- name: blocks$/m.test(COLLECTION_EDITORS.pages) && /^ {4}- name: blocks$/m.test(COLLECTION_EDITORS.services),
  'a folder pane indents its section builder at 4');
check(!/media_folder|public_folder/.test(entries.map(([, y]) => y).join('\n')),
  'no pane sets a field-level uploads folder — the CMS resolves it relative to the entry, which breaks uploads from subfolder entries');

console.log('\n· structure');
for (const [key, yaml] of entries) {
  const lines = yaml.split('\n');
  const stray = lines.slice(1).filter((l) => l !== '' && !/^ /.test(l));
  check(stray.length === 0 && !/\t/.test(yaml), `the '${key}' pane is one YAML sequence entry with no tabs`, stray[0]);
}
for (const [key, yaml] of entries) {
  const m = yaml.match(/^ {2}summary: "\{\{fields\.(\w+)\}\}"$/m);
  if (!m) continue;
  check(fieldNames(yaml).includes(m[1]), `the '${key}' row summary names a field the pane actually has`, `summary uses ${m[1]}, fields: ${fieldNames(yaml).join(', ')}`);
}
const seoNames = (key) => fieldNames(block(COLLECTION_EDITORS[key], /^ {4}- name: seo$/)).join(',');
check(seoNames('towns') === seoNames('services') && /ogRaw/.test(seoNames('towns')),
  'towns and services expose the same per-entry SEO group', `${seoNames('towns')} vs ${seoNames('services')}`);

console.log('\n· the services page header');
check(JSON.stringify(buttonCalls) === '[["cta","Button"],["cta2","Second button"]]', 'the service header composes both buttons from buttonField', JSON.stringify(buttonCalls));
for (const name of ['cta', 'cta2']) {
  const b = block(COLLECTION_EDITORS.services, new RegExp(`^ {8}- name: ${name}$`));
  check(/^ {10}hint: "/m.test(b), `the '${name}' button keeps the hint spread onto the buttonField default`, b);
  check(/^ {10}collapsed: true$/m.test(b), `the '${name}' button stays a collapsed optional group`);
}

console.log('\n· listing editors');
const article = listingEditor({ id: 'news', route: '/nyheter', preset: 'article' });
check(/^- name: news$/m.test(article) && /^ {2}folder: "src\/content\/news"$/m.test(article), 'a listing writes to src/content/<id>');
check(/^ {2}label: "news"$/m.test(article), 'a listing with no label is labelled with its id');
check(/^ {2}label: "A \\"quoted\\" label"$/m.test(listingEditor({ id: 'x', label: 'A "quoted" label', preset: 'article' })),
  'a listing label is quoted through q — a quote in the label cannot break the YAML');
const articleFields = fieldNames(article);
check(['title', 'date', 'excerpt', 'cover', 'showCover', 'body'].every((n) => articleFields.includes(n)), 'the article preset carries the post fields', articleFields.join(', '));
check(!articleFields.includes('status') && !articleFields.includes('gallery'), 'the article preset carries none of the catalog fields');

const catalog = listingEditor({ id: 'stock', label: 'Lager', preset: 'catalog' });
const catalogFields = fieldNames(catalog);
check(['title', 'price', 'status', 'category', 'cover', 'gallery', 'date', 'body'].every((n) => catalogFields.includes(n)), 'the catalog preset carries the item fields', catalogFields.join(', '));
check(/^ {6}default: available$/m.test(catalog) && ['available', 'reserved', 'sold'].every((v) => catalog.includes(`value: ${v} }`)),
  'a catalog item defaults to available and offers the three statuses');
check(!/- name: specs$/m.test(catalog), 'a listing with no specs emits no specs group');

const specced = listingEditor({ id: 'stock', preset: 'catalog', specs: ['Weight', { key: 'colour', label: 'Colour' }, { label: 'Depth' }] });
const specsBlock = block(specced, /^ {4}- name: specs$/);
check(/name: spec_0, label: "Weight"/.test(specsBlock), 'a string spec becomes a positional key', specsBlock);
check(/name: colour, label: "Colour"/.test(specsBlock), 'a spec with an explicit key keeps it');
check(/name: spec_2, label: "Depth"/.test(specsBlock), 'a spec object without a key falls back to its position — never to a duplicate key');
check(!/- name: specs$/m.test(listingEditor({ id: 'news', preset: 'article', specs: ['Weight'] })), 'the article preset ignores specs');

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ collection-editors unit FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ collection editors intact.');
