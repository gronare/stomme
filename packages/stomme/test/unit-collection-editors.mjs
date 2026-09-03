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

console.log('\n· subpages');
const P = COLLECTION_EDITORS.pages;
check(/^ {2}view_groups:\n {4}groups:\n {6}- \{ name: parent, label: "Parent page", field: parent \}$/m.test(P),
  'the pages list can be grouped by parent page, and opens ungrouped', block(P, /^ {2}view_groups:$/));
check(/^ {4}- name: parent\n {6}label: "Parent page"\n {6}widget: select\n {6}required: false\n {6}hint: "[^"]+"\n {6}options:$/m.test(P),
  'the parent is picked from the site\'s own pages, and is optional', block(P, /^ {4}- name: parent$/));
check(P.includes('- { label: "Home (/)", value: "/" }'), 'the parent picker is filled from the $pages option source');
check(/- \{ name: summary, label: "Short text", widget: text, required: false, hint: "[^"]+" \}/.test(P), 'a page carries a short text for cards and lists');
check(/- \{ name: cover, label: "Card image", widget: image, required: false \}/.test(P), 'and a card image');
check(/- \{ name: order, label: "Order", widget: number, required: false, default: 0, hint: "[^"]+" \}/.test(P), 'and an order among its siblings');
const pageFields = fieldNames(P.slice(P.indexOf('\n  fields:')));
check(pageFields.indexOf('parent') > pageFields.indexOf('title') && pageFields.indexOf('order') < pageFields.indexOf('seo'),
  'the new fields sit after the title and before SEO', pageFields.join(', '));
const localizedPages = makeCollectionEditors({ q, emitField: E.emitField, emitWidget: E.emitWidget, buttonField: E.buttonField, localized: (n) => n === 'pages' }).COLLECTION_EDITORS.pages;
check(/name: parent[\s\S]*?\n {6}i18n: duplicate\n/.test(localizedPages) && /name: cover[^}]*i18n: duplicate/.test(localizedPages) && /name: order[^}]*i18n: duplicate/.test(localizedPages),
  'the parent, the card image and the order are one setting for every language',
  block(localizedPages, /^ {4}- name: parent$/));
check(/name: summary[^}]*i18n: true/.test(localizedPages), 'the short text is written per language');

console.log('\n· a menu item can list a page\'s subpages');
const navYaml = E.emitNavLinks(4);
check(/- \{ name: autoChildren, label: "List the page's subpages", widget: boolean, required: false, default: false, hint: "[^"]+" \}/.test(navYaml),
  'the nav editor offers the switch that fills a dropdown from the page tree', navYaml);
check(navYaml.indexOf('autoChildren') > navYaml.indexOf('name: children'),
  'it sits after the manual sub-links it gives way to');

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

const groups = block(catalog, /^ {2}view_groups:$/);
check(/^ {6}- \{ name: status, label: "Status", field: status \}$/m.test(groups) && /^ {4}default: status$/m.test(groups),
  'a catalog collection opens grouped by status', groups);
const filters = block(catalog, /^ {2}view_filters:$/);
check(['available', 'reserved', 'sold'].every((v) => new RegExp(`name: ${v}, label: "[^"]+", field: status, pattern: "\\^${v}\\$" }`).test(filters)),
  'a catalog collection offers one filter per status', filters);
check(!/view_groups|view_filters/.test(article), 'an article collection has no status views');

check(/^ {6}default: available$/m.test(catalog) && /pattern: "\^available\$" }/.test(filters), 'without site words the stored value stays the canonical key and the filter matches exactly that');

const worded = makeCollectionEditors({ q, emitField: E.emitField, emitWidget: E.emitWidget, buttonField: E.buttonField, listingStatus: { available: 'Till salu', reserved: 'Reserverad', sold: 'Genomförd (ja)' } })
  .listingEditor({ id: 'stock', preset: 'catalog' });
check(/label: "Till salu", value: "Till salu" }/.test(worded) && /label: "Reserverad", value: "Reserverad" }/.test(worded) && /label: "Genomförd \(ja\)", value: "Genomförd \(ja\)" }/.test(worded),
  "with site words the status options store the site's own word as the value");
check(/^ {4}default: \{ field: status, direction: ascending \}$/m.test(catalog) && /^ {4}default: \{ field: status, direction: descending \}$/m.test(worded),
  'the list sorts on status in whichever direction puts the available word first, so Sveltia lists that group at the top');
check(/^ {6}default: "Till salu"$/m.test(worded), 'a new entry starts on the site word for available, so the stored value is never a key the options lack');
check(worded.includes('- { name: available, label: "Till salu", field: status, pattern: "^Till salu$" }') && worded.includes('- { name: sold, label: "Genomförd (ja)", field: status, pattern: "^Genomförd \\\\(ja\\\\)$" }'),
  'the status filters match the stored word exactly, with regex characters in a word escaped', worded.split('\n').filter((l) => l.includes('pattern:')).join('\n'));

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ collection-editors unit FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ collection editors intact.');
