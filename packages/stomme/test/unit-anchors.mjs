#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { slugifyHeading, blockAnchors } = await jiti.import(resolve(PKG, 'src/anchors.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

eq(slugifyHeading('Our services'), 'our-services', 'spaces become dashes and the slug is lowercase');
eq(slugifyHeading('Så här går det till'), 'sa-har-gar-det-till', 'å, ä and ö fold to a, a and o');
eq(slugifyHeading('Économie & Écologie'), 'economie-ecologie', 'other diacritics are stripped and punctuation dropped');
eq(slugifyHeading('Price — 2026?'), 'price-2026', 'digits survive, dashes never double up');
eq(slugifyHeading('  Leading and trailing  '), 'leading-and-trailing', 'a slug never starts or ends with a dash');
eq(slugifyHeading('日本語'), '', 'a heading with nothing slug-able yields no slug');
eq(slugifyHeading(undefined), '', 'a missing heading yields no slug');

eq(blockAnchors([{ heading: 'Services' }, { heading: 'Prices' }]), ['services', 'prices'], 'each heading gets its own anchor');
eq(blockAnchors([{ type: 'gallery' }, { heading: 'Prices' }]), [undefined, 'prices'], 'a block without a heading gets no anchor');
eq(blockAnchors([{ heading: 'Prices' }, { heading: 'Prices' }, { heading: 'Prices' }]),
  ['prices', 'prices-2', 'prices-3'], 'a repeated heading is de-duplicated with a counter');
eq(blockAnchors([{ heading: 'Prices' }, { heading: 'Prices' }, { heading: 'Prices 2' }]),
  ['prices', 'prices-2', 'prices-2-2'], 'a heading that collides with a generated suffix is pushed further, never duplicated');
eq(blockAnchors([{ heading: 42 }, { heading: '' }]), [undefined, undefined], 'only a non-empty string heading anchors a block');
eq(blockAnchors(undefined), [], 'no blocks, no anchors');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} anchor checks pass`);
if (failed) { console.error('\n✗ anchor units FAILED'); process.exit(1); }
