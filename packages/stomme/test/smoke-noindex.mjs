#!/usr/bin/env node
import assert from 'node:assert/strict';
import { isUnlisted } from '../src/config.ts';

const cases = [
  ['/book', ['/book'], true, 'the prefix itself'],
  ['/book/stugan', ['/book'], true, 'a page under it'],
  ['/booking', ['/book'], false, 'a sibling that merely starts with the same letters'],
  ['/book/stugan', ['/other'], false, 'an unrelated prefix'],
  ['/book', [], false, 'nothing listed'],
  ['/book', undefined, false, 'no list at all'],
  ['/book', ['  '], false, 'a blank entry never matches everything'],
  ['/book/stugan', ['/book/'], true, 'a trailing slash in the config'],
  ['/', ['/book'], false, 'the front page'],
];

for (const [path, list, want, why] of cases) {
  assert.equal(isUnlisted(path, list), want, `${why}: isUnlisted(${path}, ${JSON.stringify(list)})`);
}
console.log(`ok — ${cases.length} unlisted-path cases`);
