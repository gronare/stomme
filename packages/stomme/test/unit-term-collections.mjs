#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { termCollections, seedTerms, termValues, termSlug } from '../src/term-collections.mjs';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

let root;
try {
  root = mkdtempSync(join(tmpdir(), 'stomme-terms-'));
  const put = (dir, file, body) => {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, file), body);
  };
  const ls = (dir) => { try { return readdirSync(join(root, dir)).sort(); } catch { return []; } };
  put('src/content/news', 'a.md', '---\ntitle: A\ncategory: Anslag\n---\n');
  put('src/content/news', 'b.md', '---\ntitle: B\ncategory: "Årsmöte"\n---\n');
  put('src/content/news', 'c.md', '---\ntitle: C\ncategory: Anslag\n---\n');
  put('src/content/news', 'd.md', '---\ntitle: D\ncategory:\ncover: /media/d.jpg\n---\n');
  put('src/content/news', 'd.en.md', '---\ntitle: D\ncategory: Notice\n---\n');
  put('src/content/faq', 'pris.md', '---\nquestion: "Vad kostar det?"\ntags:\n  - pris\n  - "tak"\n---\n');
  put('src/content/faq', 'tid.md', '---\nquestion: "Hur lång tid?"\ntags: [tak, "vvs"]\n---\n');
  put('src/content/documents', 'stadgar.md', '---\ntitle: Stadgar\nfile: /media/s.pdf\ngroup: "Stadgar"\n---\n');
  put('src/content/documents', 'arsred.md', '---\ntitle: Årsredovisning\nfile: /media/a.pdf\ngroup: Årsredovisningar\n---\n');
  put('src/content/documents', 'blank.md', '---\ntitle: Blank\nfile: /media/b.pdf\ngroup: ""\n---\n');
  put('src/content/document-groups', 'stadgar.md', '---\ntitle: "Stadgar"\n---\n');
  const keptBefore = readFileSync(join(root, 'src/content/document-groups/stadgar.md'), 'utf8');
  const keptMtime = statSync(join(root, 'src/content/document-groups/stadgar.md')).mtimeMs;
  const newsBefore = readFileSync(join(root, 'src/content/news/b.md'), 'utf8');

  const terms = termCollections([{ id: 'news', preset: 'article' }]);
  console.log('· what is read');
  check(JSON.stringify(termValues(root, terms.find((t) => t.name === 'news-categories'))) === '["Anslag","Årsmöte"]',
    'a listing\'s categories are its distinct non-blank values, locale siblings and blank values skipped');
  check(JSON.stringify(termValues(root, terms.find((t) => t.name === 'faq-tags'))) === '["pris","tak","vvs"]',
    'the FAQ tags are read from both list styles');
  check(termSlug('Årsmöte') === 'arsmote' && termSlug('Anslag & möten') === 'anslag-moten' && termSlug('!!') === 'term', 'a term file is named by an ascii slug of its value');

  console.log('\n· the first run');
  const log = [];
  const first = seedTerms(root, terms, (l) => log.push(l));
  check(JSON.stringify(ls('src/content/news-categories')) === '["anslag.md","arsmote.md"]', 'one file per distinct category', ls('src/content/news-categories').join(', '));
  check(readFileSync(join(root, 'src/content/news-categories/arsmote.md'), 'utf8') === '---\ntitle: "Årsmöte"\n---\n', 'the term file carries only the value as its title');
  check(JSON.stringify(ls('src/content/faq-tags')) === '["pris.md","tak.md","vvs.md"]', 'one file per distinct FAQ tag');
  check(JSON.stringify(ls('src/content/document-groups')) === '["arsredovisningar.md","stadgar.md"]', 'a group with a term already is not seeded twice');
  check(readFileSync(join(root, 'src/content/document-groups/stadgar.md'), 'utf8') === keptBefore
    && statSync(join(root, 'src/content/document-groups/stadgar.md')).mtimeMs === keptMtime, 'an existing term file is not rewritten');
  check(readFileSync(join(root, 'src/content/news/b.md'), 'utf8') === newsBefore, 'the owning entries are left untouched');
  check(first.length === 6 && log.length === 6 && log.includes('  ↳ seeded news-categories term: src/content/news-categories/arsmote.md (Årsmöte)'),
    'every written file is logged on its own line', log.join('\n    '));

  console.log('\n· the second run');
  const again = [];
  check(seedTerms(root, terms, (l) => again.push(l)).length === 0 && again.length === 0, 'a second run writes nothing', again.join('\n    '));

  console.log('\n· a term kept under another file name');
  put('src/content/news', 'e.md', '---\ntitle: E\ncategory: Möte\n---\n');
  put('src/content/news-categories', 'mote.md', '---\ntitle: "Something else"\n---\n');
  seedTerms(root, terms, () => {});
  check(ls('src/content/news-categories').includes('mote-1.md') && readFileSync(join(root, 'src/content/news-categories/mote.md'), 'utf8') === '---\ntitle: "Something else"\n---\n',
    'a slug already taken gets a suffix; the file holding it is never overwritten', ls('src/content/news-categories').join(', '));

  console.log('\n· a site without the feature');
  const off = termCollections([], (n) => n !== 'faq' && n !== 'documents');
  check(off.length === 0, 'no owner, no term collection to seed');
} finally {
  if (root) rmSync(root, { recursive: true, force: true });
}

console.log('\n· the content collections');
const jiti = createJiti(import.meta.url, { alias: { 'astro:content': resolve(PKG, 'bin/_astro-content-stub.mjs') } });
const { stommeCollections } = await jiti.import(resolve(PKG, 'collections.ts'));
const none = stommeCollections();
check(['faq-tags', 'document-groups', 'posts-categories'].every((n) => none[n]), 'the term collections are defined with no listings at all', Object.keys(none).join(', '));
const withListings = stommeCollections([{ id: 'news', route: '/news', label: 'News', preset: 'article' }, { id: 'stock', route: '/stock', label: 'Stock', preset: 'catalog' }]);
check(withListings['news-categories'] && withListings['stock-categories'], 'every listing gets its categories collection');
check(JSON.stringify(Object.keys(withListings['news-categories'].schema.shape)) === '["title"]', 'a term is a title and nothing else');
check(withListings['news-categories'].schema.safeParse({ title: 'Anslag' }).success && !withListings['news-categories'].schema.safeParse({}).success, 'a term without a title fails the build');
check(withListings['news-categories'].loader.name === 'stomme-empty', 'an absent term folder loads as an empty collection');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} term-collection checks passed`);
if (failed) { console.error('\n✗ term collections unit FAILED'); process.exit(1); }
console.log('✓ term collections intact.');
