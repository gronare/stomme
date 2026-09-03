#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const DIST = resolve(STARTER, 'dist');
const PAGES = resolve(STARTER, 'src/content/pages');

const results = [];
const check = (ok, name, detail = '') => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`); };

const OWNED = ['src/site.config.ts', 'src/content/settings/site.md', 'public/admin/config.yml'];
const saved = new Map(OWNED.map((f) => [f, readFileSync(resolve(STARTER, f), 'utf8')]));
const added = [];

const page = (title, url, parent, extra = {}) => `---
title: ${JSON.stringify(title)}
${url ? `url: ${url}\n` : ''}${parent ? `parent: ${parent}\n` : ''}${extra.order ? `order: ${extra.order}\n` : ''}${extra.cover ? `cover: ${extra.cover}\n` : ''}${extra.summary ? `summary: ${JSON.stringify(extra.summary)}\n` : ''}published: true
seo:
  title: ${JSON.stringify(title)}
  description: ${JSON.stringify(`${title} — locale route fixture.`)}
blocks:
  - type: prose
    body: ${JSON.stringify(title)}
${extra.blocks ?? ''}---
`;

const CHIPS = `  - type: subpages
    layout:
      variant: chips
`;
const CARDS = `  - type: subpages
    heading: "Vidare härifrån"
    media:
      showImages: true
    layout:
      variant: cards
      columns: "2"
`;
const SIBLINGS = `  - type: subpages
    layout:
      variant: siblings
`;
const COVER = '/images/placeholders/service.svg';

const EN_QUESTION = 'This question is written in English.';
const EN_TAGLINE = 'The footer, written in English.';
const EN_LINK = 'About, read in English';

const faqEntry = (question, answer) => `---
question: ${JSON.stringify(question)}
answer: ${JSON.stringify(answer)}
order: 1
tags: [basics]
---
`;

// What Sveltia writes for a translation: the text fields in the new language, the toggles duplicated from the default locale.
const footerEntry = (tagline, label) => `---
showLogo: true
showWordmark: true
showLinks: true
tagline: ${JSON.stringify(tagline)}
links:
  - label: ${JSON.stringify(label)}
    link:
      page: /about
