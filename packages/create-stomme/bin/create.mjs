#!/usr/bin/env node
// Copies the starter into <dir>, names it and prints next steps. See the README for how it is invoked.
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// The live monorepo starter wins when it exists, so a lingering ./template can never shadow it — publishing therefore needn't race to delete the snapshot.
const starter = resolve(here, '../../../starter');
const template = existsSync(starter) ? starter : resolve(here, '../template');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: create-stomme <directory>');
  process.exit(1);
}
if (!existsSync(template)) {
  console.error('Template not found:', template);
  process.exit(1);
}

// Set while rewriting package.json, read again by the .npmrc step and the closing message.
let fromCheckout = false;
const dest = resolve(process.cwd(), arg);
if (existsSync(dest)) {
  console.error(`Refusing to overwrite existing path: ${dest}`);
  process.exit(1);
}

const SKIP = new Set(['node_modules', 'dist', '.astro', '.netlify']);
cpSync(template, dest, {
  recursive: true,
  filter: (src) => !SKIP.has(basename(src)),
});

// Inside the monorepo the engine dependency is a relative `link:` because it is path-based and survives the scaffold's own pnpm-workspace.yaml, which makes the site its own workspace root and would break `workspace:*`. Outside, a registry version.
try {
  const pkgPath = resolve(dest, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = basename(dest).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  if (pkg.dependencies && '@gronare/stomme' in pkg.dependencies) {
    const repoRoot = resolve(here, '../../..');
    const enginePkg = resolve(repoRoot, 'packages/stomme');
    // Scaffolding from a checkout links to THAT checkout's engine, wherever the new site lands.
    // The registry copy is scoped and needs a token, so a `latest` here would hand anyone who
    // cloned the repo a site that cannot install — the documented quickstart is clone-and-scaffold.
    fromCheckout = template === starter && existsSync(enginePkg);
    // A relative link only holds inside the repo. Outside it the traversal is resolved against a
    // path that may cross a symlink (macOS /tmp -> /private/tmp) and Vite then loads the engine
    // twice under two names, so an absolute link is the one that survives.
    const inRepo = dest === repoRoot || dest.startsWith(repoRoot + '/');
    pkg.dependencies['@gronare/stomme'] = fromCheckout
      ? 'link:' + (inRepo ? relative(dest, enginePkg).split('\\').join('/') : enginePkg)
      : 'latest';
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
} catch {
  /* leave package.json as-is if anything is unexpected */
}

// allowBuilds is required: pnpm 11 refuses to run a dependency's native build scripts (sharp/esbuild/@parcel/watcher) without an allowlist in pnpm-workspace.yaml, and `pnpm install` stops with ERR_PNPM_IGNORED_BUILDS.
const workspaceYaml = resolve(dest, 'pnpm-workspace.yaml');
if (!existsSync(workspaceYaml)) {
  writeFileSync(
    workspaceYaml,
    "allowBuilds:\n  '@parcel/watcher': true\n  esbuild: true\n  sharp: true\n  workerd: true\n",
  );
}
//  2. The @gronare scope's registry. Auth is a secret and stays out of this committed file — a read:packages token belongs in the user's own ~/.npmrc.
const npmrc = resolve(dest, '.npmrc');
if (!fromCheckout && !existsSync(npmrc)) {
  writeFileSync(
    npmrc,
    '@gronare:registry=https://npm.pkg.github.com\n' +
      '# Auth lives in your USER ~/.npmrc (never commit a token):\n' +
      '#   //npm.pkg.github.com/:_authToken=<github token with read:packages>\n',
  );
}

console.log(fromCheckout
  ? `\n✓ Created ${arg}

The engine is linked to this checkout, so nothing is fetched from a registry.

Next:
  cd ${arg}
  pnpm install
  pnpm dev         # site on :4321, CMS on /admin

Then edit src/content/, recolor src/content/theme/theme.md, compose at /admin.\n`
  : `\n✓ Created ${arg}

Next:
  1. Add a GitHub token (read:packages) to your user ~/.npmrc:
       //npm.pkg.github.com/:_authToken=<token>
  2. cd ${arg}
     pnpm install
     pnpm dev       # site on :4321, CMS on /admin

Then edit src/content/, recolor src/content/theme/theme.md, compose at /admin.\n`);
