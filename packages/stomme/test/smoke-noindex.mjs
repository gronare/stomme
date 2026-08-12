#!/usr/bin/env node
/*
 * stomme — unit smoke for `isUnlisted` (src/config.ts), the rule behind `site.noindex`.
 *
 * A site may keep a path unlisted: the page is served as usual so a link somebody already holds
 * keeps working, and Head.astro marks it noindex so search engines leave it alone. The match is on
 * WHOLE SEGMENTS, because a prefix match on raw strings would silently take '/booking' with '/book'.
 *
 * Run with:  node packages/stomme/test/smoke-noindex.mjs
 */
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
