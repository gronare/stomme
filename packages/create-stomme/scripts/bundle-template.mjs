// prepack snapshots the starter into ./template so the published tarball carries its own copy; postpack removes it again.
import { cpSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
// npm leaves every .gitignore out of a tarball, so it travels as `gitignore` and create.mjs renames it back.
renameSync(resolve(template, '.gitignore'), resolve(template, 'gitignore'));

// A scaffold from the registry installs the engine release this scaffolder was packed beside, from npmjs, under the name its imports use.
const engineVersion = JSON.parse(readFileSync(resolve(here, '../../stomme/package.json'), 'utf8')).version;
const pkgPath = resolve(template, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.dependencies['@gronare/stomme'] = `npm:stomme@^${engineVersion}`;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`prepack: bundled starter → template/, engine npm:stomme@^${engineVersion}`);
