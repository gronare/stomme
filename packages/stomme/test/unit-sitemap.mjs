#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { sitemapExcludes, filterSitemap } = await createJiti(import.meta.url).import(resolve(PKG, 'src/sitemap.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const plain = sitemapExcludes({});
check(plain('thanks/') && plain('/thanks'), 'the thank-you page is left out without the site listing it');
check(!plain('') && !plain('/') && !plain('about/'), 'an ordinary page stays in');

const listed = sitemapExcludes({ noindex: ['/drafts'], routes: { formSuccess: '/sent' } }, ['/docs/main']);
check(listed('drafts/') && listed('drafts/one/'), 'a page under site.noindex is left out');
check(!listed('drafts-old/'), 'a sibling that only shares the prefix stays in');
check(listed('sent/') && !listed('thanks/'), 'the configured thank-you page is left out');
check(listed('docs/main/') && listed('docs/main/how-to/x/'), 'every page of a hidden docs version is left out');
check(!listed('docs/') && !listed('docs/how-to/x/') && !listed('docs/mainline/'), 'the default docs version stays in');

const translated = sitemapExcludes({ locales: ['en', 'sv'], noindex: ['/drafts'] });
check(translated('sv/drafts/') && translated('sv/thanks/'), 'a language copy of an unlisted page is left out too');
check(!translated('sv/'), 'a language home stays in');

const calls = {};
const integration = {
  name: '@astrojs/sitemap',
  hooks: {
    'astro:routes:resolved': (o) => { calls.routes = o.routes.map((r) => r.pathname ?? r.pattern); },
    'astro:build:done': (o) => { calls.pages = o.pages.map((p) => p.pathname); calls.dir = o.dir; },
  },
};
check(filterSitemap(integration, plain), 'the sitemap integration is wrapped');
integration.hooks['astro:routes:resolved']({ routes: [{ pathname: '/thanks' }, { pathname: '/about' }, { pattern: '/docs/[...slug]' }] });
integration.hooks['astro:build:done']({ dir: 'out', pages: [{ pathname: 'thanks/' }, { pathname: '' }, { pathname: 'about/' }] });
check(JSON.stringify(calls.routes) === JSON.stringify(['/about', '/docs/[...slug]']), 'an excluded static route never reaches the sitemap, a dynamic one is kept', JSON.stringify(calls.routes));
check(JSON.stringify(calls.pages) === JSON.stringify(['', 'about/']) && calls.dir === 'out', 'an excluded built page never reaches the sitemap, the other arguments pass through', JSON.stringify(calls));
check(!filterSitemap(undefined, plain), 'a site without the sitemap integration is left alone');

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
