#!/usr/bin/env node
import { createJiti } from 'jiti';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const STUB = resolve(HERE, 'stub-astro-content.mjs');
const jiti = createJiti(import.meta.url, { alias: { 'astro:content': STUB } });
const { reset } = await jiti.import(STUB);
const {
  TYPE_FIELDS, HEADLINE_DEFAULT, SUBLINE_DEFAULT, normalizePath, ogPages, resolveShareImage,
} = await jiti.import(resolve(PKG, 'src/og-pages.ts'));
const pane = readFileSync(resolve(PKG, 'src/settings-pane.mjs'), 'utf8');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const settings = (og, extra = {}) => ({ 'settings/site': { data: { name: 'Acme', og, ...extra } } });
const entry = (id, data) => ({ id, data });
const at = (pages, path) => pages.find((p) => p.path === path);

// ── normalizePath ───────────────────────────────────────────────────────────
eq(normalizePath('/'), '/', 'the site root normalizes to /');
eq(normalizePath(''), '/', 'an empty path normalizes to /');
eq(normalizePath('news/hello'), '/news/hello', 'a relative path gets a leading slash');
eq(normalizePath('/news/hello/'), '/news/hello', 'a trailing slash is dropped');
eq(normalizePath('/news///'), '/news', 'repeated trailing slashes are dropped');
eq(normalizePath('///'), '/', 'a path of only slashes normalizes to /');
eq(normalizePath('/omr%C3%A5den/malm%C3%B6'), '/områden/malmö', 'a percent-encoded path is decoded so it matches the built page');
eq(normalizePath('/bad%'), '/bad%', 'a malformed escape is left alone instead of throwing');

// ── the per-kind field contract ─────────────────────────────────────────────
eq(Object.keys(TYPE_FIELDS).sort(), ['article', 'catalog', 'services', 'towns'], 'four card kinds are resolved');
check(Object.keys(TYPE_FIELDS).every((k) => k in HEADLINE_DEFAULT && k in SUBLINE_DEFAULT),
  'every kind has a headline and a subline default');
const badHeadline = Object.keys(TYPE_FIELDS).filter((k) => !TYPE_FIELDS[k].includes(HEADLINE_DEFAULT[k]));
check(badHeadline.length === 0, 'every headline default names a field that kind actually resolves', badHeadline.join(', '));
const badSubline = Object.keys(TYPE_FIELDS).filter((k) => SUBLINE_DEFAULT[k] !== 'none' && !TYPE_FIELDS[k].includes(SUBLINE_DEFAULT[k]));
check(badSubline.length === 0, 'every subline default is "none" or a field that kind resolves', badSubline.join(', '));

