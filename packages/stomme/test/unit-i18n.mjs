#!/usr/bin/env node
import { createJiti } from 'jiti';
import { readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildOptionSources } from '../src/option-sources.mjs';
import { makeEmitters } from '../src/emit-fields.mjs';
import { makeCollectionEditors } from '../src/collection-editors.mjs';
import { i18nFlagFor, i18nConfigBlock, localeFilePath, resolveCmsLocales, LOCALIZED_EDITORS } from '../src/cms-i18n.mjs';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const {
  resolveLocales, splitLocalePath, localePathFor, localeHref, localeRoutes, localeLinker, localizeLinks,
  localeEntryId, stripLocaleSuffix,
  defaultLocaleEntries, pickLocaleEntry, htmlLang, pageLang, hreflangLinks, localeSwitcher,
  localeConfig, sitemapI18n,
} = await jiti.import(resolve(PKG, 'src/i18n.ts'));
const stubbed = createJiti(import.meta.url, { alias: { 'astro:content': resolve(PKG, 'bin/_astro-content-stub.mjs') } });
const { localeAwareId } = await stubbed.import(resolve(PKG, 'collections.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const SITE = { locale: 'sv-SE', cmsLocale: 'sv', locales: ['sv', 'en', 'no'] };
const L = resolveLocales(SITE);

// ── the opt-in gate: no locales is today's site, untouched ───────────────────
console.log('\n· a site with no locales list keeps every path it had');
const PLAIN = { locale: 'sv-SE' };
check(resolveLocales(PLAIN).enabled === false, 'no locales list leaves the layer off');
check(resolveLocales({ ...PLAIN, locales: ['sv'] }).enabled === false, 'a single locale is not a language switch — the layer stays off');
check(resolveLocales({ ...PLAIN, locales: ['sv', 'sv'] }).enabled === false, 'the same locale twice is still one locale');
eq(pageLang('/en/kontakt', PLAIN), 'sv-SE', "without locales even an /en/ path renders the site's own lang");
eq(pageLang('/', {}), 'en', 'a config with no locale at all still lands on en');
eq(hreflangLinks('/kontakt', PLAIN, 'https://x.se'), [], 'no locales emits no alternates');
eq(localeSwitcher('/kontakt', PLAIN, ['kontakt']), [], 'no locales renders no switcher');
eq(sitemapI18n(PLAIN), {}, 'no locales adds nothing to the sitemap config');
eq(localeHref('/kontakt', 'en', localeRoutes(PLAIN, [{ id: 'kontakt', data: { published: true } }])), '/kontakt',
  'no locales leaves every href alone');
const plainEntries = [{ id: 'kontakt' }, { id: 'kontakt.en' }];
check(defaultLocaleEntries(plainEntries, PLAIN) === plainEntries,
  'no locales returns the very same entry list — the pages route cannot change shape');
check(localeConfig(SITE, 'sv') === SITE, 'the default locale reuses the site config object as-is');

// ── route resolution ────────────────────────────────────────────────────────
console.log('\n· which locale a path is in');
eq(L.default, 'sv', 'the first locale in the list is the default');
eq(splitLocalePath('/', L), { locale: 'sv', path: '/' }, 'the site root is the default locale');
eq(splitLocalePath('/en', L), { locale: 'en', path: '/' }, 'a bare locale prefix is that locale at its root');
eq(splitLocalePath('/en/', L), { locale: 'en', path: '/' }, 'a trailing slash on the locale root changes nothing');
eq(splitLocalePath('/en/kontakt', L), { locale: 'en', path: '/kontakt' }, 'the prefix is stripped off the page path');
eq(splitLocalePath('/en/kontakt/', L), { locale: 'en', path: '/kontakt' }, 'a built page URL with a trailing slash resolves the same');
eq(splitLocalePath('/kontakt', L), { locale: 'sv', path: '/kontakt' }, 'an unprefixed path is the default locale');
eq(splitLocalePath('/sv/kontakt', L), { locale: 'sv', path: '/sv/kontakt' },
  'the default locale is never a URL prefix — a page really called sv/... keeps its path');
eq(splitLocalePath('/de/kontakt', L), { locale: 'sv', path: '/de/kontakt' }, 'a locale the site does not have is just a page path');
eq(splitLocalePath('/EN/kontakt', L), { locale: 'en', path: '/kontakt' }, 'the prefix is matched case-insensitively');

console.log('\n· building a path in another locale');
eq(localePathFor('/kontakt', 'en', L), '/en/kontakt', 'a page path gains the prefix');
eq(localePathFor('/', 'en', L), '/en/', 'the locale front page is the prefix itself');
eq(localePathFor('/kontakt', 'sv', L), '/kontakt', 'the default locale is served unprefixed');

// The locale routes are `/<loc>` and `/<loc>/[...slug]` (integration.mjs) and the catch-all's static paths are the published, non-suffixed `pages` entries (localePagesEntrypoint) — everything else is built once, in the default language.
console.log('\n· a link is prefixed only where the locale is served');
const PAGES = [
  { id: 'kontakt', data: { published: true } },
  { id: 'omradet', data: { published: true } },
  { id: 'utkast', data: { published: false } },
  { id: 'kontakt.en', data: { published: false } },
  { id: 'guider/vinter', data: { published: true } },
];
const R = localeRoutes(SITE, PAGES);
eq([...R.served].sort(), ['/', '/guider/vinter', '/kontakt', '/omradet'],
  'the served set is home plus every published page, translations and drafts left out');
eq(localeHref('/kontakt', 'en', R), '/en/kontakt', 'a localized page is rewritten into the current locale');
eq(localeHref('/omradet', 'no', R), '/no/omradet', 'the same rule holds for every locale in the list');
eq(localeHref('/guider/vinter', 'en', R), '/en/guider/vinter', 'a nested page slug is prefixed too');
eq(localeHref('/', 'en', R), '/en/', 'a link home lands on the locale front page');
eq(localeHref('/bokning/stugan', 'en', R), '/bokning/stugan',
  'a booking route has no locale route — the link stays bare instead of pointing at a 404');
eq(localeHref('/tack', 'en', R), '/tack', "the form confirmation is built once — it is not prefixed");
eq(localeHref('/utkast', 'en', R), '/utkast', 'an unpublished page is not served in any language, prefixed or not');
eq(localeHref('/nagot-okant', 'en', R), '/nagot-okant', 'an unknown path is left alone — refuse rather than guess');
eq(localeHref('/kontakt', 'sv', R), '/kontakt', 'the default locale is never a prefix');
eq(localeHref('/en/kontakt', 'en', R), '/en/kontakt', 'a link that already carries the prefix is not prefixed twice');
eq(localeHref('/no/kontakt', 'en', R), '/no/kontakt', 'a deliberate link into another locale is left as written');
eq(localeHref('/kontakt#form', 'en', R), '/en/kontakt#form', 'a fragment rides along with the page it belongs to');
eq(localeHref('/kontakt/', 'en', R), '/en/kontakt/', 'a trailing slash is preserved');
eq(localeHref('https://example.com/x', 'en', R), 'https://example.com/x', 'an external link is left alone');
eq(localeHref('#section', 'en', R), '#section', 'an anchor is left alone');
eq(localeHref('mailto:a@b.se', 'en', R), 'mailto:a@b.se', 'a mailto link is left alone');
eq(localeHref('tel:+4670', 'en', R), 'tel:+4670', 'a tel: link is left alone');
eq(localeHref('//cdn.example.com/x', 'en', R), '//cdn.example.com/x', 'a protocol-relative link is left alone');
eq(localeHref('', 'en', R), '', 'an empty href stays empty — a nav item with no link must not become a link home');
check(localeRoutes(PLAIN, PAGES).served.size === 0, 'a site with no locales serves no locale routes at all');

console.log('\n· the linker the components use');
const link = localeLinker(SITE, 'en', PAGES);
eq([link('/kontakt'), link('/bokning/stugan'), link('/')], ['/en/kontakt', '/bokning/stugan', '/en/'],
  'one mapper per rendered page, so no component needs the route table');
eq(localeLinker(PLAIN, 'en', PAGES)('/kontakt'), '/kontakt', 'without locales the mapper is the identity');

console.log('\n· block link fields follow the page they are rendered on');
const BLOCKS_IN = [
  { type: 'cover', cta: { label: 'Boka', link: { page: '/bokning/stugan' } }, cta2: { label: 'Området', link: { page: '/omradet' } } },
  { type: 'featureGrid', items: [{ title: 'A', link: '/kontakt' }, { title: 'B', link: 'https://x.se' }] },
  { type: 'faq', asideCtaHref: '/kontakt', asideHref: '/tack' },
  { type: 'ctaBox', href2: '/omradet', heading: 'Läs mer', media: { image: '/media/kontakt.jpg' } },
];
const OUT = localizeLinks(BLOCKS_IN, link);
eq(OUT[0].cta.link.page, '/bokning/stugan', 'a CTA to a route without a locale keeps its bare path');
eq(OUT[0].cta2.link.page, '/en/omradet', 'a CTA to a localized page is rewritten');
eq(OUT[1].items[0].link, '/en/kontakt', 'a plain-string link field is rewritten as well');
eq(OUT[1].items[1].link, 'https://x.se', 'an external item link is left alone');
eq([OUT[2].asideCtaHref, OUT[2].asideHref], ['/en/kontakt', '/tack'], 'the legacy *Href fields go through the same rule');
eq(OUT[3].href2, '/en/omradet', 'a numbered legacy href is a link field too');
eq(OUT[3].media.image, '/media/kontakt.jpg', 'a media path is not a link — it is left untouched');
eq(OUT[0].cta.label, 'Boka', 'labels and every other field are carried through unchanged');
check(localizeLinks(BLOCKS_IN, (h) => h) === BLOCKS_IN, 'a pass that changes nothing returns the very same blocks');
check(BLOCKS_IN[0].cta2.link.page === '/omradet', 'the source blocks are never mutated');
const WITH_DATE = [{ type: 'post', date: new Date('2026-01-01'), link: '/kontakt' }];
check(localizeLinks(WITH_DATE, link)[0].date instanceof Date, 'a Date in block data survives the pass as a Date');

// ── the locale file, and what happens when there is none ────────────────────
console.log('\n· the translation, or the fallback');
const ENTRIES = [{ id: 'kontakt' }, { id: 'kontakt.en' }, { id: 'om-oss' }, { id: 'home' }, { id: 'home.no' }];
eq(localeEntryId('kontakt', 'en', 'sv'), 'kontakt.en', 'a locale entry is the id plus the locale');
eq(localeEntryId('kontakt', 'sv', 'sv'), 'kontakt', 'the default locale entry is the plain id');
const hit = pickLocaleEntry(ENTRIES, 'kontakt', 'en', L);
eq([hit.entry.id, hit.locale, hit.translated], ['kontakt.en', 'en', true], 'a page with a translation renders it, in that language');
const miss = pickLocaleEntry(ENTRIES, 'om-oss', 'en', L);
eq([miss.entry.id, miss.locale, miss.translated], ['om-oss', 'sv', false],
  'a page with no translation still answers under /en/ — with the default content, reported as the default language');
const own = pickLocaleEntry(ENTRIES, 'kontakt', 'sv', L);
eq([own.entry.id, own.locale, own.translated], ['kontakt', 'sv', false], 'the default locale reads the plain entry');
eq(pickLocaleEntry(ENTRIES, 'home', 'no', L).entry.id, 'home.no', 'the home entry localizes like any other');
eq(defaultLocaleEntries(ENTRIES, SITE).map((e) => e.id), ['kontakt', 'om-oss', 'home'],
  'locale files never become pages of their own — the unprefixed route builds the default set only');
eq(stripLocaleSuffix('kontakt.en', L.locales), { id: 'kontakt', locale: 'en' }, 'a configured locale suffix is recognised');
eq(stripLocaleSuffix('kontakt.de', L.locales), { id: 'kontakt.de', locale: null }, 'a suffix the site has no locale for is part of the id');

// ── <html lang> ─────────────────────────────────────────────────────────────
console.log('\n· the language the page declares');
eq(htmlLang('sv', SITE), 'sv-SE', "the default locale keeps the site's full language tag");
eq(htmlLang('en', SITE), 'en', 'another locale declares its own code');
eq(htmlLang('no', { ...SITE, localeTags: { no: 'nb-NO' } }), 'nb-NO', 'localeTags maps a locale to the tag it should publish');
eq(pageLang('/en/kontakt', SITE), 'en', 'a locale route declares that locale');
eq(pageLang('/en/om-oss', SITE, 'sv'), 'sv-SE', 'a fallback page declares the language it is actually written in, not the one in the URL');
eq(pageLang('/', SITE), 'sv-SE', 'the site root declares the default');

// ── hreflang ────────────────────────────────────────────────────────────────
console.log('\n· hreflang alternates');
const alts = hreflangLinks('/kontakt', SITE, 'https://ex.se');
eq(alts.map((a) => a.hreflang), ['sv-SE', 'en', 'no', 'x-default'], 'every configured locale is listed, and x-default closes the set');
eq(alts.map((a) => a.href), ['https://ex.se/kontakt', 'https://ex.se/en/kontakt', 'https://ex.se/no/kontakt', 'https://ex.se/kontakt'],
  'x-default points at the default locale');
eq(hreflangLinks('/kontakt/', SITE, 'https://ex.se').map((a) => a.href),
  ['https://ex.se/kontakt/', 'https://ex.se/en/kontakt/', 'https://ex.se/no/kontakt/', 'https://ex.se/kontakt/'],
  'the alternate carries the same trailing slash as the canonical, or the two name different pages');
eq(hreflangLinks('/en/kontakt', SITE, 'https://ex.se').map((a) => a.href),
  ['https://ex.se/kontakt', 'https://ex.se/en/kontakt', 'https://ex.se/no/kontakt', 'https://ex.se/kontakt'],
  'the set is the same seen from any locale');
eq(hreflangLinks('/', SITE, 'https://ex.se').map((a) => a.href),
  ['https://ex.se/', 'https://ex.se/en/', 'https://ex.se/no/', 'https://ex.se/'], 'the front pages point at the locale roots');
eq(hreflangLinks('/kontakt', SITE).map((a) => a.href), ['/kontakt', '/en/kontakt', '/no/kontakt', '/kontakt'],
  'without a site URL the alternates stay relative rather than inventing a host');

// ── the switcher ────────────────────────────────────────────────────────────
console.log('\n· the language switcher');
const TRANSLATED = ['kontakt', 'kontakt.en', 'home', 'home.no'];
const sw = localeSwitcher('/kontakt', SITE, TRANSLATED);
eq(sw.map((l) => l.label), ['SV', 'EN', 'NO'], 'the switcher is the locale codes, in configured order');
eq(sw.map((l) => l.href), ['/kontakt', '/en/kontakt', '/no/'],
  'a locale with a translation links to the page; one without links to its front page');
eq(sw.map((l) => l.current), [true, false, false], 'the locale being read is marked current');
eq(localeSwitcher('/en/kontakt', SITE, TRANSLATED).map((l) => l.href), ['/kontakt', '/en/kontakt', '/no/'],
  'the same three targets from inside a locale');
eq(localeSwitcher('/no/kontakt', SITE, TRANSLATED).map((l) => l.href), ['/kontakt', '/en/kontakt', '/no/kontakt'],
  'the language you are already reading links to the page you are on, translated or not');
eq(localeSwitcher('/', SITE, TRANSLATED).map((l) => l.href), ['/', '/en/', '/no/'],
  'on the front page the switcher is the three front pages');
eq(localeSwitcher('/areas/oslo', SITE, TRANSLATED).map((l) => l.href), ['/areas/oslo', '/en/', '/no/'],
  'a route with no page entry sends the other locales to their front page');

// ── sitemap ─────────────────────────────────────────────────────────────────
console.log('\n· sitemap alternates');
eq(sitemapI18n(SITE), { i18n: { defaultLocale: 'sv', locales: { sv: 'sv-SE', en: 'en', no: 'no' } } },
  'the sitemap integration gets the same locale-to-tag map the head uses');

// ── entry ids ───────────────────────────────────────────────────────────────
console.log('\n· the content loader keeps the locale in the id');
eq(localeAwareId('kontakt.en.md'), 'kontakt.en', "the locale survives — Astro's own slug would collapse it into kontakten");
eq(localeAwareId('kontakt.md'), 'kontakt', 'a plain file keeps its plain id');
eq(localeAwareId('kontakt.nb-NO.md'), 'kontakt.nb-no', 'a region tag survives, lowercased');
eq(localeAwareId('Om Oss.md'), 'om-oss', 'the stem is still lowercased and spaced-slugged');
eq(localeAwareId('sub/index.md'), 'sub', 'an index file still names its folder');
eq(localeAwareId('sub/sida.en.md'), 'sub/sida.en', 'a locale file in a subfolder keeps both');
eq(localeAwareId('report.v2.md'), 'reportv2', 'a dotted stem that is not a language tag collapses as it always did');
const contentRoot = resolve(PKG, '../../starter/src/content');
const names = [];
for (const dir of readdirSync(contentRoot, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  for (const f of readdirSync(resolve(contentRoot, dir.name), { recursive: true })) {
    if (String(f).endsWith('.md')) names.push(String(f));
  }
}
const moved = names.filter((n) => localeAwareId(n) !== n.replace(/\.md$/, ''));
check(names.length > 0 && moved.length === 0,
  `all ${names.length} starter content files keep the id they already had`, moved.join(', '));

// ── the CMS declaration ─────────────────────────────────────────────────────
console.log('\n· what the generator writes into the CMS config');
eq(resolveCmsLocales(['sv', 'en', 'no']), ['sv', 'en', 'no'], 'the locale list is passed through');
eq(resolveCmsLocales(['sv']), [], 'one locale writes no i18n declaration at all');
eq(resolveCmsLocales(undefined), [], 'no locales writes no i18n declaration at all');
eq(i18nConfigBlock([]), '', 'the declaration is empty without locales — a site keeps the config.yml it had');
eq(i18nConfigBlock(['sv', 'en', 'no']),
  'i18n:\n  structure: multiple_files\n  locales: [sv, en, no]\n  default_locale: sv\n  initial_locales: default\n  omit_default_locale_from_file_path: true',
  'file-per-locale, with the default locale left unsuffixed');
// Sveltia 0.201.2 branches on the literal string: `all` opens every pane, `default` opens the default locale's only, an array names the extra ones. Validation runs in every OPEN pane, so without this a new entry cannot be saved until all three languages are written.
check(/^ {2}initial_locales: default$/m.test(i18nConfigBlock(['sv', 'en', 'no'])),
  'a new entry opens in the default language alone — the other panes are toggled on per entry');
check(!i18nConfigBlock(['sv', 'en']).includes('save_all_locales'),
  'the deprecated save_all_locales is never emitted — 0.201.2 warns on it and drops it at 1.0');
eq(localeFilePath('src/content/home/home.md'), 'src/content/home/home.{{locale}}.md',
  'a file collection carries the locale in its path — Sveltia needs the placeholder to write per-locale files');
eq(LOCALIZED_EDITORS, ['home', 'pages', 'nav'], 'only the page-like editors are localized — settings and sync-owned data are not');

console.log('\n· every field declares its i18n, or Sveltia drops it on save');
eq(i18nFlagFor({ widget: 'string' }), 'true', 'text is translated');
eq(i18nFlagFor({ widget: 'text' }), 'true', 'a text area is translated');
eq(i18nFlagFor({ widget: 'markdown' }), 'true', 'markdown is translated');
eq(i18nFlagFor({ widget: 'object' }), 'true', 'an object descends into its children');
eq(i18nFlagFor({ widget: 'list' }), 'true', 'a list descends into its children');
for (const w of ['boolean', 'number', 'select', 'image', 'file', 'color', 'datetime', 'hidden', 'relation'])
  eq(i18nFlagFor({ widget: w }), 'duplicate', `a ${w} field is copied from the default locale, not translated`);
eq(i18nFlagFor({ widget: 'string', i18n: false }), null, 'a field can opt out by name');

const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const pad = (n) => ' '.repeat(n);
const AVAILABLE_BLOCKS = [
  { type: 'hero', label: 'Hero', fields: [
    { name: 'heading', label: 'Heading', widget: 'string' },
    { name: 'media', label: 'Media', widget: 'object', collapsed: true, fields: [{ name: 'image', label: 'Image', widget: 'image', required: false }] },
    { name: 'ticks', label: 'Ticks', widget: 'list', required: false, field: { name: 'text', label: 'Line', widget: 'string' } },
    { name: 'surface', label: 'Surface', widget: 'select', options: [{ label: 'Tint', value: 'tint' }] },
  ] },
  { type: 'empty', label: 'Empty', fields: [] },
];
const OPTION_SOURCES = { $pages: [{ label: 'Home (/)', value: '/' }], $menus: [] };
const E = makeEmitters({ q, pad, AVAILABLE_BLOCKS, OPTION_SOURCES });

const FIELD_SHAPES = [
  { name: 'heading', label: 'Heading', widget: 'string' },
  { name: 'media', label: 'Media', widget: 'object', collapsed: true, fields: [{ name: 'image', label: 'Image', widget: 'image', required: false }] },
  { name: 'ticks', label: 'Ticks', widget: 'list', required: false, field: { name: 'text', label: 'Line', widget: 'string' } },
  { name: 'rows', label: 'Rows', widget: 'list', required: false, fields: [{ name: 'label', label: 'Label', widget: 'string' }] },
  { name: 'surface', label: 'Surface', widget: 'select', options: [{ label: 'Tint', value: 'tint' }] },
  { name: 'pick', label: 'Pick', widget: 'relation', collection: 'towns', required: false },
];
const unflagged = FIELD_SHAPES.filter((f) => E.emitField(f, 4) !== E.emitField(f, 4, false));
check(unflagged.length === 0,
  `all ${FIELD_SHAPES.length} field shapes emit byte-identically with the i18n flag off`, unflagged.map((f) => f.name).join(', '));
check(E.emitWidget(4) === E.emitWidget(4, false), 'the sections widget emits byte-identically with the i18n flag off');
check(E.emitNavLinks(4) === E.emitNavLinks(4, false), 'the nav links emit byte-identically with the i18n flag off');

const localizedWidget = E.emitWidget(4, true);
const widgets = (localizedWidget.match(/\bwidget:/g) || []).length;
const flags = (localizedWidget.match(/\bi18n:/g) || []).length;
check(widgets > 0 && flags === widgets,
  `every one of the ${widgets} declared fields carries an i18n flag — an undeclared key is deleted from the translation on save`,
  `widgets=${widgets} flags=${flags}`);
check(/- name: hero\n\s+label: "Hero"\n\s+widget: object\n\s+i18n: true\n/.test(localizedWidget),
  'each section type declares i18n so its own fields are reachable in a translation');
check(/name: _auto, label: "Auto", widget: hidden, i18n: duplicate/.test(localizedWidget),
  'even the placeholder field of a field-less block is declared');

const plainEditors = makeCollectionEditors({ q, emitField: E.emitField, emitWidget: E.emitWidget, buttonField: E.buttonField });
const offEditors = makeCollectionEditors({ q, emitField: E.emitField, emitWidget: E.emitWidget, buttonField: E.buttonField, localized: () => false });
const onEditors = makeCollectionEditors({ q, emitField: E.emitField, emitWidget: E.emitWidget, buttonField: E.buttonField, localized: (n) => LOCALIZED_EDITORS.includes(n) });
for (const name of ['home', 'pages', 'faq', 'services', 'towns', 'testimonials'])
  check(plainEditors.COLLECTION_EDITORS[name] === offEditors.COLLECTION_EDITORS[name],
    `the ${name} editor is byte-identical whether or not a locale list is asked for`);
check(/^- name: home\n  label: "Home page"\n  i18n: true\n/.test(onEditors.COLLECTION_EDITORS.home), 'a localized home collection declares i18n');
check(onEditors.COLLECTION_EDITORS.home.includes('file: "src/content/home/home.{{locale}}.md"'), "home's file path carries the locale placeholder");
check(/\n      i18n: true\n      fields:/.test(onEditors.COLLECTION_EDITORS.home), 'the home FILE declares i18n too — a collection flag alone localizes nothing');
check(/\n  slug: "\{\{slug\}\}"\n  i18n: true\n/.test(onEditors.COLLECTION_EDITORS.pages), 'a localized pages collection declares i18n');
check(onEditors.COLLECTION_EDITORS.pages.includes('name: published, label: "Published", widget: boolean, default: true, required: false, hint: "Uncheck to hide the page — unpublished pages aren\'t built.", i18n: duplicate'),
  'publication is one decision for every language, not one per translation');
check(onEditors.COLLECTION_EDITORS.faq === offEditors.COLLECTION_EDITORS.faq, 'an editor outside the localized set is untouched');
// Sveltia writes its canonical-slug key (`translationKey`) into the frontmatter only when the slug template carries a `| localize` filter — that is the sole trigger (Aue → jue → ede in 0.201.2). Our slug is the same in every language, so nothing undeclared is ever written; a `| localize` here would start writing a key no schema knows.
for (const name of LOCALIZED_EDITORS.filter((n) => onEditors.COLLECTION_EDITORS[n]))
  check(!/\|\s*localize/.test(onEditors.COLLECTION_EDITORS[name]) && !onEditors.COLLECTION_EDITORS[name].includes('canonical_slug'),
    `${name} keeps one slug for every language — no localized slug, so no translationKey is written into the content`);

console.log('\n· the CMS link picker offers pages, not translations');
const tmp = mkdtempSync(join(tmpdir(), 'stomme-i18n-'));
mkdirSync(join(tmp, 'src/content/pages'), { recursive: true });
writeFileSync(join(tmp, 'src/content/pages/about.md'), '---\ntitle: About\n---\n');
writeFileSync(join(tmp, 'src/content/pages/about.en.md'), '---\ntitle: About\n---\n');
const optsOf = (LOCALES) => buildOptionSources({ root: tmp, ROUTES: {}, FEATURES: { pages: true }, LISTINGS: [], BLOCKS: [], LOCALES })
  .PAGE_OPTIONS.map((o) => o.value);
eq(optsOf(['sv', 'en', 'no']), ['', '/', '/about'], 'a translation is not offered as a second link target');
eq(optsOf([]), ['', '/', '/about'],
  'a translation is a translation before the languages are switched on — the picker never offers /about.en');
rmSync(tmp, { recursive: true, force: true });

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} i18n checks passed`);
process.exit(passed === results.length ? 0 : 1);
