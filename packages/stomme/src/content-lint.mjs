import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { parseDocument, LineCounter, isSeq } from 'yaml';

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/;
const BLOCK_KEYS = new Set(['type', 'anchor']);
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

export function legacyIndex(registry) {
  const byType = new Map();
  const slot = (type, list) => {
    if (!byType.has(type)) byType.set(type, new Map());
    const t = byType.get(type);
    if (!t.has(list)) t.set(list, new Map());
    return t.get(list);
  };
  for (const m of registry?.migrations ?? []) {
    const keys = m.kind === 'button-group'
      ? [m.label, ...(Array.isArray(m.href) ? m.href : [m.href])]
      : m.kind === 'drop' ? (Array.isArray(m.fields) ? m.fields : [m.field])
      : m.kind === 'field-move' ? [m.field] : [];
    for (const type of m.blocks ?? []) {
      const keyed = slot(type, m.in ?? '');
      for (const k of keys.filter(Boolean)) keyed.set(k, { to: m.kind === 'drop' ? null : m.to, note: m.note ?? '' });
    }
  }
  return byType;
}

const pathOf = (keys) => keys.reduce((s, k) => (typeof k === 'number' ? `${s}[${k}]` : s ? `${s}.${k}` : String(k)), '');

function walk(value, fields, keys, ctx, out) {
  const declared = new Set(fields.map((f) => f.name));
  for (const f of fields) {
    const v = value[f.name];
    const here = [...keys, f.name];
    if (f.widget === 'object' && Array.isArray(f.fields)) {
      if (isPlainObject(v)) walk(v, f.fields, here, { ...ctx, list: '' }, out);
    } else if (f.widget === 'list' && Array.isArray(f.fields) && Array.isArray(v)) {
      v.forEach((item, i) => { if (isPlainObject(item)) walk(item, f.fields, [...here, i], { ...ctx, list: f.name }, out); });
    } else if (f.widget === 'blocks' && Array.isArray(v)) {
      v.forEach((item, i) => out.push(...lintBlock(item, ctx.catalog, ctx.legacy, [...here, i])));
    }
  }
  const legacy = keys.length === ctx.depth ? ctx.legacy.get(ctx.type)?.get('') : ctx.list ? ctx.legacy.get(ctx.type)?.get(ctx.list) : null;
  for (const k of Object.keys(value)) {
    if (declared.has(k) || (keys.length === ctx.depth && BLOCK_KEYS.has(k))) continue;
    const here = [...keys, k];
    const old = legacy?.get(k);
    out.push(old ? { kind: 'legacy', path: pathOf(here), to: old.to } : { kind: 'unknown', path: pathOf(here) });
  }
}

export function lintBlock(block, catalog, legacy, keys = []) {
  if (!isPlainObject(block)) return [];
  const def = catalog.get(String(block.type ?? ''));
  if (!def) return [{ kind: 'unknown-block', path: pathOf([...keys, 'type']), type: String(block.type ?? '') }];
  const out = [];
  walk(block, def.fields ?? [], keys, { catalog, legacy, type: def.type, depth: keys.length, list: '' }, out);
  return out;
}

export function catalogMap(blocks) {
  return new Map(blocks.map((b) => [b.type, b]));
}

function frontMatter(text) {
  const m = FRONT_MATTER.exec(text);
  if (!m) return null;
  const lines = new LineCounter();
  const doc = parseDocument(m[1], { lineCounter: lines });
  return { doc, lines };
}

export function lintText(text, catalog, legacy) {
  const fm = frontMatter(text);
  if (!fm) return { blocks: [] };
  if (fm.doc.errors.length) return { blocks: [], error: fm.doc.errors[0].message.split('\n')[0] };
  const seq = fm.doc.get('blocks');
  if (!isSeq(seq)) return { blocks: [] };
  const data = fm.doc.toJS();
  return {
    blocks: data.blocks.map((block, index) => {
      const node = seq.items[index];
      const line = node?.range ? fm.lines.linePos(node.range[0]).line + 1 : null;
      return { index, type: isPlainObject(block) ? String(block.type ?? '') : '', line, findings: lintBlock(block, catalog, legacy) };
    }).filter((b) => b.findings.length),
  };
}

export function contentFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true }).map(String)
    .filter((f) => f.endsWith('.md') && !f.split(sep).some((s) => s.startsWith('.')))
    .map((f) => resolve(dir, f))
    .filter((f) => statSync(f).isFile())
    .sort();
}

export function lintContent({ root, blocks, registry, contentDir = 'src/content' }) {
  const catalog = catalogMap(blocks);
  const legacy = legacyIndex(registry);
  const files = [];
  for (const abs of contentFiles(resolve(root, contentDir))) {
    const file = relative(root, abs).split(sep).join('/');
    const res = lintText(readFileSync(abs, 'utf8'), catalog, legacy);
    if (res.blocks.length || res.error) files.push({ file, ...res });
  }
  return { files, counts: countFindings(files) };
}

export function countFindings(files) {
  const counts = { unknown: 0, legacy: 0, 'unknown-block': 0, unreadable: 0 };
  for (const f of files) {
    if (f.error) counts.unreadable++;
    for (const b of f.blocks) for (const x of b.findings) counts[x.kind]++;
  }
  return counts;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function lintSummaryLine(counts) {
  const parts = [];
  if (counts.unknown) parts.push(plural(counts.unknown, 'unknown field', 'unknown fields'));
  if (counts['unknown-block']) parts.push(plural(counts['unknown-block'], 'unknown block type', 'unknown block types'));
  if (counts.legacy) parts.push(plural(counts.legacy, 'legacy field', 'legacy fields'));
  if (counts.unreadable) parts.push(plural(counts.unreadable, 'unreadable front matter', 'unreadable front matters'));
  return parts.join(', ');
}

export function describeFinding(f, type) {
  if (f.kind === 'unknown') return `${f.path}: not a field of ${type}; /admin does not show it`;
  if (f.kind === 'legacy') return f.to ? `${f.path}: an older field that still renders; move it into ${f.to}` : `${f.path}: an older field that no longer renders; remove it`;
  return `${f.type || '(no type)'}: not a block this site has (an addon block needs STOMME_SLOTS_DIR set)`;
}

export function formatReport(result) {
  const out = [];
  for (const f of result.files) {
    out.push(f.file);
    if (f.error) out.push(`  front matter does not parse: ${f.error}`);
    for (const b of f.blocks) {
      out.push(`  line ${b.line ?? '?'} · ${b.type || '(no type)'} (block ${b.index + 1})`);
      for (const x of b.findings) out.push(`    ${describeFinding(x, b.type)}`);
    }
  }
  const summary = lintSummaryLine(result.counts);
  out.push(summary ? `${summary}.` : 'Every block matches the catalog.');
  return out.join('\n');
}
