#!/usr/bin/env node
import { createJiti } from 'jiti';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const {
  FEATURE_DEFAULTS, SITE_DEFAULTS, resolveFeatures, resolveSpecs, listingSpecRows,
  resolveListings, isUnlisted, resolveSite,
} = await jiti.import(resolve(PKG, 'src/config.ts'));
const source = readFileSync(resolve(PKG, 'src/config.ts'), 'utf8');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

// ── features ────────────────────────────────────────────────────────────────
const OPT_IN = Object.entries(FEATURE_DEFAULTS).filter(([, v]) => v === false).map(([k]) => k);
const ON_BY_DEFAULT = Object.entries(FEATURE_DEFAULTS).filter(([, v]) => v === true).map(([k]) => k).sort();

eq(ON_BY_DEFAULT, ['contactForm', 'pages'],
  'contactForm and pages are the only features that are on by default');
check(OPT_IN.length > 0 && OPT_IN.every((k) => resolveFeatures()[k] === false),
  `all ${OPT_IN.length} opt-in features resolve to false with no config — a new engine feature never turns itself on for an existing site`,
  OPT_IN.filter((k) => resolveFeatures()[k] !== false).join(', '));
check(OPT_IN.every((k) => resolveFeatures({})[k] === false),
  'an empty features object resolves every opt-in feature to false');
check(OPT_IN.every((k) => resolveFeatures({ tracking: true })[k] === (k === 'tracking')),
  'switching one feature on leaves the others off');
check(resolveFeatures({ contactForm: false }).contactForm === false,
  'an explicit false beats a default-true feature');
check(resolveFeatures({ pages: false }).pages === false,
  'a site can turn the pages feature off explicitly');
check(resolveFeatures({ somethingNew: true }).somethingNew === true,
  'an unknown flag passes through — an addon can gate on a feature the engine has not declared');

const defaultsBefore = JSON.stringify(FEATURE_DEFAULTS);
resolveFeatures({ blog: true, contactForm: false });
check(JSON.stringify(FEATURE_DEFAULTS) === defaultsBefore,
  'resolveFeatures returns a fresh object and never mutates FEATURE_DEFAULTS');

const ifaceBody = source.slice(source.indexOf('export interface StommeFeatures'), source.indexOf('export const FEATURE_DEFAULTS'));
const declared = [...ifaceBody.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\?:\s*boolean;/gm)].map((m) => m[1]);
check(declared.length > 0 && declared.every((f) => f in FEATURE_DEFAULTS),
  `every flag declared on StommeFeatures (${declared.length}) has a default — a declared-but-defaulted-nowhere flag would resolve to undefined, not false`,
  declared.filter((f) => !(f in FEATURE_DEFAULTS)).join(', '));

// ── spec keys ───────────────────────────────────────────────────────────────
eq(resolveSpecs(['Area', 'Rooms']), [{ key: 'spec_0', label: 'Area' }, { key: 'spec_1', label: 'Rooms' }],
  'a bare string spec keys off its position');
eq(resolveSpecs(), [], 'no specs resolves to an empty list');
eq(resolveSpecs('not a list'), [], 'a non-array specs value resolves to an empty list');
eq(resolveSpecs([{ label: 'Area' }]), [{ key: 'spec_0', label: 'Area' }],
  'an object spec without a key still falls back to its position');
eq(resolveSpecs([{ key: 'area', label: 'Area' }]), [{ key: 'area', label: 'Area' }],
  'an explicit key is used verbatim');

const stored = { specs: { spec_0: '120 m²', spec_1: '4' } };
eq(listingSpecRows(stored, { specs: resolveSpecs(['Area', 'Rooms']) }),
  [{ label: 'Area', value: '120 m²' }, { label: 'Rooms', value: '4' }],
  'stored spec values are read back by key');
eq(listingSpecRows(stored, { specs: resolveSpecs(['Living area', 'Bedrooms']) }),
  [{ label: 'Living area', value: '120 m²' }, { label: 'Bedrooms', value: '4' }],
  'RENAMING a bare string label never orphans stored data — the position keys it');
