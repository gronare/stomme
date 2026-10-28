#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listingIndexSeed, listingIndexSlug } from '../src/listing-seed.mjs';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const frontmatter = (md) => (md.match(/^---\n([\s\S]*?)\n---\n/) || [])[1] || '';
const topLevel = (md, key) => (frontmatter(md).match(new RegExp(`^${key}: (.*)$`, 'm')) || [])[1];

const blog = listingIndexSeed({ id: 'posts', route: '/blog', label: 'Blog', preset: 'article' });
const shop = listingIndexSeed({ id: 'forsale', route: '/for-sale', label: 'For sale', preset: 'catalog' });

// Pages without `published: true` are never built, so an unpublished seed leaves the listing's own route a 404.
check(topLevel(blog, 'published') === 'true', 'the seeded blog index is published', frontmatter(blog));
check(topLevel(shop, 'published') === 'true', 'the seeded catalog index is published', frontmatter(shop));
check(topLevel(blog, 'title') === '"Blog"' && /type: postList\n    source: posts\n    base: \/blog/.test(blog), 'an article listing seeds a postList over its own source');
check(/type: catalogList\n    source: forsale\n    base: \/for-sale/.test(shop), 'a catalog listing seeds a catalogList over its own source');
check(listingIndexSlug({ id: 'posts', route: '/blog' }) === 'blog' && listingIndexSlug({ id: 'news', route: '/' }) === 'news', 'the seed file is named after the route, or the id at the root');
check(/writeFileSync\(pagePath, listingIndexSeed\(l\)\)/.test(readFileSync(resolve(PKG, 'bin/gen-admin-blocks.mjs'), 'utf8')), 'stomme-gen writes the listing index from listingIndexSeed');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
