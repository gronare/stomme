#!/usr/bin/env node
import { createJiti } from 'jiti';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const kit = await jiti.import(resolve(PKG, 'src/kit.ts'));
const { ICON_NAMES } = await jiti.import(resolve(PKG, 'src/icons.ts'));
const { defaultBlocks } = await jiti.import(resolve(PKG, 'catalog.ts'));
const kitSource = readFileSync(resolve(PKG, 'src/kit.ts'), 'utf8');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const walk = (fields, out = []) => {
  for (const f of fields ?? []) {
    out.push(f);
    if (f.fields) walk(f.fields, out);
    if (f.field) walk([f.field], out);
  }
  return out;
};

// ── linkField ───────────────────────────────────────────────────────────────
const link = kit.linkField();
eq([link.name, link.widget, link.collapsed], ['href', 'object', false],
  'linkField is a collapsed:false object — the editor theme renders page + url side by side, not behind an "Add …" step');
check(!('required' in link),
  'linkField stays required so its children mount inline; a required:false object would render as an "Add" button');
eq(link.fields.map((f) => f.name), ['page', 'url'], 'linkField offers a page picker then a custom URL');
check(link.fields.every((f) => f.required === false),
  'both children are optional, so a link nobody filled in leaves the key absent rather than storing an empty group');
eq(link.fields[0].options, '$pages', 'the page picker is fed by the $pages option source');
eq(kit.linkField('link', 'Destination').name, 'link', 'linkField takes the field name from its caller');

// ── buttonField ─────────────────────────────────────────────────────────────
const btn = kit.buttonField('cta');
eq([btn.name, btn.widget, btn.required, btn.collapsed, btn.summary], ['cta', 'object', false, true, '{{fields.label}}'],
  'buttonField is an optional collapsed object summarised by its label');
eq(btn.fields.map((f) => f.name), ['label', 'link'], 'a button is a label plus a link group');
eq(btn.fields[1], kit.linkField('link', 'Link'), 'the button link is the same link group as everywhere else');
check(!('required' in btn.fields[0]), 'the button label is required by default — a button with no label renders nothing');
check(kit.buttonField('cta', 'Link', { optionalLabel: true }).fields[0].required === false,
  'optionalLabel makes the label optional for buttons that fall back to a default label');
check(!('hint' in btn) && !('hint' in btn.fields[0]),
  'no hint keys are emitted when none were passed — undefined keys would reach the generated CMS config');
eq(kit.buttonField('cta', 'Link', { hint: 'H', labelHint: 'L' }).hint, 'H', 'a supplied hint lands on the group');
eq(kit.buttonField('cta', 'Link', { hint: 'H', labelHint: 'L' }).fields[0].hint, 'L', 'a supplied labelHint lands on the label');

// ── icon / image ────────────────────────────────────────────────────────────
eq(kit.iconField().options.map((o) => o.value), ICON_NAMES,
  'iconField offers every icon in ICONS, in the same order — the record order is the picker order');
check(kit.iconField().options.every((o) => o.label === o.value), 'each icon option is labelled by its own name');
eq(kit.iconField().required, false, 'an icon is always optional');

const img = kit.imageField();
check(!('media_folder' in img) && !('public_folder' in img),
  'imageField sets no field-level media folder — uploads must go through the generator\'s collection-level folders');
eq(kit.imageField('logo', 'Logo', 'Hint').hint, 'Hint', 'imageField passes a hint through');
check(!('hint' in kit.imageField()), 'imageField emits no hint key when none was given');

// ── groups ──────────────────────────────────────────────────────────────────
const g = kit.group('x', 'X', 'why', []);
eq([g.widget, g.collapsed], ['object', true], 'a group is a collapsed object');
eq(kit.mediaGroup('hint', []).name, 'media', 'the media group is always called media');
eq(kit.layoutGroup([]).name, 'layout', 'the layout group is always called layout');
eq(kit.layoutGroup([]).label, 'Layout', 'the layout group carries the same label in every block');
eq(kit.styleGroup().name, 'style', 'the style group is always called style');
eq(kit.styleGroup().fields, [kit.surfaceField, kit.accentField],
  'styleGroup defaults to the surface + accent pair');
eq(kit.styleGroup([kit.widthField]).fields, [kit.widthField],
  'a block that renders only one style control passes the subset it uses');
check(!('summary' in kit.mediaGroup('hint', [])), 'mediaGroup emits no summary key unless one is given');
eq(kit.mediaGroup('hint', [], '{{fields.image}}').summary, '{{fields.image}}', 'mediaGroup takes an optional summary');

for (const f of [kit.surfaceField, kit.accentField, kit.widthField]) {
  const values = f.options.map((o) => o.value);
  check(values.length === new Set(values).size && values.every(Boolean), `${f.name} offers distinct, non-empty option values`);
  check(values.includes(f.default), `${f.name}'s default '${f.default}' is one of its own options`);
  check(f.required === false, `${f.name} is optional — a block that never sets it still renders`);
}

