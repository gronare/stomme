#!/usr/bin/env node
import assert from 'node:assert/strict';
import { canonicalBounceHost, demoHost, isUnlisted } from '../src/config.ts';

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

const successCases = [
  ['/thanks', undefined, true, 'the default form-success route is unlisted without any noindex list'],
  ['/thanks/', undefined, true, 'and so is the same page with a trailing slash'],
  ['/tack', '/tack', true, "a site's own form-success route is unlisted at the path it configured"],
  ['/thanks', '/tack', false, 'the default path is listed once the site moved the route elsewhere'],
  ['/thanks/deeper', undefined, false, 'a page under the route is not the route itself'],
  ['/thanksgiving', undefined, false, 'a sibling that merely starts with the same letters'],
  ['/', '/', false, 'a form-success route configured as the front page never hides the whole site'],
];
for (const [path, success, want, why] of successCases) {
  assert.equal(isUnlisted(path, undefined, success), want, `${why}: isUnlisted(${path}, undefined, ${JSON.stringify(success)})`);
}

const hostCases = [
  ['https://example.se', 'example.se', 'a real domain bounces the demo hosts to it'],
  ['https://site.pages.dev', '', 'a pages.dev address is the demo itself'],
  ['https://site.gronare.workers.dev', '', 'a workers.dev address is the demo itself'],
  ['', '', 'no address at all'],
  ['not a url', '', 'an unparseable address'],
];
for (const [url, want, why] of hostCases) {
  assert.equal(canonicalBounceHost(url), want, `${why}: canonicalBounceHost(${JSON.stringify(url)})`);
}
assert.equal(demoHost('site.pages.dev') && demoHost('x.gronare.workers.dev') && !demoHost('example.se'), true, 'demoHost covers both suffixes and nothing else');

console.log(`ok — ${cases.length} unlisted-path cases, ${successCases.length} form-success cases, ${hostCases.length + 1} demo-host cases`);
