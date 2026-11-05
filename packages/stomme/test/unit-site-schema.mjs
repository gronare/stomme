#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { websiteJsonLd, organizationJsonLd, softwareJsonLd } = await createJiti(import.meta.url).import(resolve(PKG, 'src/site-schema.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const base = { name: 'Acme Tool', url: 'https://example.com' };

eq(websiteJsonLd(base), { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Acme Tool', url: 'https://example.com' }, 'WebSite carries the name and the address');
eq(websiteJsonLd({ name: 'Acme Tool' }), null, 'no address, no WebSite');
eq(websiteJsonLd({ url: 'https://example.com', name: '  ' }), null, 'no name, no WebSite');

eq(organizationJsonLd(base), { '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme Tool', url: 'https://example.com' }, 'Organization without a logo or links carries only the name and address');
eq(organizationJsonLd({ ...base, logo: 'https://example.com/media/logo.svg', sameAs: ['https://social.example/acme', '', undefined, ' https://code.example/acme '] }).logo, 'https://example.com/media/logo.svg', 'the logo is carried');
eq(organizationJsonLd({ ...base, sameAs: ['https://social.example/acme', '', undefined, ' https://code.example/acme '] }).sameAs, ['https://social.example/acme', 'https://code.example/acme'], 'sameAs keeps the filled links, trimmed');

eq(softwareJsonLd(base), null, 'SoftwareApplication is opt-in');
eq(softwareJsonLd({ ...base, software: {} }), { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Acme Tool', url: 'https://example.com' }, 'an empty software key emits the name and address only');
const sw = softwareJsonLd({ ...base, software: { name: 'acme', applicationCategory: 'DeveloperApplication', operatingSystem: 'macOS, Linux', free: true, repo: 'https://code.example/acme/tool' } });
eq(sw, {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'acme',
  url: 'https://example.com',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'macOS, Linux',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  sameAs: ['https://code.example/acme/tool'],
}, 'a declared product carries its category, systems, a free offer and its repository');
check(!('offers' in softwareJsonLd({ ...base, software: { free: false } })), 'no offer unless the product is declared free');
check(JSON.parse(JSON.stringify(sw))['@type'] === 'SoftwareApplication', 'the output is plain JSON');

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
