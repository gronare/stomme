#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { themeStyle, nightStyle } = await jiti.import(resolve(PKG, 'src/theme.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const day = { brand: '#a8501f', ink: '#1c1c1a', onDark: '#ffffff', surface: '#ffffff', paper: '#f4f3ef', line: '#e2e0d8', highlight: '#cba6f7', eyebrowColor: 'brand' };

check(themeStyle(day) === '--color-brand:#a8501f;--color-ink:#1c1c1a;--color-on-dark:#ffffff;--color-surface:#ffffff;--color-paper:#f4f3ef;--color-line:#e2e0d8;--color-highlight:#cba6f7;--eyebrow-accent:var(--color-brand)',
  'the inline day palette keeps the order and shape the layouts wrote before the helper', themeStyle(day));
check(themeStyle({ ...day, muted: '#666', secondary: '#09f', dark: '#111', eyebrowColor: 'secondary' }, ['--font-sans:x']).endsWith('--color-secondary:#09f;--eyebrow-accent:var(--color-secondary);--color-dark:#111;--font-sans:x'),
  'optional colours and font variables are appended only when set');
check(nightStyle(day) === null, 'a theme without scheme: auto writes no night stylesheet, so a light site renders exactly as before');
check(nightStyle({ ...day, scheme: 'light', nightBrand: '#f0a070' }) === null, 'night colours alone do not switch a light theme to dark');
const night = nightStyle({ ...day, scheme: 'auto', nightBrand: '#f0a070', nightPaper: '#141417' });
const nightVars = '--color-brand:#f0a070 !important;--color-paper:#141417 !important;color-scheme:dark';
check(night && night.includes(`@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${nightVars}}}`),
  'with no choice made, the night palette follows a dark system and overrides the inline day palette', night);
check(night && night.includes(`:root[data-theme="dark"]{${nightVars}}`) && !/@media[^{]*\{[^}]*\[data-theme="dark"\]/.test(night),
  'a visitor who chose dark gets the night palette outside the media query, so it wins over a light system', night);
check(night && night.includes(':root[data-theme="light"]{color-scheme:light}') && !/\[data-theme="light"\]\{[^}]*--color-/.test(night),
  'a visitor who chose light is excluded from the dark-system rule and keeps the inline day palette', night);
check(night && night.startsWith(':root{color-scheme:light dark}'), 'an auto theme declares both colour schemes so form controls follow');
const hostile = nightStyle({ ...day, scheme: 'auto', nightInk: 'red}</style><script>alert(1)</script>' });
check(hostile && !hostile.includes('<') && !hostile.includes('}<'), 'a night colour cannot close the style element or the rule', hostile);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} theme checks passed`);
if (failed) process.exit(1);
