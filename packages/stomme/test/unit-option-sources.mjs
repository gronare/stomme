#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildOptionSources } from '../src/option-sources.mjs';

const results = [];
const check = (ok, name, detail = '') => {
  results.push([!!ok, name]);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const ROUTES = { services: '/tjanster', towns: '/orter', blog: '/blogg' };
const BLOCKS = [
  { type: 'hero', label: 'Hero', group: 'Hero & headers', fields: [], sample: {} },
  { type: 'faqList', label: 'FAQ list', group: 'From collections', collection: 'faq', fields: [], sample: {} },
  { type: 'townList', label: 'Town list', group: 'From collections', collection: 'towns', fields: [], sample: {} },
  { type: 'bookingForm', label: 'Booking', group: 'Calls to action', feature: 'booking', fields: [], samples: [{}] },
  { type: 'catalogList', label: 'Catalog list', group: 'From collections', fields: [], sample: {} },
  { type: 'postList', label: 'Post list', group: 'From collections', fields: [], sample: {} },
  { type: 'sampleless', label: 'Sampleless', group: 'Automatic', fields: [] },
];
const ALL_ON = { pages: true, faq: true, testimonials: true, areas: true, blog: true, services: true, booking: true };

let root;
const warnings = [];
function build(over = {}) {
  const realWarn = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  try {
    return buildOptionSources({ root, ROUTES, FEATURES: ALL_ON, LISTINGS: [], BLOCKS, ...over });
  } finally {
    console.warn = realWarn;
  }
}
const values = (opts) => opts.map((o) => o.value);
const labelOf = (opts, value) => (opts.find((o) => o.value === value) || {}).label;

try {
  root = mkdtempSync(join(tmpdir(), 'stomme-option-sources-'));
  const put = (dir, file, body) => {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, file), body);
  };
  put('src/content/pages', 'about.md', '---\ntitle: "About us"\n---\n');
  put('src/content/pages', 'contact.md', '---\npublished: true\n---\n');
  put('src/content/pages', 'notes.txt', 'ignored');
  put('src/content/services', 'tak.md', '---\ntitle: "Takläggning i hela stan"\nnavLabel: Tak\n---\n');
  put('src/content/services', 'vvs.md', '---\ntitle: "VVS"\n---\n');
  put('src/content/towns', 'lund.md', '---\nname: Lund\n---\n');
  put('src/content/faq', 'pris.md', '---\nquestion: "Vad kostar det?"\ntags:\n  - pris\n  - "tak"\n---\n');
  put('src/content/faq', 'tid.md', '---\nquestion: "Hur lång tid tar det?"\ntags: [tak, "vvs"]\n---\n');
  put('src/content/catalog', 'a.md', '---\ntitle: A\n---\n');

  console.log('· page options');
  const { PAGE_OPTIONS, OPTION_SOURCES, FAQ_TAG_OPTIONS } = build();
  check(PAGE_OPTIONS[0] && PAGE_OPTIONS[0].value === '' && /No page/.test(PAGE_OPTIONS[0].label),
    'the first page option is the empty "no page" choice — a page picker is always clearable');
  check(PAGE_OPTIONS[1] && PAGE_OPTIONS[1].value === '/', 'home is the first real page option', JSON.stringify(PAGE_OPTIONS[1]));
  check(labelOf(PAGE_OPTIONS, '/about') === 'About us (/about)', 'a page is labelled from its frontmatter title, with the route appended',
    labelOf(PAGE_OPTIONS, '/about'));
  check(labelOf(PAGE_OPTIONS, '/contact') === 'contact (/contact)', 'a page with no title falls back to its slug');
  check(values(PAGE_OPTIONS).indexOf('/about') < values(PAGE_OPTIONS).indexOf('/contact'), 'pages are listed in filename order');
  check(!values(PAGE_OPTIONS).some((v) => /notes/.test(v)), 'a non-markdown file in the content folder is not a page');
  check(labelOf(PAGE_OPTIONS, '/tjanster/tak') === 'Tak (/tjanster/tak)',
    'a service is routed under the site\'s configured services route and labelled from navLabel',
    labelOf(PAGE_OPTIONS, '/tjanster/tak'));
  check(labelOf(PAGE_OPTIONS, '/tjanster/vvs') === 'vvs (/tjanster/vvs)', 'a service with no navLabel falls back to its slug — never to its SEO title');
  check(labelOf(PAGE_OPTIONS, '/orter/lund') === 'Lund (/orter/lund)', 'a town is labelled from `name` under the configured towns route');

  console.log('\n· collection option sources');
  check(JSON.stringify(values(OPTION_SOURCES['$services'])) === '["tak","vvs"]', 'a $services option is the bare slug, not a route',
    JSON.stringify(values(OPTION_SOURCES['$services'])));
  check(labelOf(OPTION_SOURCES['$faq'], 'pris') === 'Vad kostar det?', 'a $faq option is labelled with the question');
  check(JSON.stringify(values(FAQ_TAG_OPTIONS)) === '["pris","tak","vvs"]',
    'faq tags are collected from both the block and the inline list form, deduped and sorted',
    JSON.stringify(values(FAQ_TAG_OPTIONS)));
  check(OPTION_SOURCES['$faqTags'] === FAQ_TAG_OPTIONS, 'the tag options are exposed under $faqTags for the select emitter');

  console.log('\n· a site missing every content folder');
  const bare = mkdtempSync(join(tmpdir(), 'stomme-option-sources-bare-'));
  const empty = buildOptionSources({ root: bare, ROUTES, FEATURES: ALL_ON, LISTINGS: [], BLOCKS: [] });
  rmSync(bare, { recursive: true, force: true });
  check(empty.PAGE_OPTIONS.length === 2, 'a site with no content folders still offers "no page" and home', JSON.stringify(empty.PAGE_OPTIONS));
  check(empty.OPTION_SOURCES['$services'].length === 0 && empty.FAQ_TAG_OPTIONS.length === 0, 'missing folders yield empty option lists rather than throwing');

  console.log('\n· collectionEnabled');
  const on = build().collectionEnabled;
  check(on('home') === true, 'home is always enabled');
  check(build({ FEATURES: {} }).collectionEnabled('pages') === true, 'pages is enabled when the flag is simply absent');
  check(build({ FEATURES: undefined }).collectionEnabled('pages') === true, 'pages is enabled when there are no features at all');
  check(build({ FEATURES: { pages: false } }).collectionEnabled('pages') === false, 'pages is disabled ONLY by an explicit false');
  check(build({ FEATURES: { ...ALL_ON, faq: false } }).collectionEnabled('faq') === false,
    'a feature flag turns its collection off even though the content folder exists');
  check(build({ FEATURES: { ...ALL_ON, areas: false } }).collectionEnabled('towns') === false,
    'the towns collection follows the `areas` flag, not a flag of its own name');
  check(build({ FEATURES: { ...ALL_ON, areas: true, towns: false } }).collectionEnabled('towns') === true,
    'a stray `towns` flag does not disable the towns collection');
  check(build({ FEATURES: { ...ALL_ON, blog: false } }).collectionEnabled('posts') === false, 'the posts collection follows the `blog` flag');
  check(on('catalog') === true && on('nosuchthing') === false, 'an unmapped collection follows folder existence');
  check(build({ FEATURES: undefined }).collectionEnabled('faq') === true,
    'with no features at all a mapped collection falls back to folder existence');

  console.log('\n· menu options carry the header contract');
  const LISTINGS = [{ id: 'projects', route: '/projekt', label: 'Projekt', preset: 'article' }, { id: 'stock', route: '/lager', preset: 'catalog' }];
  const menus = build({ LISTINGS }).OPTION_SOURCES['$menus'];
  check(JSON.stringify(values(menus)) === '["services::/tjanster","towns::/orter","projects::/projekt","stock::/lager"]',
    'every menu value is "<collectionId>::<routeBase>" — the separator the site header splits on',
    JSON.stringify(values(menus)));
  check(menus.every((o) => o.value.split('::').length === 2 && o.value.split('::')[1].startsWith('/')),
    'each menu value splits into exactly one id and one absolute route');
  check(labelOf(menus, 'stock::/lager') === 'stock', 'a listing with no label falls back to its id');
  check(values(build({ ROUTES: { ...ROUTES, services: '' } }).OPTION_SOURCES['$menus']).includes('services::/services'),
    'an unset services route falls back to /services rather than emitting a bare separator');
  check(!values(build({ FEATURES: { ...ALL_ON, services: false } }).OPTION_SOURCES['$menus']).some((v) => v.startsWith('services::')),
    'a disabled collection offers no dropdown');

  console.log('\n· block availability');
  const typesOf = (r) => r.AVAILABLE_BLOCKS.map((b) => b.type);
  const withCatalog = [{ id: 'stock', route: '/lager', preset: 'catalog' }];
  const withArticle = [{ id: 'news', route: '/nyheter', preset: 'article' }];
  check(!typesOf(build({ FEATURES: { ...ALL_ON, faq: false } })).includes('faqList'), "a block is dropped when its collection is off");
  check(!typesOf(build({ FEATURES: { ...ALL_ON, booking: false } })).includes('bookingForm'), 'a block is dropped when its feature is off');
  check(typesOf(build({ FEATURES: { ...ALL_ON, booking: true } })).includes('bookingForm'), 'a block whose feature is on survives');
  check(!typesOf(build()).includes('catalogList'), 'catalogList is dropped when no listing uses the catalog preset');
  check(typesOf(build({ LISTINGS: withCatalog })).includes('catalogList'), 'catalogList appears as soon as a catalog listing exists');
  check(typesOf(build({ FEATURES: { ...ALL_ON, blog: true } })).includes('postList'), 'postList appears when the blog feature is on');
  check(typesOf(build({ FEATURES: { ...ALL_ON, blog: false }, LISTINGS: withArticle })).includes('postList'),
    'postList also appears for an article listing without the blog feature');
  check(!typesOf(build({ FEATURES: { ...ALL_ON, blog: false } })).includes('postList'), 'postList is dropped with neither a blog nor an article listing');
  const r = build({ FEATURES: { ...ALL_ON, faq: false } });
  check(r.AVAILABLE_BLOCKS.length + r.SKIPPED_BLOCKS.length === BLOCKS.length
    && !r.SKIPPED_BLOCKS.some((b) => typesOf(r).includes(b.type)),
    'available and skipped blocks partition the catalog — nothing is dropped silently from both');
  check(BLOCKS[0].type === 'hero' && BLOCKS[BLOCKS.length - 1].type === 'sampleless', "the caller's own BLOCKS array is not reordered in place");
  check(warnings.some((w) => /lookbook/.test(w) && /sampleless/.test(w) && !/bookingForm/.test(w)),
    'a block with neither `sample` nor `samples` is reported for the lookbook');

  console.log('\n· picker grouping');
  const grouped = [
    { type: 'auto', group: 'Automatic', fields: [], sample: {} },
    { type: 'made-up', group: 'Not a real group', fields: [], sample: {} },
    { type: 'hero-a', group: 'Hero & headers', fields: [], sample: {} },
    { type: 'text', group: 'Text', fields: [], sample: {} },
    { type: 'hero-b', group: 'Hero & headers', fields: [], sample: {} },
  ];
  const sorted = build({ BLOCKS: grouped }).AVAILABLE_BLOCKS.map((b) => b.type);
  check(JSON.stringify(sorted) === '["hero-a","hero-b","text","auto","made-up"]',
    'blocks are ordered by GROUP_ORDER, an unknown group sorts last, and catalog order survives within a group',
    JSON.stringify(sorted));
  check(build().GROUP_ORDER.includes('Hero & headers'), 'the group order is exported for the picker to render headings from');
} finally {
  if (root) { try { rmSync(root, { recursive: true, force: true }); } catch {} }
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ option-sources unit FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ option sources intact.');