eq(listingSpecRows(stored, { specs: resolveSpecs(['Rooms', 'Area']) }),
  [{ label: 'Rooms', value: '120 m²' }, { label: 'Area', value: '4' }],
  'REORDERING bare string specs moves stored values onto the wrong labels — the documented trap');
eq(listingSpecRows({ specs: { area: '120 m²', rooms: '4' } },
  { specs: resolveSpecs([{ key: 'rooms', label: 'Rooms' }, { key: 'area', label: 'Area' }]) }),
  [{ label: 'Rooms', value: '4' }, { label: 'Area', value: '120 m²' }],
  'an explicit key survives reordering — values stay with their labels');
eq(listingSpecRows({ specs: { spec_0: '120 m²' } }, { specs: resolveSpecs(['Area', 'Rooms']) }),
  [{ label: 'Area', value: '120 m²' }],
  'a spec the entry never filled in is dropped rather than rendered blank');
eq(listingSpecRows(undefined, undefined), [], 'no entry data and no listing yields no rows');

// ── listings ────────────────────────────────────────────────────────────────
eq(resolveListings([{ id: 'news', route: 'news', preset: 'article' }]),
  [{ id: 'news', route: '/news', preset: 'article', specs: [] }],
  'a route without a leading slash gets one');
eq(resolveListings([{ id: 'a', route: '/a', preset: 'gallery' }]), [],
  'an unknown preset is dropped — only article and catalog are real');
eq(resolveListings([{ route: '/a', preset: 'article' }, { id: 'b', preset: 'article' }]), [],
  'a listing without an id or without a route is dropped');
eq(resolveListings([null, undefined]), [], 'holes in the listings array are dropped');
eq(resolveListings(), [], 'no listings resolves to an empty list');
eq(resolveListings([{ id: 'homes', route: '/homes', preset: 'catalog', specs: ['Area'] }])[0].specs,
  [{ key: 'spec_0', label: 'Area' }], 'a listing carries resolved spec definitions, not the raw input');

// ── noindex ─────────────────────────────────────────────────────────────────
check(isUnlisted('/thanks', ['/thanks']), 'an exact path match is unlisted');
check(isUnlisted('/booking/guest/abc', ['/booking']), 'a descendant of a noindex prefix is unlisted');
check(isUnlisted('/booking/guest', ['/booking/']), 'a trailing slash on the prefix is ignored');
check(!isUnlisted('/bookings', ['/booking']), 'a sibling that merely starts with the prefix is NOT unlisted');
check(!isUnlisted('/anything', ['']), 'an empty noindex entry never matches — it would otherwise hide the whole site');
check(!isUnlisted('/anything', ['   ']), 'a whitespace-only noindex entry never matches');
check(!isUnlisted('/anything', undefined), 'no noindex list leaves every page listed');
check(isUnlisted('/thanks', undefined), 'the form-success route is unlisted without a site having to list it');
check(isUnlisted('/tack/', undefined, '/tack'), "the site's own form-success route is unlisted, trailing slash or not");
check(!isUnlisted('/thanks', undefined, '/tack'), 'moving the route leaves the default path indexable');

// ── locale strings ──────────────────────────────────────────────────────────
const EN = SITE_DEFAULTS.strings;
const sv = resolveSite({ locale: 'sv' }).strings;
eq(sv.readMore, 'Läs mer', 'a Swedish locale resolves the Swedish string set');
eq(resolveSite({ locale: 'sv-SE' }).strings.readMore, 'Läs mer', 'a region tag (sv-SE) still resolves the language');
eq(resolveSite({ locale: 'sv_SE' }).strings.readMore, 'Läs mer', 'an underscore region tag (sv_SE) resolves too');
eq(resolveSite({ locale: 'SV' }).strings.readMore, 'Läs mer', 'the locale is matched case-insensitively');
eq(resolveSite({ locale: 'de-DE' }).strings.readMore, 'Read more', 'an unsupported locale falls back to English');
eq(resolveSite({ cmsLocale: 'sv' }).strings.readMore, 'Läs mer', 'cmsLocale picks the string set when no locale is set');
eq(resolveSite({ locale: 'en-GB', cmsLocale: 'sv' }).strings.readMore, 'Read more', 'locale wins over cmsLocale');
eq(resolveSite().locale, SITE_DEFAULTS.locale, 'no config resolves the default locale');

