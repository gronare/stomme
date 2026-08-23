import { createHash, createHmac } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const POINTER_VERSION = 'stomme/media/1';
const POINTER_RE = /^version stomme\/media\/1\noid sha256:([0-9a-f]{64})\nsize (\d+)\n$/;
const MAX_POINTER_BYTES = 200;
const CONCURRENCY = 4;

export function parsePointer(buf) {
  if (!buf || buf.length > MAX_POINTER_BYTES) return null;
  const m = POINTER_RE.exec(buf.toString('utf8'));
  return m ? { sha256: m[1], size: Number(m[2]) } : null;
}

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

export function findPointers(dir) {
  return walk(dir)
    .map((path) => ({ path, rel: relative(dir, path), pointer: parsePointer(readFileSync(path)) }))
    .filter((f) => f.pointer);
}

// Every pointer is replaced by its bytes, verified against the pointer's own sha256 and size; a mismatch throws, because a wrong image is worse than a failed build.
export async function resolvePointers({ dir, fetchBytes, logger }) {
  const pointers = findPointers(dir);
  if (!pointers.length) return [];
  const queue = [...pointers];
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const bytes = await fetchBytes(f.pointer.sha256, f.rel);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (sha256 !== f.pointer.sha256 || bytes.length !== f.pointer.size) {
        throw new Error(`media pointer ${f.rel}: fetched ${bytes.length} bytes with sha256 ${sha256}, pointer says ${f.pointer.size} bytes / ${f.pointer.sha256}`);
      }
      writeFileSync(f.path, bytes);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pointers.length) }, worker));
  logger?.info(`media: resolved ${pointers.length} pointer(s)`);
  return pointers.map((f) => f.rel);
}

export function mediaStoreFetcher({ url, secret, fetchImpl = globalThis.fetch }) {
  if (!url || !secret) throw new Error('media: STOMME_MEDIA_URL and STOMME_MEDIA_SECRET are required to resolve media pointers');
  return async (sha256, rel) => {
    const body = JSON.stringify({ sha256 });
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Stomme-Signature': `t=${t},v1=${v1}` },
      body,
    });
    if (!res.ok) throw new Error(`media pointer ${rel}: ${url} answered ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };
}

// A pointer left in place would ship as an image, so a build without the store env fails outright; dev only warns, since local work uses real files.
export async function resolveMirrorPointers({ dir, command, logger, env = process.env }) {
  if (!findPointers(dir).length) return [];
  const { STOMME_MEDIA_URL, STOMME_MEDIA_SECRET } = env;
  if (!STOMME_MEDIA_URL || !STOMME_MEDIA_SECRET) {
    if (command === 'build') throw new Error('stomme: public/media holds media pointers but STOMME_MEDIA_URL / STOMME_MEDIA_SECRET are not set, so they cannot be resolved');
    logger?.warn('media: pointers left unresolved (no STOMME_MEDIA_URL / STOMME_MEDIA_SECRET in dev)');
    return [];
  }
  return resolvePointers({ dir, fetchBytes: mediaStoreFetcher({ url: STOMME_MEDIA_URL, secret: STOMME_MEDIA_SECRET }), logger });
}
