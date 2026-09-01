#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { localBusinessJsonLd } = await jiti.import(resolve(PKG, 'src/local-business.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const BLANK_CONTACT = {
  phone: '', phoneE164: '', email: '',
  address: { street: '', postcode: '', city: '', country: '' },
  socials: [], orgNr: '', founded: '',
};

eq(localBusinessJsonLd({}), null, 'no name and no contact emits nothing at all');
eq(localBusinessJsonLd({ name: '   ', contact: BLANK_CONTACT }), null,
  "a fleet contact file of empty strings is no contact data — a site with no name emits nothing");
eq(localBusinessJsonLd({ name: 'Starter Co', contact: BLANK_CONTACT }),
  { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Starter Co' },
  'every blank field is left out — the name alone is still a business');
check(localBusinessJsonLd({ contact: { email: 'hi@example.test' } })?.email === 'hi@example.test',
  'contact data alone carries the schema when the settings name is missing');

const full = localBusinessJsonLd({
  name: 'Starter Co',
  url: 'https://example.com',
  image: 'https://example.com/og.png',
  contact: {
    phone: '+1 555 0100',
    phoneE164: '+15550100',
    email: 'hello@example.com',
    address: { street: 'Main 1', postcode: '11122', city: 'Exampletown', country: 'SE', lat: 59.33, lng: 18.07 },
    socials: [{ platform: 'facebook', url: 'https://facebook.test/x' }, { platform: 'instagram', url: '' }],
    orgNr: '556677-8899',
    founded: '2019',
  },
  towns: ['Exampletown', '  ', undefined, 'Exampleville'],
});

eq(full.telephone, '+15550100', 'the E.164 number wins over the printed one');
eq(full.email, 'hello@example.com', 'the email travels as written');
eq(full.taxID, '556677-8899', 'the organisation number is the tax id');
eq(full.foundingDate, '2019', 'the founding year is the founding date');
eq(full.url, 'https://example.com', 'the site origin is the business url');
eq(full.image, 'https://example.com/og.png', 'the share image is already absolute when it arrives');
eq(full.address, { '@type': 'PostalAddress', streetAddress: 'Main 1', postalCode: '11122', addressLocality: 'Exampletown', addressCountry: 'SE' },
  'the address is a PostalAddress with the filled fields only');
eq(full.geo, { '@type': 'GeoCoordinates', latitude: 59.33, longitude: 18.07 }, 'a coordinate pair becomes GeoCoordinates');
eq(full.sameAs, ['https://facebook.test/x'], 'a social row without a url is dropped');
eq(full.areaServed, [{ '@type': 'City', name: 'Exampletown' }, { '@type': 'City', name: 'Exampleville' }],
  'the towns collection names the cities served, blanks left out');

const phoneOnly = localBusinessJsonLd({ name: 'X', contact: { phone: '+1 555 0100' } });
eq(phoneOnly.telephone, '+1 555 0100', 'the printed number stands in when no E.164 number is written');

const halfGeo = localBusinessJsonLd({ name: 'X', contact: { address: { city: 'Trysil', lat: 61.3 } } });
check(halfGeo.geo === undefined, 'a latitude without a longitude is no coordinate — geo is left out');
eq(halfGeo.address, { '@type': 'PostalAddress', addressLocality: 'Trysil' }, 'the city alone is still an address');

check(localBusinessJsonLd({ name: 'X' }).address === undefined, 'no address fields leaves the whole address out');
check(localBusinessJsonLd({ name: 'X' }).areaServed === undefined, 'an empty towns collection leaves areaServed out');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} local-business checks passed`);
if (failed) { console.error('\n✗ local-business unit tests FAILED'); process.exit(1); }
