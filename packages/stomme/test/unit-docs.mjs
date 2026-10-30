#!/usr/bin/env node
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { parseIndex, rewriteHref, headingId, renderDoc, buildVersion, resolveDocsConfig, routeParam, previewKind, parseBlockPreview, imageRefs } from '../src/docs.mjs';
import { githubSource, localSource, loadDocs } from '../src/docs-source.mjs';
import { markdownSource, markdownUrl } from '../src/docs.mjs';
import { llmsTxt, llmsFullTxt, agentFiles, catalogJson, stripMarkdown } from '../src/docs-agent.mjs';
import { createJiti } from 'jiti';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, 'fixtures/docs');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
const rejects = async (fn, re, name) => {
  try { await fn(); check(false, name, 'did not throw'); }
  catch (e) { check(re.test(String(e?.message)), name, String(e?.message)); }
};

console.log('· README.md becomes the nav');
const index = parseIndex(readFileSync(join(FIXTURE, 'README.md'), 'utf8'));
eq(index.title, 'Fixture documentation', 'the # heading is the title');
eq(index.lede, 'Start with the tutorial, then use `fixture help` to find a page.', 'the first paragraph is the lede');
eq(index.sections.map((s) => s.name), ['Tutorial', 'How-to guides', 'Reference'], 'each ## is a section, in order');
eq(index.sections[1].groups.map((g) => g.label), ['Daily work'], 'a plain paragraph inside a section labels the group under it');
eq(index.sections[0].groups[0].label, null, 'a list straight under its heading has no group label');
eq(index.sections[0].groups[0].items[0], { title: 'First steps', path: 'tutorial.md', description: 'install it and run one job.' }, 'an item carries its title, path and description');
eq(index.sections[1].groups[0].items[1], { title: 'Read the logs', path: 'how-to/read-logs.md', description: '' }, 'an item without a description still lists');
eq(parseIndex('## A\n\n- [x](x.md#part): with `code`, kept\n').sections[0].groups[0].items[0],
  { title: 'x', path: 'x.md', description: 'with `code`, kept' }, 'an anchor on the item link is dropped from its path, inline markdown in the description is kept');
eq(parseIndex('## A\n\nGroup one\n\n- [a](a.md)\n\nGroup two\n\n- [b](b.md)\n').sections[0].groups.map((g) => g.label), ['Group one', 'Group two'], 'a label applies only to the list right after it');

console.log('· links');
const ctx = { repo: 'acme/tool', ref: 'v1.2.0', docsPath: 'docs', base: '/docs', file: 'how-to/run-a-job.md', pages: new Set(['README.md', 'tutorial.md', 'how-to/run-a-job.md', 'reference/settings.md']) };
eq(rewriteHref('../reference/settings.md', ctx), '/docs/reference/settings/', 'a relative .md link becomes the site route');
eq(rewriteHref('../reference/settings.md#jobs-max', ctx), '/docs/reference/settings/#jobs-max', 'and keeps its #anchor');
eq(rewriteHref('run-a-job.md', ctx), '/docs/how-to/run-a-job/', 'a sibling page resolves from the page folder');
eq(rewriteHref('../README.md', ctx), '/docs/', 'README.md is the docs home');
eq(rewriteHref('../tutorial.md', { ...ctx, base: '/docs/main', ref: 'main' }), '/docs/main/tutorial/', 'a page of another version links within that version');
eq(rewriteHref('../../examples/config.toml', ctx), 'https://github.com/acme/tool/blob/v1.2.0/examples/config.toml', 'a link out of the docs folder goes to GitHub at the ref');
eq(rewriteHref('../../src/main.rs#L10', ctx), 'https://github.com/acme/tool/blob/v1.2.0/src/main.rs#L10', 'with its anchor');
eq(rewriteHref('../missing.md', ctx), 'https://github.com/acme/tool/blob/v1.2.0/docs/missing.md', 'a .md that is not in the folder goes to GitHub too');
eq(rewriteHref('/LICENSE', ctx), 'https://github.com/acme/tool/blob/v1.2.0/LICENSE', 'a root-relative link is read from the repo root, as GitHub does');
eq(rewriteHref('https://example.test/x', ctx), 'https://example.test/x', 'an external link is left alone');
eq(rewriteHref('mailto:a@example.test', ctx), 'mailto:a@example.test', 'and so is a mailto:');
eq(rewriteHref('#start-a-job', ctx), '#start-a-job', 'an in-page anchor is left alone');

