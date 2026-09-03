#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { pagePaths, pagePath, pageByPath, pageChildren, pageTrail, pageTitle, normalizePagePath, writtenPages } =
  await jiti.import(resolve(PKG, 'src/pages.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push([!!ok, name]);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
const throws = (fn, re, name) => {
  try { fn(); } catch (e) { return check(re.test(e.message), name, e.message); }
  check(false, name, 'nothing was thrown');
};

const page = (id, data = {}) => ({ id, data: { title: id, published: true, ...data } });

console.log('· a page with no parent keeps the address it has today');
const FLAT = [page('about'), page('contact'), page('guider/vinter')];
eq([...pagePaths(FLAT)], [['about', '/about'], ['contact', '/contact'], ['guider/vinter', '/guider/vinter']],
  'every page without a parent answers on its own file name');
eq(pagePath(page('about'), FLAT), '/about', 'pagePath reads the same map for one entry');
eq(pagePath(page('lonely'), []), '/lonely', 'a page nobody listed still resolves to its own name');

console.log('· a parent nests the address');
const TREE = [
  page('salja-foretag'),
  page('generationsskifte', { parent: '/salja-foretag', order: 2 }),
  page('vardering', { parent: '/salja-foretag', order: 1 }),
  page('checklista', { parent: '/salja-foretag/generationsskifte' }),
  page('kontakt'),
];
const PATHS = pagePaths(TREE);
eq(PATHS.get('generationsskifte'), '/salja-foretag/generationsskifte', 'a child sits under its parent');
eq(PATHS.get('checklista'), '/salja-foretag/generationsskifte/checklista', 'and a grandchild under both');
eq(PATHS.get('kontakt'), '/kontakt', 'a sibling without a parent is untouched');
eq(pagePaths([page('a'), page('b', { parent: 'a/' })]).get('b'), '/a/b',
  'a parent written without the leading slash, or with a trailing one, still names the same page');

console.log('· children of a page');
eq(pageChildren('/salja-foretag', TREE).map((p) => p.id), ['vardering', 'generationsskifte'],
  'children are sorted by order, lowest first');
eq(pageChildren('/salja-foretag/', TREE).map((p) => p.id), ['vardering', 'generationsskifte'],
  'a trailing slash on the path asks the same question');
eq(pageChildren('/kontakt', TREE).map((p) => p.id), [], 'a page with no children answers with none');
eq(pageChildren('/', TREE).map((p) => p.id), ['kontakt', 'salja-foretag'], 'the top level is the children of /, in the same order the sorting gives every other level');
const SAME_ORDER = [
  page('root'),
  page('beta', { parent: '/root', order: 1, title: 'Beta' }),
  page('alfa', { parent: '/root', order: 1, title: 'Alfa' }),
  page('gamma', { parent: '/root', title: 'Gamma' }),
];
eq(pageChildren('/root', SAME_ORDER).map((p) => p.id), ['gamma', 'alfa', 'beta'],
  'a missing order counts as 0, and pages sharing an order fall back to their title');
eq(pageChildren('/root', [...SAME_ORDER, page('hemlig', { parent: '/root', published: false })]).map((p) => p.id),
  ['gamma', 'alfa', 'beta'], 'an unpublished page is no child — the pages route would not build it');

console.log('· the trail up to a page');
eq(pageTrail(TREE[3], TREE).map((s) => [s.entry.id, s.path]),
  [['salja-foretag', '/salja-foretag'], ['generationsskifte', '/salja-foretag/generationsskifte']],
  'the trail lists the ancestors from the top down, the page itself left out');
eq(pageTrail(TREE[0], TREE), [], 'a top-level page has no trail at all');
eq(pageTrail(page('nested', { parent: '/salja-foretag' }), TREE).map((s) => s.entry.id), ['salja-foretag'],
  'the trail of a page the list does not carry still resolves');

console.log('· looking a page up by its address');
eq(pageByPath('/salja-foretag/generationsskifte', TREE)?.id, 'generationsskifte', 'a nested address finds its page');
eq(pageByPath('/salja-foretag/generationsskifte/', TREE)?.id, 'generationsskifte', 'a trailing slash finds the same one');
eq(pageByPath('/nothing-here', TREE), undefined, 'an address no page answers on finds nothing');
eq(normalizePagePath('salja-foretag/'), '/salja-foretag', 'a path is normalised to one leading slash and no trailing one');
eq(pageTitle(page('x', { title: '' })), 'x', 'a page with no title falls back to its file name');

console.log('· a parent that cannot be resolved fails the build, naming the files');
throws(() => pagePaths([page('a'), page('orphan', { parent: '/gone' })]),
  /orphan\.md.*parent: \/gone.*no page at that address/s,
  'an unknown parent throws, naming the file and the value it carries');
throws(() => pagePaths([page('loop', { parent: '/loop' })]),
  /loop\.md names itself/,
  'a page that names itself as its parent throws');
throws(() => pagePaths([page('a', { parent: '/b' }), page('b', { parent: '/a' })]),
  /run in a circle.*a\.md.*b\.md/s,
  'a cycle throws, naming every file in it');
throws(() => pagePaths([page('a'), page('b', { parent: '/a' }), page('c', { parent: '/b' })]),
  /c\.md names `parent: \/b`, but .*b\.md now answers on \/a\/b/s,
  'a parent value left behind when its page moved throws rather than nesting the child in the wrong place');
eq([...pagePaths([page('a'), page('b', { parent: '/a' }), page('c', { parent: '/a/b' })])].map(([, v]) => v),
  ['/a', '/a/b', '/a/b/c'], 'a two-level chain resolves, and is no cycle');

console.log('· the entries a language wrote are not pages of their own');
const TWINS = [page('omradet'), page('omradet.en'), page('omradet.no'), page('guiden', { parent: '/omradet' }), page('guiden.en', { parent: '/omradet' })];
eq(writtenPages(TWINS).map((p) => p.id), ['omradet', 'guiden'],
  'a translation beside its page is dropped, so a listing counts each page once');
eq(writtenPages([page('plan'), page('plan.b')]).map((p) => p.id), ['plan', 'plan.b'],
  'a page whose name merely ends in a dotted segment is no translation');
eq(writtenPages([page('kontakt.en')]).map((p) => p.id), ['kontakt.en'],
  'and neither is one with no untranslated sibling beside it');
eq(pageChildren('/omradet', writtenPages(TWINS)).map((p) => p.id), ['guiden'],
  'the children of a page are the pages, not their translations');

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ pages unit FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ page paths intact.');