const groups = Object.entries(EN).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v)).map(([k]) => k);
const untranslated = groups.filter((g) => Object.keys(EN[g]).every((k) => JSON.stringify(EN[g][k]) === JSON.stringify(sv[g][k])));
check(groups.length >= 8 && untranslated.length === 0,
  `all ${groups.length} string groups are translated in the Swedish set — a group added to English only would ship English to a Swedish site`,
  untranslated.join(', '));

const no = resolveSite({ locale: 'no' }).strings;
eq(no.readMore, 'Les mer', 'a Norwegian locale resolves the Norwegian string set');
eq(resolveSite({ locale: 'nb-NO' }).strings.readMore, 'Les mer', 'bokmal (nb-NO) resolves the Norwegian set');
eq(resolveSite({ locale: 'nn' }).strings.readMore, 'Les mer', 'nynorsk resolves the Norwegian set too');
const keyPaths = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
const enKeys = keyPaths(EN).sort();
eq(keyPaths(no).sort(), enKeys, `the Norwegian set has the same ${enKeys.length} keys as English — a missing one would render undefined`);
eq(keyPaths(sv).sort(), enKeys, 'the Swedish set has the same keys as English');
const noUntranslated = groups.filter((g) => Object.keys(EN[g]).every((k) => JSON.stringify(EN[g][k]) === JSON.stringify(no[g][k])));
check(noUntranslated.length === 0,
  `all ${groups.length} string groups are translated in the Norwegian set`, noUntranslated.join(', '));

// ── a locale override renders the chrome in another language than the site's own ──
eq(resolveSite({ locale: 'sv-SE' }, 'no').strings.readMore, 'Les mer', 'resolveSite(config, locale) resolves that locale instead of the site default');
eq(resolveSite({ locale: 'sv-SE' }, 'no').locale, 'no', 'the override is reported as the resolved locale');
eq(resolveSite({ locale: 'sv-SE', strings: { readMore: 'Mer' } }, 'no').strings.readMore, 'Les mer',
  "the site's own string overrides are written in its default language, so a foreign locale drops them");
eq(resolveSite({ locale: 'sv-SE', strings: { readMore: 'Mer' } }, 'sv').strings.readMore, 'Mer',
  'the same language as the site keeps its string overrides');
eq(resolveSite({ locale: 'sv-SE', strings: { readMore: 'Mer' } }).strings.readMore, 'Mer',
  'no override argument leaves resolveSite exactly as it was');

const deepMerged = groups.filter((g) => {
  const keys = Object.keys(EN[g]);
  const out = resolveSite({ locale: 'sv', strings: { [g]: { [keys[0]]: 'OVERRIDDEN' } } }).strings[g];
  return out[keys[0]] === 'OVERRIDDEN' && keys.slice(1).every((k) => out[k] !== undefined);
});
eq(deepMerged.sort(), groups.slice().sort(),
  'overriding one string in a group keeps its siblings — for every group, with no exception');

eq(resolveSite({ strings: { readMore: 'More →' } }).strings.readMore, 'More →', 'a site string overrides the locale default');
eq(resolveSite({ locale: 'sv', strings: { listingCta: 'Boka' } }).strings.listingCta, 'Boka', 'listingCta is overridable');
eq(resolveSite({ locale: 'sv', strings: { listingCta: '' } }).strings.listingCta, 'Kontakta oss', 'an empty listingCta falls back rather than rendering a blank button');