console.log('· headings');
const seen = new Set();
eq(headingId('<code>kebbie ci --json</code>', seen), 'kebbie-ci---json', 'ids follow GitHub: punctuation dropped, every space a hyphen');
eq(headingId('Files &amp; layers', seen), 'files--layers', 'an entity is read as its character before it is dropped');
eq(headingId('<code>kebbie ci --json</code>', seen), 'kebbie-ci---json-1', 'a repeated heading gets a numbered id');
eq(headingId('Åtgärder', new Set()), 'åtgärder', 'letters outside ASCII are kept');

console.log('· a page');
const tut = renderDoc(readFileSync(join(FIXTURE, 'tutorial.md'), 'utf8'), { ...ctx, file: 'tutorial.md', media: new Map([['docs/assets/board.png', '/docs/_media/abc/board.png']]) });
eq(tut.title, 'First steps', 'the first # is the title');
eq(tut.lede, 'This tutorial installs the tool and runs one job.', 'the lede skips a paragraph that only holds an image');
check(!tut.html.includes('<h1') && !tut.html.includes('This tutorial installs'), 'title and lede are taken out of the body');
check(tut.html.includes('<img src="/docs/_media/abc/board.png" alt="The fixture board"'), 'an embedded image points at its served copy');
check(tut.html.includes('<h2 id="install">Install</h2>'), '## gets an id');
eq(tut.headings.map((h) => h.id), ['install'], 'the ## headings form the page outline');
check(tut.html.includes('<pre class="docs-code"><code class="language-sh">') && tut.html.includes('echo &quot;&lt;done&gt;&quot;'), 'fenced code keeps its language and is escaped');
check(tut.html.includes('href="/docs/how-to/run-a-job/#watch-a-job"'), 'links in the body are rewritten');

console.log('· preview fences');
eq([previewKind('yaml block'), previewKind('yml block'), previewKind('html preview'), previewKind('yaml'), previewKind('html'), previewKind('sh block')], ['block', 'block', 'html', null, null, null], 'a word after yaml or html marks a preview, nothing else does');
const pv = renderDoc([
  '# P', '', 'Lede.', '', '## Look', '',
  '```yaml block', 'type: callout', 'quote: Plants first, paths second.', '```', '',
  '```yaml block', '- type: statsBar', '  items: [{ label: Years, value: "12" }]', '- type: logoStrip', '  logos: [Oak, Ash]', '```', '',
  '```html preview', '<a class="btn" href="/contact">Book a visit</a>', '```', '',
  '```yaml', 'type: not-a-preview', '```',
].join('\n'), { ...ctx, file: 'reference/p.md' });
eq(pv.previews.map((b) => b.map((x) => x.type)), [['callout'], ['statsBar', 'logoStrip']], 'each block fence yields its blocks, a list as a list');
eq(pv.previews[0][0], { type: 'callout', quote: 'Plants first, paths second.' }, 'a block keeps its fields exactly as written');
check(pv.html.includes('<!--docs-block:0-->') && pv.html.includes('<!--docs-block:1-->'), 'the body holds a numbered slot where each live block goes');
check((pv.html.match(/<pre class="docs-code"><code class="language-yaml">/g) || []).length === 3, 'every fence still shows its code, with its language');
check(pv.html.includes('<div class="docs-preview__stage docs-preview__stage--html"><!--docs-stage--><a class="btn" href="/contact">Book a visit</a><!--/docs-stage--></div>') && pv.html.includes('&lt;a class=&quot;btn&quot;'), 'an html preview renders its markup as-is above its escaped code');
check(!pv.html.includes('not-a-preview</code></pre>\n</div>') && pv.html.includes('type: not-a-preview'), 'a plain yaml fence stays plain code');
eq((pv.text.match(/Book a visit/g) || []).length, 1, 'the search text holds an html example once, from its code');
eq(pv.warnings, [], 'good examples log nothing');

