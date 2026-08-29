#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEME_CSS } from '../src/admin-theme.mjs';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(PKG, p), 'utf8');
const results = [];
const check = (ok, name, detail = '') => {
  results.push([!!ok, name]);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const css = THEME_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('· the stylesheet itself');
check(typeof THEME_CSS === 'string' && THEME_CSS.length > 2000, `THEME_CSS is a ${THEME_CSS.length}-character stylesheet`);
check((css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length,
  'braces balance — a stray one would ship a stylesheet the browser truncates',
  `${(css.match(/\{/g) || []).length} open vs ${(css.match(/\}/g) || []).length} close`);
check(!/\$\{/.test(THEME_CSS) && !/undefined/.test(THEME_CSS), 'no unresolved placeholder or undefined constant survives into the emitted CSS');

console.log('\n· the custom-property blocks stay !important');
const propRules = [...css.matchAll(/((?::root|:host)[^{}]*)\{([^{}]*)\}/g)]
  .map(([, sel, body]) => ({ sel: sel.trim(), decls: body.split(';').map((d) => d.trim()).filter((d) => d.startsWith('--sui-')) }))
  .filter((r) => r.decls.length);
const declCount = propRules.reduce((n, r) => n + r.decls.length, 0);
check(propRules.length >= 4, `${propRules.length} :root/:host rules declare Sveltia custom properties`, propRules.map((r) => r.sel).join('\n    '));
check(declCount >= 30, `they carry ${declCount} custom-property declarations between them`);
const weak = propRules.flatMap((r) => r.decls.filter((d) => !/!important$/.test(d)).map((d) => `${r.sel} → ${d}`));
check(weak.length === 0,
  'every custom property is !important — Sveltia injects its own :root,:host{--sui-…} at runtime AFTER this sheet, so an equal-specificity later rule would otherwise win',
  weak.join('\n    '));

console.log('\n· all three theme states are covered');
const selectors = propRules.map((r) => r.sel);
check(selectors.some((s) => /^:root, :host,/.test(s) && s.includes('[data-theme=light]')),
  'the light ramp covers bare :root/:host and the explicit light toggle in one rule', selectors.join(' | '));
check(selectors.some((s) => /^:root\[data-theme=dark\]/.test(s)), "the dark ramp answers Sveltia's own dark toggle");
check(/@media \(prefers-color-scheme: dark\) \{[^{}]*:root:not\(\[data-theme=light\]\)/.test(css),
  'a prefers-color-scheme fallback covers the untouched "system" state without overriding an explicit light choice');
for (const prop of ['--sui-background-color-1-hsl', '--sui-primary-accent-color']) {
  const rules = propRules.filter((r) => r.decls.some((d) => d.startsWith(`${prop}:`)));
  check(rules.length >= 3, `${prop} is defined for light, dark and system`, rules.map((r) => r.sel).join(' | '));
}
check(propRules.some((r) => r.decls.some((d) => /^--sui-base-hue:/.test(d))), 'the brand hue is a single custom property a site can re-point');

console.log('\n· the gate card agrees with the field emitter');
const gateRule = css.match(/section\.field\[data-field-type=object\][^{]*data-field-type=boolean[^{]*\{/);
check(!!gateRule, 'the theme detects a gate card structurally, from the shape of its first child field');
const cssKey = css.match(/\[data-field-type=boolean\]\[data-key-path\$="\.(\w+)"\]/);
const cssFirst = /\[data-key-path\$="\.\w+"\]:first-child/.test(css);
const emit = read('src/emit-fields.mjs');
const emitKey = emit.match(/f\.fields\[0\]\?\.widget === '(\w+)' && f\.fields\[0\]\?\.name === '(\w+)'/);
check(!!cssKey && !!emitKey && cssKey[1] === emitKey[2],
  `both sides name the gate field '${cssKey ? cssKey[1] : '?'}' — rename it in one file and the switch-card styling silently reverts to a plain object`,
  `css=${cssKey && cssKey[1]} emitter=${emitKey && emitKey[2]}`);
check(!!emitKey && emitKey[1] === 'boolean' && /\[data-field-type=boolean\]/.test(css), 'both sides require the gate field to be a boolean');
check(cssFirst, 'the CSS requires the gate boolean to be the FIRST child, exactly as the emitter does');
check(/section\.field\[data-field-type=object\]:not\(\[data-key-path="og"\]\):has\(/.test(css),
  'the og wrapper is excluded from the gate treatment');
check(/\.stomme-open/.test(css) && /:not\(\.stomme-open\)/.test(css),
  'open and closed are driven by the .stomme-open class, not by Sveltia disclosure — so the switch stays mounted in both states');

console.log('\n· every class the editor applies is styled');
const applied = [...new Set([
  ...[...read('admin/editor.js').matchAll(/classList\.(?:add|toggle)\('(stomme-[a-z-]+)'/g)].map((m) => m[1]),
  ...[...read('admin/editor.js').matchAll(/className = '(stomme-[a-z-]+)'/g)].map((m) => m[1]),
])];
check(applied.includes('stomme-open'), `admin/editor.js applies ${applied.length} stomme-* classes, the gate card's stomme-open among them`, applied.join(', '));
for (const cls of applied) check(css.includes(`.${cls}`), `.${cls} has a rule in THEME_CSS`);

console.log('\n· the shell ships and cache-busts this exact string');
const shell = read('src/admin-shell.mjs');
check(/THEME_CSS\.charCodeAt\(i\)/.test(shell) && /stomme-theme\.css\?v=\$\{\(th >>> 0\)/.test(shell),
  'the theme link is cache-busted with a hash of THEME_CSS itself — an edit here reaches every open browser');
check(/writeFileSync\(resolve\(root, 'public\/admin\/stomme-theme\.css'\), THEME_CSS\)/.test(shell),
  'THEME_CSS is written verbatim to public/admin/stomme-theme.css');

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ admin-theme unit FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ admin theme intact.');
