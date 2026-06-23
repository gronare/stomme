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
const bundled = resolve(here, '../template');
const template = existsSync(bundled) ? bundled : resolve(here, '../../../starter');

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

// Name the package after the target directory.
try {
  const pkgPath = resolve(dest, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = basename(dest).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
} catch {
  /* leave package.json as-is if anything is unexpected */
}

console.log(`\n✓ Created ${arg}\n
Next:
  cd ${arg}
  pnpm install
  pnpm dev          # site on :4321, CMS on /admin

Then edit src/content/, recolor src/content/theme/theme.md, compose at /admin.
(Outside a stomme workspace, set the "stomme" dependency to its published version.)\n`);