const bad = renderDoc(['# B', '', '```yaml block', 'type: callout', '  quote: [unclosed', '```', '', '```yaml block', 'quote: no type', '```', '', '```yaml block', 'blocks:', '  - type: callout', '    quote: From a page', '```'].join('\n'), { ...ctx, file: 'b.md' });
eq((bad.html.match(/<!--docs-preview-failed-->/g) || []).length, 2, 'YAML that does not parse, and YAML that is not a block, become a notice instead of a live block');
check((bad.html.match(/docs-preview--failed/g) || []).length === 2 && bad.html.includes('quote: no type'), 'a failed example still shows its code');
eq(bad.warnings.length, 2, 'each failure is logged');
check(/^b\.md: .*does not parse/.test(bad.warnings[0]) && /not a block/.test(bad.warnings[1]), 'the log names the file and the reason');
eq(bad.previews, [[{ type: 'callout', quote: 'From a page' }]], 'a page-shaped blocks: list is read as its blocks');
eq(parseBlockPreview('[]').error !== undefined, true, 'an empty list is not a block');

const mctx = { ...ctx, file: 'reference/m.md', media: new Map([['docs/assets/hero.webp', '/docs/_media/abc/hero.webp']]) };
const md = '# M\n\n```yaml block\ntype: textImage\nmedia:\n  image: ../assets/hero.webp\n  video: ../../starter/clip.mp4\nbody: Keep /media/x.webp and see ../a.md\n```\n';
eq(imageRefs(md, 'reference/m.md', 'docs').sort(), ['docs/assets/hero.webp', 'starter/clip.mp4'], 'media a block example names by a relative path is collected to be copied');
const withMedia = renderDoc(md, mctx).previews[0][0];
eq(withMedia.media.image, '/docs/_media/abc/hero.webp', 'a relative image in a block example points at its served copy');
eq(withMedia.media.video, 'https://raw.githubusercontent.com/acme/tool/v1.2.0/starter/clip.mp4', 'one not copied is read from GitHub at the ref');
eq(withMedia.body, 'Keep /media/x.webp and see ../a.md', 'other strings are left alone');

console.log('· a version');
const files = new Map();
for (const f of ['README.md', 'tutorial.md', 'how-to/run-a-job.md', 'how-to/read-logs.md', 'reference/settings.md']) files.set(f, readFileSync(join(FIXTURE, f), 'utf8'));
const v = buildVersion({ key: 'latest', ref: 'v1.2.0', label: 'v1.2.0', kind: 'release', base: '/docs' }, files, { repo: 'acme/tool', docsPath: 'docs' });
const page = (p) => v.pages.find((x) => x.path === p);
eq(v.home.url, '/docs/', 'the version home is the route');
eq(page('tutorial.md').next?.url, '/docs/how-to/run-a-job/', 'next follows README order');
eq(page('how-to/run-a-job.md').prev?.url, '/docs/tutorial/', 'and previous too');
eq(page('reference/settings.md').next, null, 'the last page has no next');
eq(page('how-to/read-logs.md').section, 'How-to guides', 'a page knows its section for the breadcrumb');
eq(page('how-to/run-a-job.md').edit, 'https://github.com/acme/tool/blob/v1.2.0/docs/how-to/run-a-job.md', 'edit links to the file at the ref');
eq(page('reference/settings.md').headings.map((h) => h.id), ['jobsmax', 'jobsmax-1'], 'two equal headings get distinct ids');
eq(v.search.map((s) => s.u).sort(), v.pages.map((p) => p.url).sort(), 'every page is in the search index');
check(v.search.find((s) => s.u === '/docs/reference/settings/').x.includes('Every key has a default.'), 'the index holds the page text');
check(v.nav[1].groups[0].items[0].descriptionHtml === 'start, watch and stop a job.', 'nav items carry their description');
eq(routeParam('/docs', '/docs/'), undefined, 'the docs home is the bare route');
eq(routeParam('/docs', '/docs/main/how-to/x/'), 'main/how-to/x', 'a page under a version prefix keeps the prefix in its param');
check((() => { try { buildVersion({ ref: 'main', base: '/docs' }, new Map([['a.md', '# A']]), { repo: 'acme/tool', docsPath: 'docs' }); return false; } catch (e) { return /no README\.md/.test(e.message); } })(), 'a folder without README.md fails with a message that names it');

