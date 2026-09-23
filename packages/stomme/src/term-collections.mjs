import { resolve } from 'node:path';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { contentFilesIn, labelFromFrontmatter, listFromFrontmatter } from './option-sources.mjs';

export const FAQ_TAGS = 'faq-tags';
export const DOCUMENT_GROUPS = 'document-groups';
export const categoriesOf = (listingId) => `${listingId}-categories`;

export function termCollections(listings = [], enabled = () => true) {
  const terms = [];
  if (enabled('faq')) terms.push({ name: FAQ_TAGS, owner: 'faq', field: 'tags', list: true });
  if (enabled('documents')) terms.push({ name: DOCUMENT_GROUPS, owner: 'documents', field: 'group' });
  for (const l of listings) terms.push({ name: categoriesOf(l.id), owner: l.id, field: 'category', listing: l });
  return terms;
}

export function termCollectionNames(listings = []) {
  return [...new Set([FAQ_TAGS, DOCUMENT_GROUPS, categoriesOf('posts'), ...listings.map((l) => categoriesOf(l.id))])];
}

const unescape = (s) => String(s).replace(/\\(.)/g, '$1').replace(/''/g, "'").trim();

export function termValues(root, term) {
  const dir = `src/content/${term.owner}`;
  const values = new Set();
  for (const f of contentFilesIn(root, dir)) {
    const file = resolve(root, dir, f);
    const found = term.list ? listFromFrontmatter(file, term.field) : [labelFromFrontmatter(file, term.field)];
    for (const v of found) if (v && unescape(v)) values.add(unescape(v));
  }
  return [...values].sort();
}

export function termSlug(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'term';
}

const yamlTitle = (value) => (/["\\]/.test(value) ? `'${value.replace(/'/g, "''")}'` : JSON.stringify(value));

export function seedTerms(root, terms, log = console.log) {
  const written = [];
  for (const term of terms) {
    const dir = `src/content/${term.name}`;
    const have = new Set(contentFilesIn(root, dir).map((f) => labelFromFrontmatter(resolve(root, dir, f), 'title')).filter(Boolean).map(unescape));
    const values = termValues(root, term).filter((v) => !have.has(v));
    if (!values.length) continue;
    let taken;
    try { taken = new Set(readdirSync(resolve(root, dir)).map((f) => f.replace(/\.md$/, ''))); } catch { taken = new Set(); }
    mkdirSync(resolve(root, dir), { recursive: true });
    for (const value of values) {
      const base = termSlug(value);
      let slug = base;
      for (let n = 1; taken.has(slug); n++) slug = `${base}-${n}`;
      taken.add(slug);
      const path = `${dir}/${slug}.md`;
      writeFileSync(resolve(root, path), `---\ntitle: ${yamlTitle(value)}\n---\n`);
      written.push(path);
      log(`  ↳ seeded ${term.name} term: ${path} (${value})`);
    }
  }
  return written;
}
