#!/usr/bin/env node
import { r2LibraryYaml, resolveMediaConfig, withMaxFileSize } from '../src/media-config.mjs';

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(got === want, name, `got ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
const throws = (fn, re, name) => { try { fn(); check(false, name, 'did not throw'); } catch (e) { check(re.test(e.message), name, e.message); } };

eq(JSON.stringify(resolveMediaConfig(undefined)), '{"storage":"git"}', 'no media config is git without a cap');
eq(JSON.stringify(resolveMediaConfig({})), '{"storage":"git"}', 'an empty object is git');
eq(JSON.stringify(resolveMediaConfig({ storage: 'git', pointers: true })), '{"storage":"git"}', 'a leftover pointers flag is ignored');
eq(resolveMediaConfig({ maxFileSize: 26214400 }).maxFileSize, 26214400, 'maxFileSize is carried in bytes');
throws(() => resolveMediaConfig({ maxFileSize: '25MB' }), /positive integer/, 'a non-integer cap throws');
throws(() => resolveMediaConfig({ maxFileSize: 0 }), /positive integer/, 'a zero cap throws');
throws(() => resolveMediaConfig({ storage: 's3' }), /"git" or "r2"/, 'an unknown storage throws');
throws(() => resolveMediaConfig({ storage: 'r2', bucket: 'b' }), /accountId, accessKeyId, publicUrl/, 'r2 names every missing key');

const r2 = resolveMediaConfig({ storage: 'r2', accountId: 'acc', bucket: 'site-media', accessKeyId: 'k'.repeat(64), publicUrl: 'https://media.example.se', jurisdiction: 'eu' });
eq(r2LibraryYaml(r2),
  '  cloudflare_r2:\n    access_key_id: "' + 'k'.repeat(64) + '"\n    bucket: "site-media"\n    account_id: "acc"\n    public_url: "https://media.example.se"\n    jurisdiction: "eu"\n',
  'the r2 library is emitted flat under media_libraries with only the keys given');
check(!r2LibraryYaml(r2).includes('secret'), 'no secret key is ever written to the config');
eq(r2LibraryYaml(resolveMediaConfig({ storage: 'git' })), '', 'git emits no library');
eq(r2LibraryYaml({ ...r2, prefix: 'uploads/' }).includes('    prefix: "uploads/"'), true, 'a prefix is passed through');

const BASE = 'public_folder: "/media"\nmedia_libraries:\n  all:\n    slugify_filename: true\n    transformations:\n      svg: { optimize: true }\ncollections: []\n';
eq(withMaxFileSize(BASE, resolveMediaConfig({})), BASE, 'no cap leaves the config alone');
const capped = withMaxFileSize(BASE, resolveMediaConfig({ maxFileSize: 1024 }));
eq(capped, BASE.replace('  all:\n', '  all:\n    max_file_size: 1024\n'), 'a cap is written first under media_libraries.all');
eq(withMaxFileSize(capped, resolveMediaConfig({ maxFileSize: 2048 })), BASE.replace('  all:\n', '  all:\n    max_file_size: 2048\n'), 'a changed cap replaces the line');
eq(withMaxFileSize(capped, resolveMediaConfig({})), BASE, 'removing the cap removes the line');
const withR2 = withMaxFileSize(BASE.replace('media_libraries:\n', 'media_libraries:\n' + r2LibraryYaml(r2)), resolveMediaConfig({ maxFileSize: 512 }));
eq(withR2.includes('  cloudflare_r2:\n') && withR2.includes('  all:\n    max_file_size: 512\n'), true, 'the cap lands under all even after an r2 block');

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} failed` : `\n${results.length}/${results.length} media-config checks passed`);
process.exit(failed ? 1 : 0);