console.log('· config');
eq(resolveDocsConfig({ repo: 'acme/tool' }), { repo: 'acme/tool', path: 'docs', route: '/docs', branch: '', dir: '', blocks: false }, 'defaults: docs/ served at /docs, no block catalog');
eq(resolveDocsConfig({ repo: 'a/b', path: '/guide/', route: 'help/' }).route, '/help', 'the route is normalised');

console.log('· GitHub source');
const gh = (routes) => async (url) => {
  const hit = Object.entries(routes).find(([k]) => url.startsWith(k));
  if (!hit) return new Response('nope', { status: 404 });
  const v = typeof hit[1] === 'function' ? hit[1](url) : hit[1];
  return v instanceof Response ? v : new Response(typeof v === 'string' ? v : JSON.stringify(v), { status: 200 });
};
const treeOf = (paths, ref = '') => ({ truncated: false, tree: paths.map((p, i) => ({ path: p, type: 'blob', sha: p.endsWith('.md') ? `${ref}sha${i}` : `sha${i}` })) });
const cfg = resolveDocsConfig({ repo: 'acme/tool' });
const seenUrls = [];
const fetchRepo = gh({
  'https://api.github.com/repos/acme/tool/releases/latest': { tag_name: 'v1.2.0' },
  'https://api.github.com/repos/acme/tool/git/trees/': (url) => treeOf(['README.md', 'docs/README.md', 'docs/tutorial.md', 'docs/assets/board.png', 'src/x.rs'], url.split('/trees/')[1].split('?')[0]),
  'https://api.github.com/repos/acme/tool': { default_branch: 'main' },
  'https://raw.githubusercontent.com/acme/tool/': (url) => { seenUrls.push(url); return url.endsWith('.png') ? new Response(new Uint8Array([1, 2, 3])) : url.endsWith('README.md') ? '# Docs\n\n## Tutorial\n\n- [First](tutorial.md): go.\n' : '# First\n\n![b](assets/board.png)\n\nHello.\n'; },
});
const media = mkdtempSync(join(tmpdir(), 'stomme-docs-'));
const data = await loadDocs(cfg, githubSource(cfg, { fetch: fetchRepo, token: '' }), { mediaDir: media });
eq(data.versions.map((x) => [x.key, x.ref, x.base]), [['latest', 'v1.2.0', '/docs'], ['main', 'main', '/docs/main']], 'the latest release is served at the route and the default branch under it');
check(seenUrls.some((u) => u.includes('/v1.2.0/docs/tutorial.md')) && seenUrls.some((u) => u.includes('/main/docs/tutorial.md')), 'each version reads its files at its own ref');
check(!seenUrls.some((u) => u.endsWith('/README.md') && !u.includes('/docs/')), 'only the docs folder is read');
eq(seenUrls.filter((u) => u.endsWith('.png')).length, 1, 'an image both versions share is fetched once');
const img = data.versions[0].pages[0].html.match(/src="([^"]+)"/)[1];
check(/^\/docs\/_media\/[0-9a-f]{10}\/board\.png$/.test(img) && existsSync(join(media, img.slice('/docs/_media/'.length))), 'the image is written under the media dir at the address the page uses');
rmSync(media, { recursive: true, force: true });

const noRelease = await loadDocs(cfg, githubSource(cfg, { fetch: gh({ ...Object.fromEntries(Object.entries({
  'https://api.github.com/repos/acme/tool/releases/latest': new Response('', { status: 404 }),
  'https://api.github.com/repos/acme/tool/git/trees/': treeOf(['docs/README.md']),
  'https://api.github.com/repos/acme/tool': { default_branch: 'trunk' },
  'https://raw.githubusercontent.com/acme/tool/': '# Docs\n',
})) }), token: '' }));
eq(noRelease.versions.map((x) => [x.key, x.ref, x.base]), [['trunk', 'trunk', '/docs']], 'with no release the default branch is served at the route');

