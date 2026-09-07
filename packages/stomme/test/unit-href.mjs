#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { resolveLink, resolveButton, withTrailingSlash } = await jiti.import(resolve(PKG, 'src/href.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

console.log('· the trailing-slash rule');
eq(withTrailingSlash('/'), '/', 'the site root stays a bare slash');
eq(withTrailingSlash('/services'), '/services/', 'a rooted path gets the slash');
eq(withTrailingSlash('/services/roof'), '/services/roof/', 'a nested path gets it on the last segment only');
eq(withTrailingSlash('/services/'), '/services/', 'an already-slashed path stays single-slashed');
eq(withTrailingSlash('/en/about'), '/en/about/', 'a locale-prefixed path follows the same rule');
eq(withTrailingSlash('/en'), '/en/', 'and so does the locale front page');
eq(withTrailingSlash('/services?sub=roof'), '/services/?sub=roof', 'the slash goes before a query string');
eq(withTrailingSlash('/services#price'), '/services/#price', 'and before a hash');
eq(withTrailingSlash('/services/?sub=roof'), '/services/?sub=roof', 'a slashed path with a query is left as it is');
eq(withTrailingSlash('/?ref=x'), '/?ref=x', 'the root with a query stays a bare slash');
eq(withTrailingSlash('/sitemap-0.xml'), '/sitemap-0.xml', 'a last segment naming a file is left alone');
eq(withTrailingSlash('/site.webmanifest'), '/site.webmanifest', 'whatever the extension is');
eq(withTrailingSlash('/docs/x.pdf'), '/docs/x.pdf', 'at any depth');
eq(withTrailingSlash('/og/foo.png'), '/og/foo.png', 'a generated share card is a file too');
eq(withTrailingSlash('/blog/calendar.ics?x=1'), '/blog/calendar.ics?x=1', 'a file with a query is still a file');
eq(withTrailingSlash('/v1.2/guide'), '/v1.2/guide/', 'a dot in an earlier segment does not make the path a file');
eq(withTrailingSlash('https://example.test/about'), 'https://example.test/about', 'an absolute URL is left to its own host');
eq(withTrailingSlash('//example.test/about'), '//example.test/about', 'and so is a protocol-relative one');
eq(withTrailingSlash('mailto:a@b.test'), 'mailto:a@b.test', 'a mailto: is untouched');
eq(withTrailingSlash('tel:+15550100'), 'tel:+15550100', 'a tel: is untouched');
eq(withTrailingSlash('sms:+15550100'), 'sms:+15550100', 'an sms: is untouched');
eq(withTrailingSlash('#services'), '#services', 'a pure hash link is untouched');
eq(withTrailingSlash('about'), 'about', 'a relative path is not the engine\'s to root');
eq(withTrailingSlash(''), '', 'an empty href stays empty rather than becoming the site root');
eq(withTrailingSlash(undefined), '', 'a missing href is read as empty');

console.log('\n· resolveLink');
eq(resolveLink(undefined), '/', 'resolveLink() with nothing falls back to the site root');
eq(resolveLink(null, '/contact'), '/contact/', 'an explicit fallback wins over the root default');
eq(resolveLink(''), '/', 'an empty href never renders as href=""');
eq(resolveLink('/legacy/path'), '/legacy/path/', 'a legacy plain-string href resolves, and is slashed like any other');
eq(resolveLink('https://example.test'), 'https://example.test', 'an absolute URL string passes through');
eq(resolveLink({ page: '/about' }), '/about/', 'the link group resolves a picked page');
eq(resolveLink({ page: '/about/' }), '/about/', 'a page already written with a slash is not doubled');
eq(resolveLink({ page: '/about#team' }), '/about/#team', 'a picked page with a hash keeps the hash last');
eq(resolveLink({ url: 'mailto:a@b.test' }), 'mailto:a@b.test', 'the link group resolves a custom URL');
eq(resolveLink({ url: 'https://x.test', page: '/about' }), 'https://x.test', 'the custom url wins over the picked page');
eq(resolveLink({ url: '', page: '/about' }), '/about/', 'an empty custom url falls through to the picked page');
eq(resolveLink({ url: '/files/terms.pdf' }), '/files/terms.pdf', 'a linked file keeps the address it is served on');
eq(resolveLink({}, '/fb'), '/fb/', 'a link group with neither page nor url falls back');
eq(resolveLink(42, '/fb'), '/fb/', 'a non-string, non-object value falls back');

console.log('\n· resolveButton');
eq(resolveButton({ label: 'Buy', link: { url: '/shop' } }), { label: 'Buy', href: '/shop/' },
  'the modern cta group renders label + link');
eq(resolveButton({ label: 'Buy', link: { page: '/shop' } }), { label: 'Buy', href: '/shop/' },
  'the modern cta group resolves a picked page');
eq(resolveButton({ label: 'Buy', link: '/plain' }), { label: 'Buy', href: '/plain/' },
  'a plain-string link inside the modern group still resolves');
eq(resolveButton({ label: 'Jump', link: '#pricing' }), { label: 'Jump', href: '#pricing' },
  'a button pointing at an anchor on the same page is left alone');

eq(resolveButton(undefined, 'Legacy label', '/legacy'), { label: 'Legacy label', href: '/legacy/' },
  'LEGACY: the flat label/href pair still renders when no cta group exists');
eq(resolveButton(null, 'Legacy label', '/legacy'), { label: 'Legacy label', href: '/legacy/' },
  'LEGACY: a null cta group falls back to the flat pair');
eq(resolveButton({ label: 'New' }, 'Legacy label', '/legacy'), { label: 'New', href: '/legacy/' },
  'the group label wins over the legacy label, and the legacy href is still used');
eq(resolveButton({ label: 'New', link: { url: '/new' } }, 'Legacy label', '/legacy'), { label: 'New', href: '/new/' },
  'the group link wins over the legacy href');
eq(resolveButton({ link: { url: '/new' } }, 'Legacy label', '/legacy'), { label: 'Legacy label', href: '/new/' },
  'a group with only a link keeps the legacy label — the two halves migrate independently');

check(resolveButton(undefined, undefined, '/legacy') === null,
  'an href with no label anywhere renders nothing');
check(resolveButton({}, '', '/legacy') === null,
  'an empty-string label does not make a button');
check(resolveButton({ label: '' }, undefined, undefined) === null,
  'a cta group with a blank label renders nothing');
check(resolveButton({ label: 123 }, undefined, '/legacy') === null,
  'a non-string group label is ignored');
check(resolveButton(undefined, 123, '/legacy') === null,
  'a non-string legacy label is ignored');
check(resolveButton('not an object', 'Legacy label', '/legacy')?.label === 'Legacy label',
  'a non-object cta value degrades to the legacy pair instead of throwing');

eq(resolveButton({ label: 'X' }), { label: 'X', href: '/' }, 'a labelled button with no link points at the site root');
eq(resolveButton({ label: 'X' }, undefined, undefined, '/contact'), { label: 'X', href: '/contact/' },
  'the caller-supplied fallback is used when nothing else resolves');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} href checks passed`);
if (failed) { console.error('\n✗ href unit tests FAILED'); process.exit(1); }