// The CMS offers these same fields; a select whose value is not resolved would store a var that never renders.
const shareBlock = pane.slice(pane.indexOf('const SHARE_FIELDS'), pane.indexOf('const SHARE_DEFAULTS'));
const shareFields = Object.fromEntries(
  [...shareBlock.matchAll(/^\s{2}([a-z]+): \[(.*)\],$/gm)]
    .map((m) => [m[1], [...m[2].matchAll(/\['([a-zA-Z]+)',/g)].map((x) => x[1])]),
);
check(Object.keys(shareFields).length === 4, `src/settings-pane.mjs offers card fields for ${Object.keys(shareFields).length} kinds`);
for (const kind of Object.keys(TYPE_FIELDS)) {
  eq(shareFields[kind], TYPE_FIELDS[kind], `the CMS field picker for '${kind}' lists exactly the fields TYPE_FIELDS resolves`);
}
const shareDefaults = pane.slice(pane.indexOf('const SHARE_DEFAULTS'), pane.indexOf('function emitShareType'));
for (const kind of Object.keys(TYPE_FIELDS)) {
  const m = shareDefaults.match(new RegExp(`${kind}: \\{ headline: '([a-z]+)', subline: '([a-z]+)' \\}`));
  const [headline, subline] = m ? [m[1], m[2]] : ['title', 'none'];
  eq([headline, subline], [HEADLINE_DEFAULT[kind], SUBLINE_DEFAULT[kind]],
    `the CMS select defaults for '${kind}' mirror the renderer fallbacks`);
}

// ── enumeration ─────────────────────────────────────────────────────────────
reset(settings({ enabled: false }), { posts: [entry('hello', { title: 'Hello' })] });
eq(await ogPages({ features: { blog: true } }), [], 'nothing is enumerated while share cards are switched off');

reset(settings({ enabled: true, types: {} }), {});
eq((await ogPages({})).map((p) => p.slug), ['default.png'],
  'with no site image and no home hero, only the fallback card is enumerated');
reset(settings({ enabled: true, types: {} }, { ogImage: '/media/share.png' }), {});
eq(await ogPages({}), [], 'a site-wide ogImage replaces the generated fallback card');
reset({
  ...settings({ enabled: true, types: {} }),
  'home/home': { data: { blocks: [{ type: 'text' }, { type: 'hero', media: { image: '/media/hero.jpg' } }] } },
}, {});
eq(await ogPages({}), [], 'the home hero image serves as the fallback when no ogImage is set');

const POST = { title: 'Hello', date: '2026-01-01', excerpt: 'Lede', cover: '/media/a.jpg' };
reset(settings({ enabled: true, types: { posts: { enabled: true } } }), { posts: [entry('hello', POST)] });
const blog = await ogPages({ features: { blog: true }, routes: { blog: '/news' } });
const post = at(blog, '/news/hello');
check(!!post, 'the blog folds in as an article listing on its configured route');
eq(post?.slug, 'news/hello.png', 'the card slug follows the path');
eq(post?.card, true, 'an enabled type produces a generated card');
eq(post?.typeKey, 'posts', 'the card carries the type key the CMS settings are stored under');
eq(post?.vars, { business: 'Acme', title: 'Hello', date: '2026-01-01', excerpt: 'Lede' },
  'the card vars are the business name plus exactly the article fields');
eq(post?.headlineDefault, HEADLINE_DEFAULT.article, 'the card carries the kind\'s headline fallback');
eq(post?.image, '/media/a.jpg', 'the entry cover becomes the card image');

reset(settings({ enabled: true, types: { posts: { enabled: true } } }), { posts: [entry('hello', POST)] });
const explicit = await ogPages({ listings: [{ id: 'posts', route: '/journal', preset: 'article' }], features: { blog: true } });
eq(explicit.filter((p) => p.typeKey === 'posts').map((p) => p.path), ['/journal/hello'],
  'an explicit posts listing wins — the blog fold-in never duplicates it');

reset(settings({ enabled: true, types: { posts: { enabled: false } } }, { ogImage: '/media/share.png' }),
  { posts: [entry('hello', POST)] });
const off = at(await ogPages({ features: { blog: true } }), '/blog/hello');
eq([off?.card, off?.raw], [false, '/media/share.png'], 'a type with cards switched off points at the site fallback image');

reset(settings({ enabled: true, types: { posts: { enabled: true } } }, { ogImage: '/media/share.png' }), {
  posts: [
    entry('override', { ...POST, seo: { image: '/media/own.png' } }),
    entry('raw', { ...POST, seo: { ogRaw: true } }),
    entry('rawless', { title: 'No image', seo: { ogRaw: true } }),
    entry('both', { ...POST, seo: { image: '/media/own.png', ogRaw: true } }),
  ],
});
const mixed = await ogPages({ features: { blog: true } });
eq([at(mixed, '/blog/override').card, at(mixed, '/blog/override').raw], [false, '/media/own.png'],
  'an entry\'s seo.image beats everything, including an enabled card type');
eq([at(mixed, '/blog/raw').card, at(mixed, '/blog/raw').raw], [false, '/media/a.jpg'],
  'seo.ogRaw ships the entry\'s own image instead of a generated card');
eq(at(mixed, '/blog/rawless').raw, '/media/share.png',
  'seo.ogRaw on an entry with no image falls back to the site image');
eq(at(mixed, '/blog/both').raw, '/media/own.png',
  'seo.image is checked before seo.ogRaw — an editor who set both gets the image they picked');

reset(settings({ enabled: true, types: { posts: { enabled: true } } }), {
  posts: [
    entry('gallery', { title: 'G', gallery: [{ image: '/media/g1.jpg' }] }),
    entry('hero', { title: 'H', hero: { image: '/media/h.jpg' } }),
    entry('media', { title: 'M', media: { image: '/media/m.jpg' } }),
    entry('both', { title: 'B', cover: '/media/c.jpg', gallery: [{ image: '/media/g1.jpg' }] }),
  ],
});
const images = await ogPages({ features: { blog: true } });
eq(at(images, '/blog/gallery').image, '/media/g1.jpg', 'the first gallery image is used when there is no cover');
eq(at(images, '/blog/hero').image, '/media/h.jpg', 'a hero image is used when there is no cover or gallery');
eq(at(images, '/blog/media').image, '/media/m.jpg', 'a media group image is the last resort');
eq(at(images, '/blog/both').image, '/media/c.jpg', 'the cover wins over the gallery');

reset(settings({ enabled: true, types: { towns: { enabled: true }, services: { enabled: true } } }), {
  towns: [entry('malmo', { name: 'Malmö', heroSubtitle: 'Local' })],
  services: [entry('roof', { title: 'Roofing', navLabel: 'Roof', summary: 'S' })],
});
eq((await ogPages({ features: {} })).filter((p) => p.path).length, 0,
  'towns and services are only enumerated when their features are on');
const gated = await ogPages({ features: { areas: true, services: true }, routes: { towns: '/omraden' } });
eq(at(gated, '/omraden/malmo').vars, { business: 'Acme', name: 'Malmö', title: 'Malmö', heroSubtitle: 'Local' },
  'a town with no title borrows its name so the headline is never blank');
eq(at(gated, '/services/roof').vars, { business: 'Acme', title: 'Roofing', navLabel: 'Roof', summary: 'S' },
  'a service card resolves its own field set');

reset(settings({ enabled: true, types: { homes: { enabled: true } } }), {
  homes: [entry('one', { title: 'Villa', price: '2 400 000', status: 'available', category: 'house', date: '2026-02-02' })],
});
const catalog = at(await ogPages({ listings: [{ id: 'homes', route: 'homes', preset: 'catalog' }] }), '/homes/one');
eq(catalog?.vars, { business: 'Acme', title: 'Villa', price: '2 400 000', status: 'available', category: 'house', date: '2026-02-02' },
  'a catalog card resolves the catalog field set');
eq(catalog?.sublineDefault, 'price', 'a catalog card defaults its subline to the price');
eq(catalog?.typeKey, 'homes', 'a listing keys its card settings under the listing id');

reset(settings({ enabled: true, types: { posts: { enabled: true } } }), { posts: [entry('missing', { title: 'T' })] });
eq(at(await ogPages({ features: { blog: true } }), '/blog/missing').vars,
  { business: 'Acme', title: 'T', date: '', excerpt: '' },
  'a field the entry never filled in resolves to an empty string, not "undefined"');

// ── resolveShareImage ───────────────────────────────────────────────────────
reset(settings({ enabled: false }, { ogImage: '/media/share.png' }), {});
eq(await resolveShareImage('/any', undefined, {}), '/media/share.png', 'with cards off, the site image is the share image');
eq(await resolveShareImage('/any', '/media/page.png', {}), '/media/page.png', 'with cards off, a per-page override wins');

reset(settings({ enabled: true, types: { posts: { enabled: true } } }, { ogImage: '/media/share.png' }), {
  posts: [entry('hello', POST), entry('raw', { ...POST, seo: { ogRaw: true } })],
});
eq(await resolveShareImage('/blog/hello/', undefined, { features: { blog: true } }), '/og/blog/hello.png',
  'a page with a generated card resolves to its card URL, trailing slash and all');
eq(await resolveShareImage('/blog/raw', undefined, { features: { blog: true } }), '/media/a.jpg',
  'a raw-image page resolves to that image, not a card');
eq(await resolveShareImage('/about', undefined, { features: { blog: true } }), '/media/share.png',
  'a page with no card of its own falls back to the site image');
eq(await resolveShareImage('/about', '/media/page.png', { features: { blog: true } }), '/media/page.png',
  'a per-page override still wins over the fallback');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} og-page checks passed`);
if (failed) { console.error('\n✗ og-pages unit tests FAILED'); process.exit(1); }
