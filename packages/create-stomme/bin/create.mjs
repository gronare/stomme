#!/usr/bin/env node
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { resolve, relative, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const starter = resolve(here, '../../../starter');
const template = existsSync(starter) ? starter : resolve(here, '../template');
const blankSet = resolve(here, '../templates/blank');

const USAGE = 'Usage: create-stomme <directory> [--blank | --demo]';
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('-')));
const unknown = [...flags].filter((f) => f !== '--blank' && f !== '--demo');
const arg = args.find((a) => !a.startsWith('-'));
if (!arg || unknown.length || (flags.has('--blank') && flags.has('--demo'))) {
  console.error(unknown.length ? `Unknown option: ${unknown.join(' ')}\n${USAGE}` : USAGE);
  process.exit(1);
}
if (!existsSync(template) || !existsSync(blankSet)) {
  console.error('Template not found:', existsSync(template) ? blankSet : template);
  process.exit(1);
}

let fromCheckout = false;
const dest = resolve(process.cwd(), arg);
if (existsSync(dest)) {
  console.error(`Refusing to overwrite existing path: ${dest}`);
  process.exit(1);
}

async function askVariant() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question('Blank site or the Wren & Sorrel demo? [B]lank / [d]emo: ')).trim().toLowerCase();
    return answer.startsWith('d') ? 'demo' : 'blank';
  } finally {
    rl.close();
  }
}

const variant = flags.has('--demo') ? 'demo' : flags.has('--blank') ? 'blank' : process.stdin.isTTY ? await askVariant() : 'blank';

const SKIP = new Set(['node_modules', 'dist', '.astro', '.netlify', '.wrangler']);
cpSync(template, dest, {
  recursive: true,
  filter: (src) => !SKIP.has(basename(src)),
});

// The blank set replaces the demo's whole content tree, so a collection it lacks fails the build instead of leaking demo entries.
if (variant === 'blank') {
  for (const dir of ['src/content', 'public/media', 'src/assets/media']) rmSync(resolve(dest, dir), { recursive: true, force: true });
  cpSync(blankSet, dest, { recursive: true });
}

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

// The CMS's local-repository editing only opens a folder that holds a .git, so a site outside any repository gets its own.
const inGitRepo = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: dest, stdio: 'ignore' }).status === 0;
if (!inGitRepo) spawnSync('git', ['init', '-q'], { cwd: dest, stdio: 'ignore' });

const created = variant === 'demo'
  ? 'the Wren & Sorrel demo: a garden studio with sample pages, photos, services, testimonials and FAQs'
  : 'a blank site: a home page, a contact page with its form, and placeholder text to replace';
const editHint = variant === 'demo'
  ? 'Then explore /admin, or start over with a blank site: create-stomme <directory> --blank'
  : 'Then open /admin to write your own pages, and recolor src/content/theme/theme.md.';

console.log(fromCheckout
  ? `\n✓ Created ${arg} as ${created}.

The engine is linked to this checkout, so nothing is fetched from a registry.

Next:
  cd ${arg}
  pnpm install
  pnpm dev         # site on :4321, CMS on /admin

${editHint}\n`
  : `\n✓ Created ${arg} as ${created}.

Next:
  1. Add a GitHub token (read:packages) to your user ~/.npmrc:
       //npm.pkg.github.com/:_authToken=<token>
  2. cd ${arg}
     pnpm install
     pnpm dev       # site on :4321, CMS on /admin

${editHint}\n`);