---
`;

function write(rel, body) {
  const file = resolve(STARTER, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  added.push(file);
}

function buildStatic() {
  const r = spawnSync('pnpm', ['run', 'build:static'], { cwd: STARTER, encoding: 'utf8', env: process.env });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const emitted = (route) => existsSync(join(DIST, route, 'index.html'));
const html = (route) => readFileSync(join(DIST, route, 'index.html'), 'utf8');
const alternates = (src) => [...src.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);

try {
  writeFileSync(resolve(STARTER, 'src/site.config.ts'),
    saved.get('src/site.config.ts')
      .replace("  locale: 'en-US',\n  cmsLocale: 'en',", "  locale: 'sv-SE',\n  cmsLocale: 'sv',\n  locales: ['sv', 'en', 'no'],"));
  write('src/content/pages/omradet.md', page('Området', '', '', { blocks: CHIPS + CARDS + SIBLINGS }));
  write('src/content/pages/omradet.en.md', page('The area', 'the-area', '', { blocks: CHIPS + CARDS + SIBLINGS }));
  write('src/content/pages/omradet.no.md', page('Området', 'omraadet'));
  write('src/content/pages/guiden.md', page('Guiden', '', '/omradet', { order: 1, cover: COVER, summary: 'Guiden i korthet.', blocks: SIBLINGS }));
  write('src/content/pages/guiden.en.md', page('The guide', 'the-guide', '/omradet', { order: 1, cover: COVER, summary: 'The guide in short.', blocks: SIBLINGS }));
  write('src/content/pages/kartan.md', page('Kartan', '', '/omradet', { order: 2, summary: 'Kartan i korthet.' }));
  write('src/content/faq/what-is-this.en.md', faqEntry(EN_QUESTION, 'This answer is written in English.'));
  write('src/content/footer/footer.en.md', footerEntry(EN_TAGLINE, EN_LINK));

  console.log('· static build with three languages, the switcher left at its default…');
  rmSync(DIST, { recursive: true, force: true });
  const globe = buildStatic();
  check(globe.ok, 'the site builds with a page that answers on a different address per language');
  if (!globe.ok) console.error(globe.out);

  check(emitted('omradet'), 'the default language serves the page under its filename — /omradet');
  check(emitted('en/the-area'), "the English address is the one the translation names — /en/the-area");
  check(emitted('no/omraadet'), 'and the Norwegian one its own — /no/omraadet');
  check(!emitted('en/omradet'), 'the filename is not also served under /en/ — one page, one address per language');
  check(emitted('about') && emitted('en/about') && emitted('no/about'),
    'a page no translation renamed still answers on the filename in every language');

  check(emitted('omradet/guiden'), 'a subpage answers under its parent — /omradet/guiden');
  check(emitted('en/the-area/the-guide'), 'and on the address both halves have in that language — /en/the-area/the-guide');
  check(emitted('no/omraadet/guiden'), 'a language that translated only the parent keeps the child segment — /no/omraadet/guiden');
  check(!emitted('guiden') && !emitted('en/the-guide'), 'the flat address a subpage would have had is not built beside it');

  const child = html('omradet/guiden');
  check(/<nav class="breadcrumbs" aria-label="Brödsmulor">/.test(child), 'the subpage carries a breadcrumb trail, named in the language of the page');
  check(/<a class="breadcrumbs__link" href="\/">Hem<\/a>/.test(child), 'the trail starts at the front page');
  check(/<a class="breadcrumbs__link" href="\/omradet">Området<\/a>/.test(child), 'names the parent by its title, linked');
  check(/aria-current="page">Guiden</.test(child), 'and ends on the page itself as plain text');
  check(child.includes('"@type":"BreadcrumbList"') && child.includes('https://example.com/omradet'),
    'and says the same thing to a crawler, in absolute URLs');
  check(!/breadcrumbs/.test(html('omradet')) && !/breadcrumbs/.test(html('about')),
    'a page with no parent carries no breadcrumb at all');

  console.log('· the subpages block…');
  const parent = html('omradet');
  check(/<section data-stomme-block="subpages" class="section subpages subpages--chips">/.test(parent),
    'the chapter row is one subpages section, told apart by its variant class');
  check(/<span class="mono subpage-chiprow__label">I det här avsnittet<\/span>/.test(parent),
    'and is introduced in the language of the page');
  check(/<a href="\/omradet\/guiden" class="subpage-chip">Guiden<\/a>/.test(parent)
    && /<a href="\/omradet\/kartan" class="subpage-chip">Kartan<\/a>/.test(parent),
    'each subpage is a chip, named by its title and linked on its nested address');

  const cards = Object.fromEntries([...parent.matchAll(/<a href="([^"]+)" class="card subpage-card">([\s\S]*?)<\/a>/g)].map((m) => [m[1], m[2]]));
  check(Object.keys(cards).length === 2, 'the card grid draws one card per subpage', Object.keys(cards).join(', '));
  check(/<img src="\/images\/placeholders\/service\.svg"[^>]*class="subpage-card__img"/.test(cards['/omradet/guiden'] ?? ''),
    'a page with a cover carries it across the top of its card');
  check(!/<img|subpage-card__img/.test(cards['/omradet/kartan'] ?? ''),
    'a page with no cover renders a card with no image area at all — never a placeholder');
  check(/<h3>Guiden<\/h3><p>Guiden i korthet\.<\/p><span class="mono subpage-card__more">/.test(cards['/omradet/guiden'] ?? ''),
    'the card reads the title, then the summary, then the read-more line the site words itself', cards['/omradet/guiden']);
  check(!/subpages--siblings/.test(parent),
    'the siblings band placed on a page with no parent renders nothing, rather than a band pointing at the site root');

  const band = html('omradet/guiden');
  check(/<section data-stomme-block="subpages" class="section subpages subpages--siblings">/.test(band),
    'the same block on a subpage renders the siblings band');
  check(/<span class="mono eyebrow">Området<\/span>/.test(band) && /Fler sidor i avsnittet<\/h2>/.test(band),
    'the band is labelled with the parent title and the wording of the page\'s language');
  check(/<a href="\/omradet\/kartan" class="subpage-row">/.test(band), 'it lists the pages beside this one');
  check(!/<a href="\/omradet\/guiden" class="subpage-row/.test(band), 'and never the page you are reading');
  check(/<a href="\/omradet" class="subpage-row subpage-row--up">[\s\S]*?↑ Området/.test(band),
    'and ends on a link up to the parent');

  const parentEn = html('en/the-area');
  check(/<span class="mono subpage-chiprow__label">In this section<\/span>/.test(parentEn),
    'the English twin introduces its chapter row in English');
  check(/<a href="\/en\/the-area\/the-guide" class="subpage-chip">/.test(parentEn),
    'and the chips lead to the English addresses');
  check(/<a href="\/en\/the-area\/kartan" class="subpage-chip">/.test(parentEn),
    'a subpage no language renamed keeps its segment under the translated parent');
  check(/<a href="\/en\/the-area\/the-guide" class="card subpage-card">/.test(parentEn),
    'the cards on the twin lead there too');
  check(/<a href="\/en\/the-area" class="subpage-row subpage-row--up">/.test(html('en/the-area/the-guide')),
    'and the band on the English subpage climbs to the English parent');

  const childEn = html('en/the-area/the-guide');
  check(/<a class="breadcrumbs__link" href="\/en\/">Home<\/a>/.test(childEn), 'the English trail is worded in English');
  check(/<a class="breadcrumbs__link" href="\/en\/the-area">The area<\/a>/.test(childEn),
    'and names the parent by its translated title, on its translated address');

  const bounce = html('omradet');
  check(bounce.includes('location.replace') && bounce.includes('example.com') && bounce.includes(".endsWith('.pages.dev')"),
    'a demo-host visit bounces to the real domain, and only a demo-host visit');

  const alts = alternates(html('omradet'));
  check(JSON.stringify(alts) === JSON.stringify([['sv-SE', 'https://example.com/omradet/'], ['en', 'https://example.com/en/the-area/'], ['no', 'https://example.com/no/omraadet/'], ['x-default', 'https://example.com/omradet/']]),
    'the head names every language by the URL that language answers on', JSON.stringify(alts));
  check(JSON.stringify(alternates(html('en/the-area'))) === JSON.stringify(alts),
    'the translated page tells a crawler the same three URLs');

  const sitemap = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
  check(!sitemap.includes('xhtml:link'),
    'the sitemap writes no alternates at all — its prefix substitution would name /en/omradet, which nothing serves');

  const nav = html('omradet');
  check(/<details class="lang-switch"/.test(nav), 'the header carries the globe switcher by default');
  check(nav.includes('>Svenska<') && nav.includes('>English<') && nav.includes('>Norsk<'),
    'each language is offered in its own words');
  check(/<a class="lang-switch__row"[^>]*href="\/en\/the-area"/.test(nav),
    "the switcher's own targets are the translated addresses");
  check(/aria-label="Byt språk"/.test(nav), 'the control says what it does, in the language of the page');

  const home = { sv: html(''), en: html('en'), no: html('no') };
  const BASE_QUESTION = 'What is this starter?';
  check(home.sv.includes(BASE_QUESTION) && !home.sv.includes(EN_QUESTION), 'the site reads its own language on its own front page');
  check(home.en.includes(EN_QUESTION) && !home.en.includes(BASE_QUESTION),
    'a translated FAQ question replaces the original under /en/ — it is not shown beside it');
  check((home.en.split(EN_QUESTION).length - 1) === (home.sv.split(BASE_QUESTION).length - 1),
    'the translation is rendered exactly as many times as the question it replaced — the locale file is no second entry');
  check(home.en.includes('How do I add a page?'), 'a question nobody translated still answers under /en/, in the default language');
  check(home.no.includes(BASE_QUESTION) && !home.no.includes(EN_QUESTION), 'and a language with no file of its own falls back the same way');

  check(home.en.includes(EN_TAGLINE) && !home.sv.includes(EN_TAGLINE), 'the footer under /en/ is the translated footer');
  check(home.no.includes('A block-built starter'), 'an untranslated footer falls back to the one the site started with');
  check(/<p class="mono eyebrow">Links<\/p>/.test(home.en) && /<p class="mono eyebrow">Explore<\/p>/.test(home.sv),
    "a heading the translation leaves empty falls back to the chrome's own word for it, in the page's language");
  check(new RegExp(`href="/en/about" class="footer-link">${EN_LINK}<`).test(home.en),
    'a translated footer link keeps its page — and lands on the address that page has in this language');

  console.log('· the same site with the switcher set to flags…');
  writeFileSync(resolve(STARTER, 'src/content/settings/site.md'),
    saved.get('src/content/settings/site.md').replace(/^name:/m, 'languageSwitcher: flags\nname:'));
  rmSync(DIST, { recursive: true, force: true });
  const flags = buildStatic();
  check(flags.ok, 'the site builds with the flags variant');
  if (!flags.ok) console.error(flags.out);
  const flagged = html('omradet');
  check(/<span class="lang-flags" role="group"/.test(flagged), 'the header carries the flag row instead');
  check(!flagged.includes('lang-switch__panel'), 'and no dropdown — the two variants never both render');
  check((flagged.match(/class="lang-flag[ "]/g) || []).length === 3, 'one flag per language');
  check(/<a class="lang-flag is-current"[^>]*aria-label="Svenska"/.test(flagged),
    'the language being read is the lit one, and every flag says which language it is');
  check(/<a class="lang-flag"[^>]*href="\/en\/the-area"/.test(flagged), 'the flags point at the same addresses the globe did');

  console.log('· a page whose address is not an address…');
  writeFileSync(resolve(PAGES, 'omradet.en.md'), page('The area', 'The Area'));
  rmSync(DIST, { recursive: true, force: true });
  const refused = buildStatic();
  check(!refused.ok, 'the build FAILS rather than serving a URL nobody can link to');
  check(/omradet\.en\.md/.test(refused.out), 'and the failure names the file to fix', refused.out.slice(-400));
} finally {
  for (const f of added) { try { rmSync(f, { force: true }); } catch {} }
  for (const [f, body] of saved) { try { writeFileSync(resolve(STARTER, f), body); } catch {} }
  try { rmSync(DIST, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.error('\n✗ locale-url smoke FAILED'); process.exit(1); }
