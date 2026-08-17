#!/usr/bin/env node
import { createJiti } from 'jiti';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { encodeContact, maskContact } = await jiti.import(resolve(PKG, 'src/protect.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(got === want, name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

// The browser half of the contract, lifted out of the shipped entrypoint so the two are exercised as one pair.
const decSrc = readFileSync(resolve(PKG, 'src/entrypoints.mjs'), 'utf8').match(/function dec\(s\)\s*\{[^}]*\}/);
check(!!decSrc, 'src/entrypoints.mjs still ships a dec() to invert encodeContact()');
const dec = decSrc ? new Function(`${decSrc[0]}; return dec;`)() : () => '';

const ADDRESSES = ['carl@example.test', '+46 70 123 45 67', 'post@gronare.se', 'a', 'åäö@example.test'];
for (const value of ADDRESSES) {
  eq(dec(encodeContact(value)), value, `the client decoder recovers ${JSON.stringify(value)}`);
}

check(ADDRESSES.every((v) => !encodeContact(v).includes(v)),
  'the plain address never appears verbatim in the encoded string — that is the whole point');
check(encodeContact('carl@example.test') !== btoa('carl@example.test'),
  'the value is reversed before base64, not merely base64-encoded');
eq(encodeContact('carl@example.test'), btoa('carl@example.test'.split('').reverse().join('')),
  'encodeContact is exactly base64(reverse(value))');

eq(encodeContact(''), '', 'an empty value encodes to an empty string');
eq(encodeContact(undefined), '', 'an absent value encodes to an empty string instead of "undefined"');
eq(dec(''), '', 'the decoder maps an empty string back to an empty string');

const btoaSaved = globalThis.btoa;
try {
  delete globalThis.btoa;
  eq(encodeContact('carl@example.test'), btoaSaved('carl@example.test'.split('').reverse().join('')),
    'the Buffer fallback (no global btoa) produces the same string as the btoa branch');
  eq(encodeContact('åäö@example.test'), btoaSaved('åäö@example.test'.split('').reverse().join('')),
    'the two branches agree on latin-1 characters too');
} finally {
  globalThis.btoa = btoaSaved;
}

eq(maskContact('carl@example.test'), '••••@•••••••.••••', 'maskContact keeps the address shape and hides the characters');
eq(maskContact('+46 70 123 45 67'), '+•• •• ••• •• ••', 'digits are masked, punctuation and spaces survive');
eq(maskContact('åäö'), '•••', 'non-ASCII letters are masked too');
eq(maskContact('carl@example.test').length, 'carl@example.test'.length, 'masking preserves the length');
eq(maskContact(undefined), '', 'an absent value masks to an empty string');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} contact-protection checks passed`);
if (failed) { console.error('\n✗ protect unit tests FAILED'); process.exit(1); }
