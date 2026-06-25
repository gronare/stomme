#!/usr/bin/env node
// create-stomme — scaffold a new site from the starter template.
//
//   pnpm dlx create-stomme my-site
//   npm create stomme@latest my-site
//
// Copies the starter into <dir>, names it, and prints next steps. The template is
// bundled at publish time (./template); in this monorepo it falls back to ../../../starter.
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Prefer the live monorepo starter when it exists (dev/linked); the published package
// has no starter sibling and falls back to the bundled ./template snapshot. This way a
// lingering ./template never shadows the live starter, so publish needn't race to delete it.
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

// Name the package after the target directory, and switch the engine dependency
// from the monorepo's `workspace:*` to a registry version — a scaffolded app lives
// outside the workspace and resolves @gronare/stomme from the package registry.
try {
  const pkgPath = resolve(dest, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = basename(dest).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  if (pkg.dependencies && '@gronare/stomme' in pkg.dependencies) {
    pkg.dependencies['@gronare/stomme'] = 'latest';
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
} catch {
  /* leave package.json as-is if anything is unexpected */
}

// A standalone app needs two things the workspace used to provide. Write each only
// if the template didn't already ship it.
//  1. allowBuilds — pnpm 11 won't run a dependency's native build scripts
//     (sharp/esbuild/@parcel/watcher) without approval; it reads the allowlist from
//     pnpm-workspace.yaml. Without this, `pnpm install` stops with ERR_PNPM_IGNORED_BUILDS.
const workspaceYaml = resolve(dest, 'pnpm-workspace.yaml');
if (!existsSync(workspaceYaml)) {
  writeFileSync(
    workspaceYaml,
    "allowBuilds:\n  '@parcel/watcher': true\n  esbuild: true\n  sharp: true\n",
  );
}
//  2. registry mapping — tell pnpm that the @gronare scope lives on GitHub Packages.
//     Auth is a secret, so it stays out of this committed file: add a token with
//     read:packages to your *user* ~/.npmrc instead.
const npmrc = resolve(dest, '.npmrc');
if (!existsSync(npmrc)) {
  writeFileSync(
    npmrc,
    '@gronare:registry=https://npm.pkg.github.com\n' +
      '# Auth lives in your USER ~/.npmrc (never commit a token):\n' +
      '#   //npm.pkg.github.com/:_authToken=<github token with read:packages>\n',
  );
}

console.log(`\n✓ Created ${arg}\n
Next:
  1. Add a GitHub token (read:packages) to your user ~/.npmrc:
       //npm.pkg.github.com/:_authToken=<token>
  2. cd ${arg}
     pnpm install     # native builds are pre-approved in pnpm-workspace.yaml
     pnpm dev         # site on :4321, CMS on /admin

Then edit src/content/, recolor src/content/theme/theme.md, compose at /admin.\n`);
