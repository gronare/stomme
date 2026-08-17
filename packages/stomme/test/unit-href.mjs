#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { resolveLink, resolveButton } = await jiti.import(resolve(PKG, 'src/href.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

eq(resolveLink(undefined), '/', 'resolveLink() with nothing falls back to the site root');
eq(resolveLink(null, '/contact'), '/contact', 'an explicit fallback wins over the root default');
eq(resolveLink(''), '/', 'an empty href never renders as href=""');
eq(resolveLink('/legacy/path'), '/legacy/path', 'a legacy plain-string href still resolves unchanged');
eq(resolveLink('https://example.test'), 'https://example.test', 'an absolute URL string passes through');
eq(resolveLink({ page: '/about' }), '/about', 'the link group resolves a picked page');
eq(resolveLink({ url: 'mailto:a@b.test' }), 'mailto:a@b.test', 'the link group resolves a custom URL');
eq(resolveLink({ url: 'https://x.test', page: '/about' }), 'https://x.test', 'the custom url wins over the picked page');
eq(resolveLink({ url: '', page: '/about' }), '/about', 'an empty custom url falls through to the picked page');
eq(resolveLink({}, '/fb'), '/fb', 'a link group with neither page nor url falls back');
eq(resolveLink(42, '/fb'), '/fb', 'a non-string, non-object value falls back');

eq(resolveButton({ label: 'Buy', link: { url: '/shop' } }), { label: 'Buy', href: '/shop' },
  'the modern cta group renders label + link');
eq(resolveButton({ label: 'Buy', link: { page: '/shop' } }), { label: 'Buy', href: '/shop' },
  'the modern cta group resolves a picked page');
eq(resolveButton({ label: 'Buy', link: '/plain' }), { label: 'Buy', href: '/plain' },
  'a plain-string link inside the modern group still resolves');

eq(resolveButton(undefined, 'Legacy label', '/legacy'), { label: 'Legacy label', href: '/legacy' },
  'LEGACY: the flat label/href pair still renders when no cta group exists');
eq(resolveButton(null, 'Legacy label', '/legacy'), { label: 'Legacy label', href: '/legacy' },
  'LEGACY: a null cta group falls back to the flat pair');
eq(resolveButton({ label: 'New' }, 'Legacy label', '/legacy'), { label: 'New', href: '/legacy' },
  'the group label wins over the legacy label, and the legacy href is still used');
eq(resolveButton({ label: 'New', link: { url: '/new' } }, 'Legacy label', '/legacy'), { label: 'New', href: '/new' },
  'the group link wins over the legacy href');
eq(resolveButton({ link: { url: '/new' } }, 'Legacy label', '/legacy'), { label: 'Legacy label', href: '/new' },
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
eq(resolveButton({ label: 'X' }, undefined, undefined, '/contact'), { label: 'X', href: '/contact' },
  'the caller-supplied fallback is used when nothing else resolves');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} href checks passed`);
if (failed) { console.error('\n✗ href unit tests FAILED'); process.exit(1); }
