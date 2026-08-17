#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEmitters } from '../src/emit-fields.mjs';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (ok, name, detail = '') => {
  results.push([!!ok, name]);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const Q_SRC = "const q = (s) => `\"${String(s).replace(/\\\\/g, '\\\\\\\\').replace(/\"/g, '\\\\\"')}\"`;";
const PAD_SRC = "const pad = (n) => ' '.repeat(n);";
const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const pad = (n) => ' '.repeat(n);

const gen = readFileSync(resolve(PKG, 'bin/gen-admin-blocks.mjs'), 'utf8');
check(gen.includes(Q_SRC), "this suite's `q` is byte-identical to the generator's", 'the emitters are only pure given the generator\'s own q/pad');
check(gen.includes(PAD_SRC), "this suite's `pad` is byte-identical to the generator's");

const AVAILABLE_BLOCKS = [
  { type: 'hero', label: 'Hero', fields: [{ name: 'heading', label: 'Heading', widget: 'string' }] },
  { type: 'empty', label: 'Empty', fields: [] },
  { type: 'nested', label: 'Nested', fields: [{ name: 'inner', label: 'Inner', widget: 'blocks' }] },
];
const OPTION_SOURCES = {
  '$pages': [{ label: 'Home (/)', value: '/' }, { label: 'About (/about)', value: '/about' }],
  '$menus': [{ label: 'Services', value: 'services::/services' }],
};
const E = makeEmitters({ q, pad, AVAILABLE_BLOCKS, OPTION_SOURCES });
const { listSummary, emitField, emitWidget, navLinkField, emitNavLinks, buttonField, emitThanksButtons } = E;

const has = (out, re) => re.test(out);

console.log('\n· media_folder/public_folder reach every container, not only a leaf');
const MEDIA = { media_folder: '/up/m', public_folder: '/pub/p' };
const leaf = emitField({ name: 'photo', label: 'Photo', widget: 'image', ...MEDIA }, 4);
check(
  leaf === '    - { name: photo, label: "Photo", widget: image, media_folder: "/up/m", public_folder: "/pub/p" }',
  'a LEAF widget carries the uploads pair inline',
  leaf,
);

const CONTAINERS = {
  'blocks': { name: 'sections', label: 'Sections', widget: 'blocks', ...MEDIA },
  'list with fields': { name: 'items', label: 'Items', widget: 'list', fields: [{ name: 'title', label: 'Title', widget: 'string' }], ...MEDIA },
  'list with field': { name: 'tags', label: 'Tags', widget: 'list', field: { name: 'tag', label: 'Tag', widget: 'string' }, ...MEDIA },
  'object': { name: 'media', label: 'Media', widget: 'object', fields: [{ name: 'image', label: 'Image', widget: 'image' }], ...MEDIA },
};
for (const [shape, f] of Object.entries(CONTAINERS)) {
  const out = emitField(f, 4);
  check(has(out, /^ {6}media_folder: "\/up\/m"$/m), `the ${shape} container emits its own media_folder`, out);
  check(has(out, /^ {6}public_folder: "\/pub\/p"$/m), `the ${shape} container emits its own public_folder`, out);
}
const noMedia = emitField({ name: 'items', label: 'Items', widget: 'list', fields: [{ name: 'title', label: 'Title', widget: 'string' }] }, 4);
check(!/folder/.test(noMedia), 'a container without an uploads path emits no folder line at all', noMedia);

console.log('\n· the gate-card convention');
const gate = (fields, extra = {}) => emitField({ name: 'card', label: 'Card', widget: 'object', fields, ...extra }, 0);
const enabledFirst = [{ name: 'enabled', label: 'On', widget: 'boolean' }, { name: 'text', label: 'Text', widget: 'string' }];
check(has(gate(enabledFirst), /^ {2}collapsed: false$/m), 'an object whose FIRST field is the boolean `enabled` emits collapsed: false');
check(has(gate(enabledFirst, { collapsed: true }), /^ {2}collapsed: false$/m),
  'the gate wins over an explicit collapsed: true — the switch must stay mounted in both UI states');
check(!has(gate([{ name: 'visible', label: 'On', widget: 'boolean' }], { collapsed: true }), /collapsed: false/),
  'a first boolean by any OTHER name is not a gate');
check(!has(gate([{ name: 'enabled', label: 'On', widget: 'string' }], { collapsed: true }), /collapsed: false/),
  'a first field named `enabled` that is not a boolean is not a gate');
check(!has(gate([{ name: 'text', label: 'Text', widget: 'string' }, { name: 'enabled', label: 'On', widget: 'boolean' }], { collapsed: true }), /collapsed: false/),
  '`enabled` in second position is not a gate');
check(has(gate([{ name: 'text', label: 'Text', widget: 'string' }], { collapsed: true }), /^ {2}collapsed: true$/m),
  'an ungated object still honours its own collapsed');

console.log('\n· the blocks widget');
const nestedBlocks = emitField({ name: 'sections', label: 'Sections', widget: 'blocks' }, 0);
check(has(nestedBlocks, /^ {4}- name: hero$/m), 'a nested blocks field offers a plain block');
check(!has(nestedBlocks, /- name: nested$/m), 'a nested blocks field drops block types that themselves contain a blocks field');
const widget = emitWidget(4);
check(has(widget, /^ {8}- name: nested$/m), 'the TOP-LEVEL blocks widget still offers those recursive types');
check(has(widget, /^ {4}- name: blocks$/m) && has(widget, /^ {6}collapsed: true$/m), 'the top-level blocks widget is named `blocks` and starts collapsed');
check((widget.match(/^ {8}- name: /gm) || []).length === AVAILABLE_BLOCKS.length,
  `the top-level widget emits one type per available block (${AVAILABLE_BLOCKS.length})`);
