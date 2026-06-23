// prepack: snapshot the monorepo starter into ./template so the published package
// carries its own template. bin/create.mjs prefers ../template when present and falls
// back to ../../../starter for local/dev (linked) use, so this snapshot only exists
// inside the tarball — postpack removes it again.
import { cpSync, rmSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const starter = resolve(here, '../../../starter');
const template = resolve(here, '../template');
// Skip build output and the admin assets that stomme-gen regenerates (dev + build both
// run it) — shipping them would bake in a stale, engine-version-specific snapshot.
const SKIP = new Set([
  'node_modules', 'dist', '.astro', '.netlify',
  'stomme-previews.js', 'stomme-site.css', 'blockkit-previews.js', 'blockkit-site.css',
]);

rmSync(template, { recursive: true, force: true });
cpSync(starter, template, { recursive: true, filter: (src) => !SKIP.has(basename(src)) });
console.log('prepack: bundled starter → template/');
