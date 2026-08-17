#!/usr/bin/env node
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
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

// `link:` rather than `workspace:*`: the scaffold writes its own pnpm-workspace.yaml, so the new site is its own workspace root and a `workspace:` range has nothing to resolve against.
try {
  const pkgPath = resolve(dest, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = basename(dest).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  if (pkg.dependencies && '@gronare/stomme' in pkg.dependencies) {
    const repoRoot = resolve(here, '../../..');
    const enginePkg = resolve(repoRoot, 'packages/stomme');
    fromCheckout = template === starter && existsSync(enginePkg);
    const inRepo = dest === repoRoot || dest.startsWith(repoRoot + '/');
    pkg.dependencies['@gronare/stomme'] = fromCheckout
      ? 'link:' + (inRepo ? relative(dest, enginePkg).split('\\').join('/') : enginePkg)
      : 'latest';
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
} catch {}

// Without this allowlist pnpm 11 refuses to run the native build scripts and `pnpm install` stops with ERR_PNPM_IGNORED_BUILDS.
const workspaceYaml = resolve(dest, 'pnpm-workspace.yaml');
if (!existsSync(workspaceYaml)) {
  writeFileSync(
    workspaceYaml,
    "allowBuilds:\n  '@parcel/watcher': true\n  esbuild: true\n  sharp: true\n  workerd: true\n",
  );
}
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
