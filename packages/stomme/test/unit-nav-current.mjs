#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { normalizeNavPath, currentNavPath } = await jiti.import(resolve(PKG, 'src/nav-current.ts'));
const { resolveLocales, splitLocalePath } = await jiti.import(resolve(PKG, 'src/i18n.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

eq(normalizeNavPath('/news/'), '/news', 'a trailing slash never decides a match');
eq(normalizeNavPath(''), '/', 'an empty path is the front page');
eq(normalizeNavPath('/'), '/', 'the front page normalizes to itself');
eq(normalizeNavPath('/news?page=2#top'), '/news', 'a query and a fragment are not part of the path');

const NAV = ['/', '/news', '/services', '/contact'];
eq(currentNavPath('/news', NAV), '/news', 'the exact page marks its own item');
eq(currentNavPath('/news/spring-cleaning', NAV), '/news', 'an entry under a section marks the section');
eq(currentNavPath('/news/2026/spring', NAV), '/news', 'the section still owns a page two segments down');
eq(currentNavPath('/newsroom', NAV), '', 'a longer word starting with the item path is a different page, not a child');
eq(currentNavPath('/news-archive', NAV), '', 'the prefix has to end on a segment boundary');
eq(currentNavPath('/', NAV), '/', 'the front page marks the front-page item');
eq(currentNavPath('/anything', NAV), '', 'the front-page item never claims the pages beneath it');
eq(currentNavPath('/about', NAV), '', 'a page no item points at leaves the nav unmarked');

const NESTED = ['/', '/services', '/services/roofing', '/services/roofing/flat'];
eq(currentNavPath('/services/roofing/gutters', NESTED), '/services/roofing', 'when several items match, the deepest one wins');
eq(currentNavPath('/services/roofing/flat', NESTED), '/services/roofing/flat', 'an exact deep hit beats both its ancestors');
eq(currentNavPath('/services/painting', NESTED), '/services', 'the nearest ancestor takes a page no deeper item owns');

eq(currentNavPath('/news', ['', '/news']), '/news', 'an item with no link is skipped rather than matching everything');
eq(currentNavPath('/news', ['https://example.com/news']), '', 'an external link never marks a page of this site');

const locales = resolveLocales({ locales: ['sv', 'en'] });
const strip = (p) => splitLocalePath(p, locales).path;
const LOCALIZED = ['/en', '/en/news', '/en/contact'].map(strip);
eq(currentNavPath(strip('/en/news/one'), LOCALIZED), '/news', 'the locale prefix is stripped from both sides before comparing');
eq(currentNavPath(strip('/en'), LOCALIZED), '/', 'a locale front page marks the front-page item, not every item');
eq(currentNavPath(strip('/en/news'), LOCALIZED), '/news', 'a localized section page marks its own item');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} nav-current checks pass`);
if (failed) { console.error('\n✗ nav-current units FAILED'); process.exit(1); }
