#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const DIST = resolve(STARTER, 'dist');

const results = [];
const check = (ok, name, detail = '') => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`); };

const OWNED = ['src/site.config.ts', 'src/content/navigation/nav.md', 'src/content/footer/footer.md', 'public/admin/config.yml'];
const saved = new Map(OWNED.map((f) => [f, readFileSync(resolve(STARTER, f), 'utf8')]));
const added = [];

function write(rel, body) {
  const file = resolve(STARTER, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  added.push(file);
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : (name.endsWith('.html') ? [p] : []);
});

const FILE_SEGMENT = /\/[^/]*\.[^/.]+$/;
const isInternal = (href) => href.startsWith('/') && !href.startsWith('//');
function obeys(href) {
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  return path.endsWith('/') || FILE_SEGMENT.test(path);
}

const SERVICE = (id, title, order) => `---
title: ${JSON.stringify(title)}
navLabel: ${JSON.stringify(title)}
summary: "What this service covers."
order: ${order}
hero:
  ticks: ["One", "Two"]
  cta:
    label: "Ask about it"
    link:
      page: /contact
  cta2:
    label: "Read the guide"
    link:
      page: /guide
blocks:
  - type: prose
    body: "A service body with a [link to the guide](/guide) in it."
---
`;

const TOWN = (name, order) => `---
name: ${JSON.stringify(name)}
order: ${order}
heroSubtitle: "Working across the whole area."
services: ["One", "Two"]
---
`;

const POST = (title, date, extra = '') => `---
title: ${JSON.stringify(title)}
date: ${date}
excerpt: "A short line about it."
${extra}---
A post body with an [internal link](/about) and an [external one](https://example.test).
`;

const DOCUMENT = `---
title: "The handbook"
file: /media/handbook.pdf
---
`;

const GUIDE = `---
title: "The guide"
published: true
seo:
  title: "The guide"
  description: "Every list block on one page."
blocks:
  - type: sectionNav
  - type: prose
    heading: "Reading on"
    body: |
      A paragraph with an [internal link](/about), a [deep one](/guide/details),
      a [query one](/about?ref=guide), a [hash one](/about#team), a [file one](/media/handbook.pdf),
      a [mail one](mailto:hello@example.com) and an [external one](https://example.test).
  - type: factList
    heading: "The facts"
    items:
      - label: "Where"
        value: "See the [about page](/about)."
  - type: featureGrid
    heading: "What we do"
    items:
      - title: "One"
        body: "The first."
        cta:
          label: "Read on"
          link:
            page: /about
  - type: serviceGrid
    heading: "Services"
  - type: linkChips
    heading: "Areas"
  - type: postList
    heading: "Posts"
    layout:
      limit: 1
      archive: /guide/details
  - type: postArchive
    heading: "Archive"
  - type: eventList
    heading: "Events"
    feedLabel: "Subscribe"
  - type: documentList
    heading: "Documents"
  - type: subpages
    layout:
      variant: chips
  - type: ctaBox
    heading: "Talk to us"
    cta:
      label: "Contact"
      link:
        page: /contact
---
`;

const DETAILS = `---
title: "The details"
parent: /guide
published: true
order: 1
summary: "The long version."
seo:
  title: "The details"
  description: "The long version of the guide."
blocks:
  - type: subpages
    layout:
      variant: siblings
  - type: prose
    body: "Back to the [guide](/guide)."
---
`;

const NAV = `---
showLogo: true
showWordmark: true
items:
  - label: Home
    link:
      page: /
  - label: About
    link:
      page: /about
  - label: Guide
    link:
      page: /guide
    autoChildren: true
  - label: Services
    link:
      page: /services
    menu: services::/services
  - label: More
    children:
      - label: Contact
        link:
          page: /contact
      - label: Elsewhere
        link:
          url: https://example.test
cta:
  label: Contact
  link:
    page: /contact
---
`;

const FOOTER = `---
showLogo: true
showWordmark: true
tagline: "A block-built starter on the stomme engine."
linksHeading: "Explore"
links:
  - label: Home
    link:
      page: /
  - label: Guide
    link:
      page: /guide
showLinks: true
showTowns: true
townsHeading: "Areas"
legal:
  - label: Terms
    link:
      page: /about
---
`;

function buildStatic() {
  const r = spawnSync('pnpm', ['run', 'build:static'], { cwd: STARTER, encoding: 'utf8', env: { ...process.env, STOMME_SLOTS_DIR: '' } });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

try {
  writeFileSync(resolve(STARTER, 'src/site.config.ts'),
    saved.get('src/site.config.ts')
      .replace('  blog: false,', '  blog: true,')
      .replace('  areas: false,', '  areas: true,')
      .replace('  services: false,', '  services: true,')
      .replace('  documents: false,', '  documents: true,')
      .replace("  locale: 'en-US',\n  cmsLocale: 'en',", "  locale: 'en-US',\n  cmsLocale: 'en',\n  locales: ['en', 'sv'],"));
  writeFileSync(resolve(STARTER, 'src/content/navigation/nav.md'), NAV);
  writeFileSync(resolve(STARTER, 'src/content/footer/footer.md'), FOOTER);
  write('src/content/services/roof-cleaning.md', SERVICE('roof-cleaning', 'Roof cleaning', 1));
  write('src/content/services/facade-wash.md', SERVICE('facade-wash', 'Facade wash', 2));
  write('src/content/towns/riverton.md', TOWN('Riverton', 1));
  write('src/content/towns/hillside.md', TOWN('Hillside', 2));
  write('src/content/posts/first-post.md', POST('The first post', '2026-01-10'));
  write('src/content/posts/the-meetup.md', POST('The meetup', '2026-02-10', 'eventDate: 2026-06-01\neventTime: "18:00"\n'));
  write('src/content/documents/handbook.md', DOCUMENT);
  added.push(resolve(STARTER, 'src/content/pages/blog.md'));
  write('src/content/pages/guide.md', GUIDE);
  write('src/content/pages/details.md', DETAILS);
  write('src/content/pages/guide.sv.md', GUIDE.replace('"The guide"', '"Guiden"'));

  console.log('· static build of the starter with every list block, two languages and a subpage…');
  rmSync(DIST, { recursive: true, force: true });
  const built = buildStatic();
  check(built.ok, 'the starter builds with services, areas, blog, documents and a second language');
  if (!built.ok) console.error(built.out.slice(-3000));

  const files = built.ok ? walk(DIST) : [];
  const hrefs = new Map();
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(/\shref="([^"]*)"/g)) {
      if (!hrefs.has(m[1])) hrefs.set(m[1], []);
      hrefs.get(m[1]).push(relative(DIST, file));
    }
  }
  const internal = [...hrefs.keys()].filter(isInternal);
  const rendered = internal.reduce((n, h) => n + hrefs.get(h).length, 0);
  const broken = internal.filter((h) => !obeys(h));

  check(files.length >= 15, `the build emitted pages to read — ${files.length} html files`);
  check(internal.length >= 25 && rendered >= 150,
    `and internal hrefs to judge — ${internal.length} distinct, ${rendered} rendered`);
  check(broken.length === 0,
    'every internal href the engine emits ends with a trailing slash, so no internal click is redirected',
    broken.map((h) => `${h}   (${hrefs.get(h)[0]})`).join('\n    '));

  const has = (href) => hrefs.has(href);
  console.log('· the shapes the rule has to reach…');
  check(has('/about/'), 'a nav item authored as { page: /about } renders slashed');
  check(has('/services/roof-cleaning/'), 'a service card links to the slashed detail address');
  check(has('/areas/riverton/'), 'a town chip does too');
  check(has('/blog/first-post/'), 'and a post card');
  check(has('/guide/details/'), 'a nested page keeps its slash on the last segment only');
  check(has('/sv/about/'), 'a locale-prefixed path follows the same rule');
  check(has('/sv/') && has('/'), 'a locale front page and the site root are a bare slash');
  check(has('/about?ref=guide') === false && has('/about/?ref=guide'),
    'a query string sits after the slash');
  check(has('/about#team') === false && has('/about/#team'),
    'and so does a hash');
  check(has('/media/handbook.pdf'), 'a path whose last segment names a file is left alone');
  check(has('/blog/calendar.ics'), 'the calendar feed keeps its extension, unslashed');
  check(has('mailto:hello@example.com'), 'a mailto: is untouched');
  check([...hrefs.keys()].some((h) => h.startsWith('https://')), 'an absolute URL is untouched');
  check([...hrefs.keys()].some((h) => /^#[a-z]/.test(h)), 'a pure hash link is untouched');

  console.log('· what the head tells a crawler…');
  const canonicals = [];
  const alternates = [];
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/<link rel="canonical" href="([^"]+)"/g)) canonicals.push([m[1], relative(DIST, file)]);
    for (const m of html.matchAll(/<link rel="alternate" hreflang="[^"]+" href="([^"]+)"/g)) alternates.push([m[1], relative(DIST, file)]);
  }
  const pathOf = (url) => { try { return new URL(url).pathname; } catch { return ''; } };
  const badCanonical = canonicals.filter(([u]) => !obeys(pathOf(u)));
  const badAlternate = alternates.filter(([u]) => !obeys(pathOf(u)));
  check(canonicals.length >= 5 && badCanonical.length === 0,
    `every canonical names the slashed URL — ${canonicals.length} read`,
    badCanonical.map(([u, f]) => `${u}   (${f})`).join('\n    '));
  check(alternates.length >= 5 && badAlternate.length === 0,
    `every hreflang alternate names the same shape — ${alternates.length} read`,
    badAlternate.map(([u, f]) => `${u}   (${f})`).join('\n    '));
} finally {
  for (const f of added) { try { rmSync(f, { force: true }); } catch {} }
  for (const [f, body] of saved) { try { writeFileSync(resolve(STARTER, f), body); } catch {} }
  try { rmSync(DIST, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ trailing-slash smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ no internal link the engine renders goes through a redirect.');
