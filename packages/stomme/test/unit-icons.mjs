#!/usr/bin/env node
import { createJiti } from 'jiti';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { ICONS, ICON_NAMES, FALLBACK_ICON } = await jiti.import(resolve(PKG, 'src/icons.ts'));
const source = readFileSync(resolve(PKG, 'src/icons.ts'), 'utf8');
const wrapper = readFileSync(resolve(PKG, 'src/Icon.astro'), 'utf8');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const entries = Object.entries(ICONS);
check(entries.length > 40, `the icon set ships ${entries.length} glyphs`);

// Record order IS the CMS picker order, so ICON_NAMES must never be sorted or filtered on its way out.
const sourceOrder = [...source.matchAll(/^ {2}([a-z][a-z0-9-]*):\s*'</gm)].map((m) => m[1]);
check(sourceOrder.length === ICON_NAMES.length && sourceOrder.every((n, i) => n === ICON_NAMES[i]),
  'ICON_NAMES lists the glyphs in declaration order — record order is the CMS picker order',
  `source ${sourceOrder.length} vs exported ${ICON_NAMES.length}`);
check(sourceOrder.length === new Set(sourceOrder).size,
  'no icon name is declared twice — a duplicate key would silently overwrite the first glyph',
  `${sourceOrder.length} declarations, ${new Set(sourceOrder).size} distinct`);
check(ICON_NAMES.every((n) => /^[a-z][a-z0-9-]*$/.test(n)),
  'every icon name is a lowercase slug — the name is the stored CMS value',
  ICON_NAMES.filter((n) => !/^[a-z][a-z0-9-]*$/.test(n)).join(', '));

check(FALLBACK_ICON in ICONS, `FALLBACK_ICON '${FALLBACK_ICON}' resolves to a real glyph`);
check(wrapper.includes(`ICONS[name] ?? ICONS[FALLBACK_ICON]`),
  'Icon.astro still falls back to FALLBACK_ICON for an unknown name');

// A value is INNER markup only: the wrapper owns the svg element and every paint attribute.
const withSvg = entries.filter(([, v]) => /<\/?svg\b/.test(v)).map(([n]) => n);
check(withSvg.length === 0, 'no glyph carries its own <svg> element — the value is inner markup', withSvg.join(', '));

const PAINT = /\b(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|class|style|viewBox)=/;
const painted = entries.filter(([, v]) => PAINT.test(v)).map(([n]) => n);
check(painted.length === 0, 'no glyph sets its own paint attributes — the wrapper supplies fill/stroke/width/caps', painted.join(', '));

for (const attr of ['fill="none"', 'stroke="currentColor"', 'stroke-width="2"', 'stroke-linecap="round"', 'viewBox="0 0 24 24"']) {
  check(wrapper.includes(attr), `Icon.astro's wrapper supplies ${attr}`);
}

const ALLOWED = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
const badEl = [];
const unclosed = [];
for (const [name, v] of entries) {
  for (const m of v.matchAll(/<([a-z]+)\b([^>]*)>/g)) {
    if (!ALLOWED.has(m[1])) badEl.push(`${name}:<${m[1]}>`);
    if (!m[2].trimEnd().endsWith('/')) unclosed.push(`${name}:<${m[1]}>`);
  }
}
check(badEl.length === 0, 'every glyph is built from plain SVG shape elements', badEl.join(', '));
check(unclosed.length === 0, 'every element self-closes — set:html inserts the markup raw, unbalanced tags break the page', unclosed.join(', '));

const outOfBox = [];
for (const [name, v] of entries) {
  for (const m of v.matchAll(/\b(cx|cy|x|y|r|width|height)="(-?[\d.]+)"/g)) {
    const n = Number(m[2]);
    if (!(n >= 0 && n <= 24)) outOfBox.push(`${name}:${m[1]}=${m[2]}`);
  }
  for (const m of v.matchAll(/\sd="([^"]*)"/g)) {
    for (const num of m[1].match(/-?\d+(?:\.\d+)?/g) ?? []) {
      if (Math.abs(Number(num)) > 24) outOfBox.push(`${name}:d ${num}`);
    }
  }
}
check(outOfBox.length === 0, 'every coordinate stays inside the 24×24 box the wrapper declares', outOfBox.join(', '));

const empty = entries.filter(([, v]) => !v.trim()).map(([n]) => n);
check(empty.length === 0, 'no glyph is empty', empty.join(', '));

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} icon checks passed`);
if (failed) { console.error('\n✗ icon unit tests FAILED'); process.exit(1); }