check(has(nestedBlocks, /^ {8}- \{ name: _auto, label: "Auto", widget: hidden \}$/m) && has(widget, /^ {12}- \{ name: _auto, label: "Auto", widget: hidden \}$/m),
  'a block with no fields gets the _auto placeholder in both emitters — Sveltia rejects an empty fields list');

console.log('\n· collapsed-row summaries');
check(listSummary([{ name: 'text' }, { name: 'title' }]) === '{{fields.title}}',
  'the summary follows the priority list, not the field order');
check(listSummary([{ name: 'eyebrow' }, { name: 'heading' }]) === '{{fields.eyebrow}} {{fields.heading}}',
  'an eyebrow prefixes the identifying field');
check(listSummary([{ name: 'colour' }, { name: 'size' }]) === null, 'no candidate field means no summary');
const listed = emitField({ name: 'items', label: 'Items', widget: 'list', fields: [{ name: 'title', label: 'T', widget: 'string' }] }, 0);
check(has(listed, /^ {2}summary: "\{\{fields\.title\}\}"$/m), 'a list of objects gets the derived summary');
const listedExplicit = emitField({ name: 'items', label: 'Items', widget: 'list', summary: '{{fields.custom}}', fields: [{ name: 'title', label: 'T', widget: 'string' }] }, 0);
check(has(listedExplicit, /^ {2}summary: "\{\{fields\.custom\}\}"$/m), 'an explicit summary on the field def wins');
check(!has(emitField({ name: 'items', label: 'Items', widget: 'list', fields: [{ name: 'colour', label: 'C', widget: 'string' }] }, 0), /summary:/),
  'a list with no candidate field emits no summary key');

console.log('\n· select and relation');
const sel = emitField({ name: 'page', label: 'Page', widget: 'select', options: '$pages' }, 0);
check(has(sel, /^ {4}- \{ label: "Home \(\/\)", value: "\/" \}$/m) && has(sel, /^ {4}- \{ label: "About \(\/about\)", value: "\/about" \}$/m),
  'a $-named select resolves its options from OPTION_SOURCES');
check(has(emitField({ name: 'x', label: 'X', widget: 'select', options: '$nope' }, 0), /^ {2}options: \[\]$/m),
  'an unresolvable option source emits an explicit empty list, never a missing options key');
const selMulti = emitField({ name: 'x', label: 'X', widget: 'select', multiple: true, default: ['a', 'b'], options: [{ label: 'A', value: 'a' }] }, 0);
check(has(selMulti, /^ {2}multiple: true$/m) && has(selMulti, /^ {2}default: \["a", "b"\]$/m), 'a multiple select emits an array default in flow style');
const rel = emitField({ name: 'svc', label: 'Service', widget: 'relation', collection: 'services', search_fields: ['title'] }, 0);
check(has(rel, /^ {2}value_field: "\{\{slug\}\}"$/m), 'a relation defaults value_field to {{slug}}');
check(has(rel, /^ {2}search_fields: \["title"\]$/m), 'a relation wraps a single search field in a list');

console.log('\n· nav, buttons and nesting');
const nav = emitField(navLinkField(), 0);
check(has(nav, /^ {2}collapsed: false$/m), 'the nav link object stays expanded — the editor renders it chrome-less inline');
check(has(nav, /^ {4}- name: page$/m) && has(nav, /^ {4}- \{ name: url,/m), 'the nav link object offers both a page picker and a custom URL');
const navLinks = emitNavLinks(0);
check(has(navLinks, /^ {4}- name: menu$/m) && has(navLinks, /^ {8}- \{ label: "Services", value: "services::\/services" \}$/m),
  'the menu field is fed from $menus and keeps the <collectionId>::<routeBase> value intact');
check((navLinks.match(/- name: link$/gm) || []).length === 3, 'items, its sub-links and the CTA all reuse the same nav link object');
const buttons = emitThanksButtons(0);
check(has(buttons, /^- name: button$/m) && has(buttons, /^- name: button2$/m), 'the thanks page emits both buttons');
check((buttons.match(/^ {2}summary: "\{\{fields\.label\}\}"$/gm) || []).length === 2, 'each button collapses to its label');
check(has(emitField(buttonField('cta', 'Button'), 0), /^ {2}required: false$/m), 'a button object is optional');

const nestedObj = emitField({
  name: 'outer', label: 'Outer', widget: 'object',
  fields: [{ name: 'inner', label: 'Inner', widget: 'object', fields: [{ name: 'deep', label: 'Deep', widget: 'string' }] }],
}, 4);
check(has(nestedObj, /^ {4}- name: outer$/m) && has(nestedObj, /^ {8}- name: inner$/m) && has(nestedObj, /^ {12}- \{ name: deep,/m),
  'each object level indents its children by four');
const inTypes = emitWidget(4);
check(has(inTypes, /^ {10}fields:$/m) && has(inTypes, /^ {12}- \{ name: heading,/m), "a block type's fields indent under its own fields: key");
const flow = emitField({ name: 'tags', label: 'Tags', widget: 'list', field: { name: 'tag', label: 'Tag', widget: 'string' } }, 0);
check(has(flow, /^ {2}field: \{ name: tag, label: "Tag", widget: string \}$/m), 'a scalar list emits its item field in flow style on one line');

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ emit-fields unit FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ field-emission DSL intact.');
