// prepack snapshots the starter into ./template so the published tarball carries its own copy; postpack removes it again.
import { cpSync, rmSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const starter = resolve(here, '../../../starter');
const template = resolve(here, '../template');
// Admin assets that stomme-gen regenerates are skipped: shipping them would bake in a stale, engine-version-specific snapshot.
const SKIP = new Set([
  'node_modules', 'dist', '.astro', '.netlify', '.gitkeep',
  'stomme-previews.js', 'stomme-site.css', 'blocks.html',
]);

rmSync(template, { recursive: true, force: true });
cpSync(starter, template, { recursive: true, filter: (src) => !SKIP.has(basename(src)) });
console.log('prepack: bundled starter → template/');
