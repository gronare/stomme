#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CREATE = resolve(HERE, '../bin/create.mjs');
const STARTER = resolve(HERE, '../../../starter');
const BLANK = resolve(HERE, '../templates/blank');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const run = (cmd, args, cwd, env = {}) => {
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
};
const dirs = (root) => (existsSync(root) ? readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory()) : []);
const files = (root) => (existsSync(root) ? readdirSync(root, { recursive: true }).filter((f) => statSync(join(root, f)).isFile()) : []);
const html = (site, page) => (existsSync(join(site, 'dist', page)) ? readFileSync(join(site, 'dist', page), 'utf8') : '');

const missing = dirs(join(STARTER, 'src/content')).filter((d) => !existsSync(join(BLANK, 'src/content', d)));
check(!missing.length, 'the blank set has every content collection the demo has', `missing: ${missing.join(', ')}`);

// Under the home directory, not the OS temp dir: on macOS /tmp resolves to /private/tmp and Astro's build fails on that path.
const work = mkdtempSync(join(process.env.STOMME_SCAFFOLD_TMP || homedir(), '.stomme-scaffold-'));
try {
  const plain = run('node', [CREATE, 'plain'], work);
  check(plain.ok && /My site/.test(readFileSync(join(work, 'plain/src/content/settings/site.md'), 'utf8')), 'with no flag and no terminal the scaffold is the blank site', plain.out.slice(-800));

  for (const variant of ['blank', 'demo']) {
    const site = join(work, variant);
    const made = run('node', [CREATE, variant, `--${variant}`], work);
    check(made.ok, `${variant}: create-stomme scaffolds it`, made.out.slice(-800));
    if (!made.ok) continue;
    check(made.out.includes(`cd ${variant}`) && made.out.includes('pnpm dev'), `${variant}: the scaffolder prints the next commands`, made.out);
    const installed = run('pnpm', ['install', '--prefer-offline'], site);
    check(installed.ok, `${variant}: pnpm install`, installed.out.slice(-1500));
    if (!installed.ok) continue;

    for (const target of ['netlify', 'static']) {
      const built = run('pnpm', ['build'], site, { STOMME_TARGET: target });
      check(built.ok, `${variant}: pnpm build on the ${target} target`, built.out.slice(-2500));
    }
    const home = html(site, 'index.html');
    check(/backend:\s*\n\s*name: github\s*\n\s*repo: local\//.test(readFileSync(join(site, 'public/admin/config.yml'), 'utf8')), `${variant}: /admin is configured for the local repository`);
    check(html(site, 'contact/index.html').includes('<form'), `${variant}: the contact page renders its form`);

    if (variant === 'blank') {
      check(home.includes('My site'), 'blank: the home page renders "My site"');
      check(!files(join(site, 'public/media')).length && !files(join(site, 'src/assets/media')).length, 'blank: the scaffold carries no media');
      const leaked = ['index.html', 'contact/index.html', 'thanks/index.html'].filter((p) => /Wren|Sorrel|garden/i.test(html(site, p)));
      check(!leaked.length, 'blank: no page mentions the demo', `demo text in: ${leaked.join(', ')}`);
    } else {
      check(home.includes('Wren &amp; Sorrel'), 'demo: the home page renders Wren & Sorrel');
      check(files(join(site, 'public/media')).length > 0, 'demo: the scaffold carries its photos');
    }
  }

  const engineVersion = JSON.parse(readFileSync(resolve(HERE, '../../stomme/package.json'), 'utf8')).version;
  const packed = run('npm', ['pack', '--pack-destination', work], resolve(HERE, '..'));
  const tarball = readdirSync(work).find((f) => f.endsWith('.tgz'));
  check(packed.ok && tarball, 'npm pack makes the scaffolder tarball', packed.out.slice(-800));
  if (tarball) {
    run('tar', ['xzf', tarball], work);
    const made = run('node', [join(work, 'package/bin/create.mjs'), 'registry', '--blank'], work);
    const site = join(work, 'registry');
    check(made.ok, 'a scaffold from the packed scaffolder succeeds', made.out.slice(-800));
    const dep = made.ok ? JSON.parse(readFileSync(join(site, 'package.json'), 'utf8')).dependencies['@gronare/stomme'] : '';
    check(dep === `^${engineVersion}`, `it installs the engine from npmjs as @gronare/stomme@^${engineVersion}`, dep);
    check(made.ok && !existsSync(join(site, '.npmrc')), 'it writes no .npmrc');
    check(existsSync(join(site, '.gitignore')), 'it keeps the starter\'s .gitignore');
    check(!made.out.includes('linked to this checkout'), 'it does not claim a link to a checkout', made.out);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
