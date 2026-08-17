#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CSS = resolve(here, '../styles.css');
const BASELINE = resolve(here, 'styles-colors.baseline.json');
const UPDATE = process.argv.includes('--update');

const src = readFileSync(CSS, 'utf8');

let css = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
css = css.replace(/:root\s*{[^}]*}/g, (m) => m.replace(/[^\n]/g, ' '));

const RE = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/g;

const found = new Map();
const lines = css.split('\n');
lines.forEach((line, i) => {
  for (const m of line.matchAll(RE)) {
    const lit = m[0].replace(/\s+/g, '').toLowerCase();
    const e = found.get(lit) ?? { count: 0, lines: [] };
    e.count++;
    if (e.lines.length < 3) e.lines.push(i + 1);
    found.set(lit, e);
  }
});

const current = Object.fromEntries([...found.entries()].sort().map(([k, v]) => [k, v.count]));

if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  console.log(`baseline updated — ${Object.keys(current).length} distinct literals, ${Object.values(current).reduce((a, b) => a + b, 0)} uses`);
  process.exit(0);
}

let baseline = {};
try { baseline = JSON.parse(readFileSync(BASELINE, 'utf8')); }
catch { console.error(`no baseline at ${BASELINE} — run with --update to create it`); process.exit(1); }

const added = [];
const removed = [];
for (const [lit, count] of Object.entries(current)) {
  const base = baseline[lit] ?? 0;
  if (count > base) added.push({ lit, count, base, lines: found.get(lit).lines });
}
for (const [lit, base] of Object.entries(baseline)) {
  if ((current[lit] ?? 0) < base) removed.push({ lit, base, count: current[lit] ?? 0 });
}

if (removed.length) {
  console.log(`ratchet can tighten (${removed.length} literal(s) reduced/removed) — run --update to lock it in:`);
  for (const r of removed) console.log(`  ${r.lit}  ${r.base} → ${r.count}`);
}

if (added.length) {
  console.error(`\n✗ NEW hardcoded color(s) outside :root — themes can't recolor these:\n`);
  for (const a of added) {
    console.error(`  ${a.lit}  ${a.base} → ${a.count}  (styles.css:${a.lines.join(',')}${a.count > a.lines.length ? ',…' : ''})`);
  }
  console.error(`\nPrefer a :root token or color-mix(in srgb, var(--color-…) …). If the literal is`);
  console.error(`genuinely theme-independent (a shadow, a scrim), accept it: bin/lint-styles.mjs --update`);
  process.exit(1);
}

console.log(`✓ no new hardcoded colors (${Object.keys(current).length} baselined literals unchanged)`);
