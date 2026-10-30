#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const DIST = resolve(STARTER, 'dist');
const FIXTURE = resolve(HERE, 'fixtures/docs');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

function buildStatic(env) {
  const r = spawnSync('pnpm', ['run', 'build:static'], { cwd: STARTER, encoding: 'utf8', env: { ...process.env, ...env } });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}
const file = (p) => join(DIST, p);
const html = (route) => readFileSync(file(join(route, 'index.html')), 'utf8');

const CONFIG = 'src/site.config.ts';
const saved = readFileSync(resolve(STARTER, CONFIG), 'utf8');
const restore = () => writeFileSync(resolve(STARTER, CONFIG), saved);

try {
  writeFileSync(resolve(STARTER, CONFIG), saved
    .replace('  faq: true,', '  faq: true,\n  docs: true,')
    .replace("  cmsLocale: 'en',", "  cmsLocale: 'en',\n  docs: { repo: 'acme/tool', path: 'docs', route: '/docs' },"));

  console.log('· static build with features.docs and STOMME_DOCS_DIR (fixture folder)…');
  rmSync(DIST, { recursive: true, force: true });
  const on = buildStatic({ STOMME_DOCS_DIR: FIXTURE });
  check(on.ok, 'the site builds with the docs feature on');
  if (!on.ok) console.error(on.out.slice(-4000));

  if (on.ok) {
    check(existsSync(file('docs/index.html')), 'the docs home is built at the route');
    for (const p of ['docs/tutorial', 'docs/how-to/run-a-job', 'docs/how-to/read-logs', 'docs/reference/settings']) check(existsSync(file(join(p, 'index.html'))), `/${p}/ is built`);

    const home = html('docs');
    check(home.includes('Fixture documentation') && home.includes('<code>fixture help</code>'), 'the home renders the README title and lede');
    check(/<p class="docs-nav__head">How-to guides<\/p>/.test(home) && /<summary class="docs-nav__summary">Daily work<\/summary>/.test(home), 'the nav has the sections and the group labels');
    check(/aria-current="page"[^>]*>Overview</.test(home), 'the home marks Overview as the current page');

    const run = html('docs/how-to/run-a-job');
    check(run.includes('<h1 class="docs-title">Run a job</h1>') && run.includes('<p class="docs-lede">Jobs run one at a time.</p>'), 'a page renders its title and lede');
    check(run.includes('href="/docs/reference/settings/#jobs-max"'), 'a relative .md link with an anchor becomes the site route');
    check(run.includes('href="https://github.com/acme/tool/blob/main/examples/config.toml"'), 'a link out of the docs folder goes to GitHub at the ref');
    check(run.includes('href="https://example.test/"'), 'an external link is kept');
    check(run.includes('<blockquote>'), 'a blockquote renders');
    check(/<a class="docs-nav__link" href="\/docs\/how-to\/run-a-job\/" aria-current="page">/.test(run), 'the nav marks the current page');
    check(/<details class="docs-nav__group" open>/.test(run), 'the group holding the current page is open');
    check(run.includes('<a class="docs-toc__link" href="#start-a-job">Start a job</a>'), 'the ## headings form "On this page"');
    check(run.includes('rel="prev"') && run.includes('href="/docs/tutorial/" rel="prev"') && run.includes('href="/docs/how-to/read-logs/" rel="next"'), 'previous and next follow README order');
    check(run.includes('href="https://github.com/acme/tool/blob/main/docs/how-to/run-a-job.md"'), 'the edit link points at the file on GitHub');
    check(/<nav class="docs-crumbs"[^>]*><a href="\/docs\/">Docs<\/a><span aria-hidden="true"> \/ <\/span><span>How-to guides<\/span>/.test(run), 'the breadcrumb is Docs / section');

    const settings = html('docs/reference/settings');
    check(settings.includes('<table>') && settings.includes('id="jobsmax-1"'), 'a GFM table renders and repeated headings get distinct ids');

    const tut = html('docs/tutorial');
    const img = tut.match(/<img src="(\/docs\/_media\/[^"]+)"/)?.[1];
    check(!!img && existsSync(file(img.slice(1))), 'an embedded image is copied into the build and served from the site', img);
    check(tut.includes('<pre class="docs-code"><code class="language-sh">'), 'fenced code renders with its language');

    const logs = html('docs/how-to/read-logs');
    check(/<div class="docs-preview__stage docs-preview__stage--blocks"><span hidden(="")?><\/span>[\s\S]*?data-stomme-block="callout"[\s\S]*?Every job writes one log line per step\.[\s\S]*?<\/div><pre class="docs-code"><code class="language-yaml">type: callout/.test(logs), 'a yaml block fence renders the live block above its code');
    check(logs.includes('<div class="docs-preview__stage docs-preview__stage--html"><!--docs-stage--><a class="btn" href="/contact">Open the logs</a>'), 'an html preview fence renders its markup above its code');
    check(/docs-preview--failed"><p class="docs-preview__notice">[^<]+<\/p><pre class="docs-code">/.test(logs) && /docs: how-to\/read-logs\.md: a block example was shown as code only, it is not a block/.test(on.out), 'an example that is not a block shows a notice and its code, and the build log names it');

    const index = JSON.parse(readFileSync(file('docs/_search/local.json'), 'utf8'));
    check(index.length === 4 && index.every((d) => d.t && d.u && typeof d.x === 'string'), 'a static search index lists every page', JSON.stringify(index.map((d) => d.u)));
    check(index.some((d) => d.u === '/docs/reference/settings/' && d.x.includes('Every key has a default.')), 'the index carries the page text');

    const sitemap = readdirSync(DIST).filter((f) => f.startsWith('sitemap-') && f !== 'sitemap-index.xml').map((f) => readFileSync(file(f), 'utf8')).join('');
    check(sitemap.includes('/docs/how-to/run-a-job/'), 'the docs pages are in the sitemap');
  }

  console.log('· the same build with an unreadable source…');
  rmSync(DIST, { recursive: true, force: true });
  const missing = buildStatic({ STOMME_DOCS_DIR: join(FIXTURE, 'does-not-exist') });
  check(!missing.ok && /stomme docs: the local docs folder .*does-not-exist does not exist/.test(missing.out), 'the build fails and names the folder it could not read');

  restore();
  console.log('· static build with the feature off…');
  rmSync(DIST, { recursive: true, force: true });
  const off = buildStatic({ STOMME_DOCS_DIR: FIXTURE });
  check(off.ok, 'the site builds with the docs feature off');
  check(off.ok && !existsSync(file('docs')), 'no docs route is injected when the feature is off');
} finally {
  restore();
  rmSync(DIST, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
