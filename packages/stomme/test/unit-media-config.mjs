#!/usr/bin/env node
import { r2LibraryYaml, resolveMediaConfig } from '../src/media-config.mjs';

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(got === want, name, `got ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
const throws = (fn, re, name) => { try { fn(); check(false, name, 'did not throw'); } catch (e) { check(re.test(e.message), name, e.message); } };

eq(JSON.stringify(resolveMediaConfig(undefined)), '{"storage":"git","pointers":false}', 'no media config is git without pointers');
eq(JSON.stringify(resolveMediaConfig({})), '{"storage":"git","pointers":false}', 'an empty object is git without pointers');
eq(JSON.stringify(resolveMediaConfig({ storage: 'git', pointers: true })), '{"storage":"git","pointers":true}', 'git with pointers');
eq(resolveMediaConfig({ pointers: 'yes' }).pointers, false, 'pointers must be literally true');
throws(() => resolveMediaConfig({ storage: 's3' }), /"git" or "r2"/, 'an unknown storage throws');
throws(() => resolveMediaConfig({ storage: 'r2', bucket: 'b' }), /accountId, accessKeyId, publicUrl/, 'r2 names every missing key');

const r2 = resolveMediaConfig({ storage: 'r2', accountId: 'acc', bucket: 'site-media', accessKeyId: 'k'.repeat(64), publicUrl: 'https://media.example.se', jurisdiction: 'eu' });
eq(r2.pointers, false, 'r2 never resolves pointers');
eq(r2LibraryYaml(r2),
  '  cloudflare_r2:\n    access_key_id: "' + 'k'.repeat(64) + '"\n    bucket: "site-media"\n    account_id: "acc"\n    public_url: "https://media.example.se"\n    jurisdiction: "eu"\n',
  'the r2 library is emitted flat under media_libraries with only the keys given');
check(!r2LibraryYaml(r2).includes('secret'), 'no secret key is ever written to the config');
eq(r2LibraryYaml(resolveMediaConfig({ storage: 'git' })), '', 'git emits no library');
eq(r2LibraryYaml({ ...r2, prefix: 'uploads/' }).includes('    prefix: "uploads/"'), true, 'a prefix is passed through');

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} failed` : `\n${results.length}/${results.length} media-config checks passed`);
process.exit(failed ? 1 : 0);