// ── subpages ────────────────────────────────────────────────────────────────
const subpages = defaultBlocks.find((b) => b.type === 'subpages');
const subField = (name) => walk(subpages.fields).find((f) => f.name === name);
check(!!subpages, 'the catalog ships a subpages block');
eq([subpages.group, subpages.collection], ['From collections', 'pages'],
  'subpages sits with the other from-collections blocks and is gated on the pages collection');
eq(subpages.fields.map((f) => f.name), ['eyebrow', 'heading', 'intro', 'pages', 'layout', 'media', 'style'],
  'subpages declares the heading fields, a page picker, layout, media and the style group');
eq([subField('pages').options, subField('pages').multiple, subField('pages').required], ['$pages', true, false],
  'the page picker is a multiple $pages select nobody has to fill in');
eq(subField('variant').options.map((o) => o.value), ['cards', 'tiles', 'rows', 'chips', 'siblings'],
  'the five variants the block renders are the five the editor can pick');
eq(subField('variant').default, 'cards', 'a block nobody configured renders the photo cards');
eq(subField('columns').widget, 'number', 'columns is a number field like every other block, so a stored 2 is never drift against a list of strings');
eq(subField('columns').default, 2, 'the column count defaults to two');
check(subField('variant').options.every((o) => o.label && o.label !== o.value),
  'every variant is named in words, not by its stored value');
eq(subField('showImages').default, true, 'the cover images are on for a block the editor adds today');
check(subpages.samples.length >= 2 && subpages.samples.every((x) => Array.isArray(x.items) && x.items.length),
  'the lookbook has sample pages to draw, since the block cannot read a page there');

// ── the Field/BlockDef shape, across the whole catalog ───────────────────────
const WIDGETS = new Set([...kitSource.slice(kitSource.indexOf('widget:'), kitSource.indexOf(';', kitSource.indexOf('widget:'))).matchAll(/'([a-z]+)'/g)].map((m) => m[1]));
check(WIDGETS.size >= 10, `the Field type declares ${WIDGETS.size} widgets`, [...WIDGETS].join(', '));

const allFields = defaultBlocks.flatMap((b) => walk(b.fields));
check(defaultBlocks.length > 0 && allFields.length > 0, `the catalog ships ${defaultBlocks.length} blocks and ${allFields.length} fields`);
check(defaultBlocks.every((b) => b.type && b.label && Array.isArray(b.fields)),
  'every block has a type, a label and a field list',
  defaultBlocks.filter((b) => !(b.type && b.label && Array.isArray(b.fields))).map((b) => b.type).join(', '));
check(new Set(defaultBlocks.map((b) => b.type)).size === defaultBlocks.length,
  'block types are unique — a duplicate would shadow the earlier block in the CMS');
check(allFields.every((f) => f.name && f.label && f.widget),
  'every field has a name, a label and a widget',
  allFields.filter((f) => !(f.name && f.label && f.widget)).map((f) => f.name || '(unnamed)').join(', '));
check(allFields.every((f) => WIDGETS.has(f.widget)),
  'every field uses a widget the Field type declares',
  [...new Set(allFields.filter((f) => !WIDGETS.has(f.widget)).map((f) => `${f.name}:${f.widget}`))].join(', '));
check(allFields.every((f) => !f.media_folder && !f.public_folder),
  'no block field sets its own media folder',
  allFields.filter((f) => f.media_folder || f.public_folder).map((f) => f.name).join(', '));

const styled = defaultBlocks.filter((b) => b.fields.some((f) => f.name === 'style'));
const styleNotLast = styled.filter((b) => b.fields[b.fields.length - 1].name !== 'style').map((b) => b.type);
check(styled.length > 20 && styleNotLast.length === 0,
  `the style group is the last field in all ${styled.length} blocks that have one`, styleNotLast.join(', '));

const GROUP_SHAPE = { media: ['Media', true], layout: ['Layout', true], style: ['Appearance', true] };
const groupDrift = [];
for (const b of defaultBlocks) {
  for (const f of b.fields) {
    const want = GROUP_SHAPE[f.name];
    if (!want) continue;
    if (f.widget !== 'object' || f.label !== want[0] || f.collapsed !== want[1]) groupDrift.push(`${b.type}.${f.name}`);
  }
}
check(groupDrift.length === 0,
  'the Media / Layout / Style groups carry the same label and collapsed state in every block', groupDrift.join(', '));

// FIELD POLICY: a new field is opt-in, so it must never get an `x !== false` fallback in the renderer.
const RENDER_DIRS = ['blocks', 'chrome', 'routes', 'src'];
const { execFileSync } = await import('node:child_process');
const grep = execFileSync('grep', ['-rn', '--', '!== false', ...RENDER_DIRS], { cwd: PKG, encoding: 'utf8' })
  .split('\n').filter(Boolean).filter((l) => !l.startsWith('src/kit.ts:'));
check(grep.length <= 3,
  `only ${grep.length} legacy \`x !== false\` fallbacks remain — a new one makes an opt-in field render as on while the editor shows it off`,
  grep.join('\n    '));

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} kit checks passed`);
if (failed) { console.error('\n✗ kit unit tests FAILED'); process.exit(1); }
