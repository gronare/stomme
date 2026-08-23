#!/usr/bin/env node
import { createHash, createHmac } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findPointers, mediaStoreFetcher, parsePointer, resolveMirrorPointers, resolvePointers } from '../src/media-pointers.mjs';

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(got === want, name, `got ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
const rejects = async (p, name) => check(await p.then(() => false, () => true), name);

const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const pointer = (b) => `version stomme/media/1\noid sha256:${sha(b)}\nsize ${b.length}\n`;
const tree = () => {
  const dir = mkdtempSync(join(tmpdir(), 'stomme-media-'));
  mkdirSync(join(dir, 'nested'), { recursive: true });
  writeFileSync(join(dir, 'hero.png'), pointer(png));
  writeFileSync(join(dir, 'nested', 'logo.png'), pointer(png));
  writeFileSync(join(dir, 'real.png'), png);
  writeFileSync(join(dir, 'note.txt'), 'hello\n');
  return dir;
};

eq(parsePointer(Buffer.from(pointer(png))).sha256, sha(png), 'parsePointer reads the sha256');
eq(parsePointer(Buffer.from(pointer(png))).size, png.length, 'parsePointer reads the size');
eq(parsePointer(png), null, 'binary bytes are not a pointer');
eq(parsePointer(Buffer.from('version https://git-lfs.github.com/spec/v1\noid sha256:' + sha(png) + '\nsize 1\n')), null, 'a git-lfs pointer is not ours');
eq(parsePointer(Buffer.from(pointer(png).repeat(10))), null, 'a file over the pointer size is not a pointer');
eq(parsePointer(Buffer.alloc(0)), null, 'an empty file is not a pointer');

let dir = tree();
eq(findPointers(dir).map((f) => f.rel).sort().join(','), 'hero.png,nested/logo.png', 'findPointers lists only pointer files, recursively');
const asked = [];
const resolved = await resolvePointers({ dir, fetchBytes: async (s, rel) => { asked.push(`${rel}:${s === sha(png)}`); return png; } });
eq(resolved.sort().join(','), 'hero.png,nested/logo.png', 'resolvePointers returns the resolved relative paths');
eq(asked.sort().join(','), 'hero.png:true,nested/logo.png:true', 'each pointer is fetched by its own sha256');
check(readFileSync(join(dir, 'hero.png')).equals(png), 'the pointer file now holds the bytes');
check(readFileSync(join(dir, 'nested', 'logo.png')).equals(png), 'nested pointers too');
check(readFileSync(join(dir, 'real.png')).equals(png), 'a real file is left alone');
eq(readFileSync(join(dir, 'note.txt'), 'utf8'), 'hello\n', 'a text file is left alone');
eq((await resolvePointers({ dir, fetchBytes: async () => { throw new Error('must not fetch'); } })).length, 0, 'a second pass finds nothing to resolve');
rmSync(dir, { recursive: true, force: true });

dir = tree();
await rejects(resolvePointers({ dir, fetchBytes: async () => Buffer.from('not the image') }), 'bytes whose sha256 differs from the pointer throw');
check(parsePointer(readFileSync(join(dir, 'hero.png'))), 'the pointer stays in place after a mismatch');
await rejects(resolvePointers({ dir, fetchBytes: async () => { throw new Error('502'); } }), 'a fetch failure throws');
await rejects(resolveMirrorPointers({ dir, command: 'build', env: {} }), 'a build with pointers but no store env throws');
const warned = [];
eq((await resolveMirrorPointers({ dir, command: 'dev', env: {}, logger: { warn: (m) => warned.push(m) } })).length, 0, 'dev leaves pointers and warns');
eq(warned.length, 1, 'exactly one warning');
rmSync(dir, { recursive: true, force: true });
dir = mkdtempSync(join(tmpdir(), 'stomme-media-'));
writeFileSync(join(dir, 'real.png'), png);
eq((await resolveMirrorPointers({ dir, command: 'build', env: {} })).length, 0, 'a build without pointers needs no store env');
rmSync(dir, { recursive: true, force: true });

const calls = [];
const fetchImpl = async (url, init) => {
  calls.push({ url, init });
  return { ok: true, status: 200, arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) };
};
const got = await mediaStoreFetcher({ url: 'https://store.example/media', secret: 's3cret', fetchImpl })(sha(png), 'hero.png');
check(Buffer.from(got).equals(png), 'the fetcher returns the response bytes');
eq(calls[0].url, 'https://store.example/media', 'the fetcher posts to the store url');
eq(calls[0].init.method, 'POST', 'as a POST');
eq(calls[0].init.body, JSON.stringify({ sha256: sha(png) }), 'with the sha256 as the body');
const sig = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(calls[0].init.headers['X-Stomme-Signature']);
check(sig, 'the signature header has the t=,v1= shape');
eq(sig && createHmac('sha256', 's3cret').update(`${sig[1]}.${calls[0].init.body}`).digest('hex'), sig && sig[2], 'v1 is the HMAC of "t.body" under the secret');
await rejects(mediaStoreFetcher({ url: 'https://store.example/media', secret: 's3cret', fetchImpl: async () => ({ ok: false, status: 404 }) })(sha(png), 'x.png'), 'a non-2xx answer throws');
check((() => { try { mediaStoreFetcher({ url: '', secret: 's' }); return false; } catch { return true; } })(), 'no url throws at construction');

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} failed` : `\n${results.length}/${results.length} media-pointer checks passed`);
process.exit(failed ? 1 : 0);