let auth = null;
await githubSource(cfg, { fetch: async (url, init) => { auth = init?.headers?.Authorization ?? null; return new Response(JSON.stringify({ default_branch: 'main' })); }, token: 'tok' }).versions().catch(() => {});
eq(auth, 'Bearer tok', 'GITHUB_TOKEN is sent when set');
await rejects(() => githubSource(cfg, { fetch: gh({}), token: '' }).versions(), /acme\/tool was not found.*GITHUB_TOKEN/, 'an unreadable repo fails with a message naming it');
await rejects(() => githubSource(cfg, { fetch: async () => new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }), token: '' }).versions(), /rate limit/, 'a rate-limited build says so');
await rejects(() => githubSource(cfg, { fetch: async () => { throw new Error('getaddrinfo ENOTFOUND'); }, token: '' }).versions(), /could not read the repo acme\/tool \(getaddrinfo/, 'a network failure fails the build with the cause');

console.log('· local folder');
const local = await loadDocs(cfg, localSource(cfg, FIXTURE));
eq(local.versions.map((x) => [x.key, x.label, x.kind, x.base]), [['local', 'docs', 'local', '/docs']], 'a folder on disk is one version at the route, named after the folder');
eq(local.versions[0].pages.length, 4, 'every page in the folder is built');
await rejects(() => loadDocs(cfg, localSource(cfg, join(FIXTURE, 'nope'))), /does not exist/, 'a missing folder fails with its path');

console.log('· a failed example in a build');
const memory = (files) => ({ async versions() { return [{ key: 'local', ref: 'main', label: 'mem', kind: 'local', base: '/docs' }]; }, async tree() { return new Map(Object.keys(files).map((k) => [k, k])); }, async read(_r, p) { return Buffer.from(files[p]); } });
const logged = [];
const built = await loadDocs(cfg, memory({ 'docs/README.md': '# D\n\n## R\n\n- [X](x.md)\n', 'docs/x.md': '# X\n\n```yaml block\n: : :\n```\n' }), { logger: { info() {}, warn: (m) => logged.push(m) } });
check(logged.length === 1 && /^docs: x\.md: a block example was shown as code only/.test(logged[0]), 'the build logs a failed example as a warning and goes on');
check(!('warnings' in built.versions[0]) && !('warnings' in built.versions[0].pages[0]), 'warnings stay out of the data the pages are built from');

console.log('· for an agent');
eq([markdownUrl('/docs/', '/docs'), markdownUrl('/docs/how-to/run-a-job/#start', '/docs'), markdownUrl('/docs/main/', '/docs/main')], ['/docs/index.md', '/docs/how-to/run-a-job.md#start', '/docs/main/index.md'], 'a page is Markdown at its path + .md, a version home at index.md');
eq(page('how-to/run-a-job.md').markdownUrl, '/docs/how-to/run-a-job.md', 'each page knows its Markdown address');
const runMd = page('how-to/run-a-job.md').markdown;
check(runMd.includes('[the settings](/docs/reference/settings.md#jobs-max)'), 'a link to another page points at that page as Markdown', runMd);
check(runMd.includes('(https://github.com/acme/tool/blob/v1.2.0/examples/config.toml)') && runMd.includes('(https://example.test/)'), 'a link out of the folder goes to GitHub at the ref, an external one stays');
eq(markdownSource('See [a](a.md).\n\n```md\n[a](a.md)\n```\n', { ...ctx, file: 'x.md', pages: new Set(['a.md', 'x.md']), docsPath: 'docs' }), 'See [a](/docs/a.md).\n\n```md\n[a](a.md)\n```\n', 'a link inside a fence is left as written');
check(page('how-to/read-logs.md').markdown.includes('```yaml block'), 'a preview fence stays YAML in the Markdown');

const llms = llmsTxt(v, { repo: 'acme/tool', path: 'docs' }, { abs: (u) => new URL(u, 'https://docs.example.test').href, blocks: '/docs/blocks.json', others: [{ label: 'main', base: '/docs/main' }] });
const lines = llms.split('\n');
eq(lines.slice(0, 4), ['# Fixture documentation', '', '> Start with the tutorial, then use fixture help to find a page.', ''], 'llms.txt opens with the README title and its lede as the summary');
check(llms.includes('These are the docs of acme/tool/docs at release v1.2.0.') && llms.includes('[llms-full.txt](https://docs.example.test/docs/llms-full.txt)') && llms.includes('[blocks.json](https://docs.example.test/docs/blocks.json)'), 'it names the version and links llms-full.txt and blocks.json');
check(llms.includes('Other versions: [main](https://docs.example.test/docs/main/llms.txt).'), 'it links the other versions\' llms.txt');
eq(lines.filter((l) => l.startsWith('## ')), ['## Tutorial', '## How-to guides', '## Reference'], 'each README section is a section');
check(llms.includes('- [Run a job](https://docs.example.test/docs/how-to/run-a-job.md): start, watch and stop a job.'), 'an item links the page as Markdown with the README description');
check(llms.includes('- [Read the logs](https://docs.example.test/docs/how-to/read-logs.md): '), 'an item with no README description takes the page lede');
const lone = buildVersion({ key: 'local', ref: 'main', label: 'x', kind: 'local', base: '/docs' }, new Map([['README.md', '# D\n\n## R\n\n- [A](a.md)\n'], ['a.md', '# A\n\nAy.'], ['b.md', '# B\n\nBee.']]), { repo: 'acme/tool', docsPath: 'docs' });
check(llmsTxt(lone, { repo: 'acme/tool', path: 'docs' }).includes('## Optional\n\n- [B](/docs/b.md): Bee.'), 'a page the README does not list goes under Optional');

const full = llmsFullTxt(v, { repo: 'acme/tool', path: 'docs' });
const order = [...full.matchAll(/^Source: (\S+) \((\S+)\)$/gm)].map((m) => m[1]);
eq(order, ['docs/README.md', 'docs/tutorial.md', 'docs/how-to/run-a-job.md', 'docs/how-to/read-logs.md', 'docs/reference/settings.md'], 'llms-full.txt holds every page in README order, each under its source path');
check(full.includes('Source: docs/how-to/run-a-job.md (/docs/how-to/run-a-job/)\n\n# Run a job\n\nJobs run one at a time.'), 'each page keeps its own headings after the source line');
check(full.includes('```yaml block\ntype: callout'), 'a preview fence is kept as YAML');

const { defaultBlocks } = await createJiti(import.meta.url).import(resolve(HERE, '../catalog.ts'));
const cat = catalogJson(defaultBlocks, { engine: '9.9.9' });
eq(cat.blocks.map((b) => b.type), defaultBlocks.map((b) => b.type).sort(), 'blocks.json lists every library block');
const postList = cat.blocks.find((b) => b.type === 'postList');
const showImages = postList.fields.find((f) => f.name === 'media').fields.find((f) => f.name === 'showImages');
eq([showImages.widget, showImages.default], ['boolean', false], 'a switch carries its CMS default, off');
const surface = postList.fields.find((f) => f.name === 'style').fields.find((f) => f.name === 'surface');
check(surface.options.some((o) => o.value === 'tint' && o.label === 'Tinted') && surface.default === 'standard', 'a select carries its options and its default');
check(cat.engine === '9.9.9' && /left out of a page renders as its default/.test(cat.fieldPolicy), 'it names the engine version and the field policy');

const agentData = { route: '/docs', repo: 'acme/tool', path: 'docs', versions: [v, buildVersion({ key: 'main', ref: 'main', label: 'main', kind: 'unreleased', base: '/docs/main' }, files, { repo: 'acme/tool', docsPath: 'docs' })] };
const out = agentFiles(agentData, { origin: 'https://docs.example.test', blocks: defaultBlocks, engine: '9.9.9' });
for (const p of ['docs/llms.txt', 'docs/llms-full.txt', 'docs/blocks.json', 'docs/index.md', 'docs/how-to/run-a-job.md', 'docs/main/llms.txt', 'docs/main/llms-full.txt', 'docs/main/index.md', 'docs/main/reference/settings.md']) check(out.has(p), `agentFiles writes ${p}`);
check(out.get('docs/main/llms.txt').includes('Other versions: [v1.2.0](https://docs.example.test/docs/llms.txt).'), 'a version\'s llms.txt points back at the default one');
check(!agentFiles(agentData).has('docs/blocks.json'), 'blocks.json only when the site asks for it');
stripMarkdown(agentData);
check(agentData.versions.every((x) => !('markdown' in x.home) && x.pages.every((p) => !('markdown' in p) && p.markdownUrl)), 'the page data keeps the Markdown address and drops the text');

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