// ── post strings ────────────────────────────────────────────────────────────
const COUNTED = ['yearCount', 'showingLatest', 'archive'];
for (const set of [EN, sv, no])
  check(COUNTED.every((k) => typeof set.post[k] === 'string' && set.post[k] !== ''),
    `the archive strings (${COUNTED.join(', ')}) exist in the ${set.readMore} set`,
    COUNTED.filter((k) => !set.post[k]).join(', '));
for (const set of [EN, sv, no])
  check(set.post.yearCount.includes('{n}') && set.post.showingLatest.includes('{n}'),
    `the counted archive strings carry the {n} placeholder the blocks fill in (${set.readMore})`,
    `${set.post.yearCount} · ${set.post.showingLatest}`);
check(!EN.post.archive.includes('{n}') && !sv.post.archive.includes('{n}'),
  'the archive link is a plain label — it counts nothing, so it carries no placeholder to leave unfilled');

// ── map providers ───────────────────────────────────────────────────────────
eq(EN.map.embed, 'Show interactive map', 'the chip promises the interactive map, not a provider');
eq(EN.map.embedOsm, 'Show interactive map', 'the openstreetmap chip carries the very same label');
eq(EN.map.embedNote, 'Loads from Google when you click', 'the note under the label names the provider and the click');
eq(EN.map.embedLoading, 'Loading the map from Google', 'the label the chip swaps to while the frame loads');
eq(EN.map.embedLoadingOsm, 'Loading the map from OpenStreetMap', 'and the openstreetmap one names openstreetmap');
eq(sv.map.embed, 'Visa interaktiv karta', 'the chip label is Swedish on a Swedish site');
eq(sv.map.embedNote, 'Laddas fr\u00e5n Google n\u00e4r du klickar',
  'the google note names the provider and the click');
eq(sv.map.embedLoading, 'Laddar kartan fr\u00e5n Google', 'the Swedish loading label names Google');
eq(sv.map.embedOsm, 'Visa interaktiv karta', 'the openstreetmap chip label is Swedish on a Swedish site');
eq(sv.map.embedNoteOsm, 'Laddas fr\u00e5n OpenStreetMap n\u00e4r du klickar',
  'the openstreetmap note names the provider and the click');
eq(sv.map.embedLoadingOsm, 'Laddar kartan fr\u00e5n OpenStreetMap', 'the Swedish loading label names openstreetmap');
eq(no.map.embedLoading, 'Laster kartet fra Google', 'Norwegian has the loading label too');
eq(sv.map.google, 'V\u00e4gbeskrivning i Google Maps', 'the directions button says what it hands over');
eq(sv.map.apple, 'V\u00e4gbeskrivning i Apple Kartor', 'and so does the Apple one');
check(sv.map.embedTitle.includes('{address}') && sv.map.embedTitleOsm.includes('{address}'),
  'both frame titles carry the address placeholder the block fills in');
check(!/[.]$/.test(sv.map.embedNote) && !/[.]$/.test(sv.map.embedLoading),
  'the chip lines are labels, not sentences, so neither ends in a full stop');

eq(resolveSite({ maps: { provider: 'osm' } }).maps, { provider: 'osm' },
  'the map provider reaches the blocks through the resolved site');
eq(resolveSite({ maps: { key: 'AIza' } }).maps, { key: 'AIza' }, 'so does a key on its own');
eq(resolveSite().maps, undefined, 'no maps config resolves to nothing for the block to read');

// ── routes ──────────────────────────────────────────────────────────────────
eq(resolveSite({ routes: { blog: '/news' } }).routes, { ...SITE_DEFAULTS.routes, blog: '/news' },
  'overriding one route keeps the other defaults');
eq(resolveSite().routes, SITE_DEFAULTS.routes, 'no config resolves the default routes');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} config checks passed`);
if (failed) { console.error('\n✗ config unit tests FAILED'); process.exit(1); }
