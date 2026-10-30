import { plainText } from './docs.mjs';

const trimSlashes = (s) => String(s ?? '').replace(/^\/+|\/+$/g, '');
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

export const FIELD_POLICY = 'A field left out of a page renders as its default, so a block written by hand and the same block added in the CMS render alike. Every switch defaults to off: write out each one you want on. stomme-lint-content reports fields the catalog does not declare.';

function readingOrder(version) {
  const byPath = new Map(version.pages.map((p) => [p.path, p]));
  const seen = new Set();
  const listed = [];
  for (const s of version.nav) for (const g of s.groups) for (const i of g.items) {
    if (!i.path || seen.has(i.path) || !byPath.has(i.path)) continue;
    seen.add(i.path);
    listed.push(byPath.get(i.path));
  }
  return { listed, unlisted: version.pages.filter((p) => !seen.has(p.path)) };
}

function aboutLine(version, data, links) {
  const where = [data.repo, data.path].filter(Boolean).join('/') || 'the docs folder';
  const what = version.kind === 'local' ? `the docs of ${where}, built from a local folder` : version.kind === 'release' ? `the docs of ${where} at release ${version.label}` : `the docs of ${where} on the unreleased ${version.label} branch`;
  const files = [`[llms-full.txt](${links.full}) holds every page in one file`];
  if (links.blocks) files.push(`[blocks.json](${links.blocks}) is the block catalog with every field, its type and its default`);
  return `These are ${what}. Every link below is a page as Markdown; the same page as HTML is at the URL without \`.md\`. ${files.join(', and ')}.`;
}

export function llmsTxt(version, data, { abs = (u) => u, blocks = null, others = [] } = {}) {
  const base = `/${trimSlashes(version.base)}`;
  const out = [`# ${oneLine(version.home.title)}`, ''];
  if (version.home.lede) out.push(`> ${oneLine(version.home.lede)}`, '');
  out.push(aboutLine(version, data, { full: abs(`${base}/llms-full.txt`), blocks: blocks && abs(blocks) }), '');
  if (others.length) out.push(`Other versions: ${others.map((o) => `[${o.label}](${abs(`/${trimSlashes(o.base)}/llms.txt`)})`).join(', ')}.`, '');
  const pageOf = new Map(version.pages.map((p) => [p.path, p]));
  const listedPaths = new Set();
  for (const s of version.nav) {
    const lines = [];
    for (const g of s.groups) for (const i of g.items) {
      const page = i.path ? pageOf.get(i.path) : null;
      if (page) listedPaths.add(page.path);
      const description = oneLine(plainText(i.descriptionHtml)) || (page ? oneLine(page.lede) : '');
      lines.push(`- [${oneLine(i.title)}](${abs(page ? page.markdownUrl : i.url)})${description ? `: ${description}` : ''}`);
    }
    if (lines.length) out.push(`## ${oneLine(plainText(s.nameHtml))}`, '', ...lines, '');
  }
  const unlisted = version.pages.filter((p) => !listedPaths.has(p.path));
  if (unlisted.length) out.push('## Optional', '', ...unlisted.map((p) => `- [${oneLine(p.title)}](${abs(p.markdownUrl)})${p.lede ? `: ${oneLine(p.lede)}` : ''}`), '');
  return `${out.join('\n').trimEnd()}\n`;
}

export function llmsFullTxt(version, data, { abs = (u) => u, blocks = null } = {}) {
  const base = `/${trimSlashes(version.base)}`;
  const prefix = data.path ? `${data.path}/` : '';
  const { listed, unlisted } = readingOrder(version);
  const out = [`# ${oneLine(version.home.title)}`, ''];
  if (version.home.lede) out.push(`> ${oneLine(version.home.lede)}`, '');
  out.push(aboutLine(version, data, { full: abs(`${base}/llms-full.txt`), blocks: blocks && abs(blocks) }), '');
  const entry = (path, url, md) => ['---', '', `Source: ${prefix}${path} (${abs(url)})`, '', String(md ?? '').trim(), ''];
  out.push(...entry(version.home.path, version.home.url, version.home.markdown));
  for (const p of [...listed, ...unlisted]) out.push(...entry(p.path, p.url, p.markdown));
  return `${out.join('\n').trimEnd()}\n`;
}

function fieldJson(f) {
  const o = { name: f.name, label: f.label, widget: f.widget, required: f.required ?? true };
  if (f.default !== undefined) o.default = f.default;
  if (f.multiple) o.multiple = true;
  if (Array.isArray(f.options)) o.options = f.options.map((x) => (x && typeof x === 'object' ? { value: x.value, label: x.label } : { value: x, label: String(x) }));
  else if (typeof f.options === 'string') o.options = f.options;
  if (f.hint) o.hint = f.hint;
  if (Array.isArray(f.fields)) o.fields = f.fields.map(fieldJson);
  if (f.field) o.field = fieldJson(f.field);
  return o;
}

export function catalogJson(blocks, { engine = '' } = {}) {
  return {
    engine,
    fieldPolicy: FIELD_POLICY,
    blocks: [...blocks].sort((a, z) => a.type.localeCompare(z.type)).map((b) => {
      const o = { type: b.type, label: b.label };
      for (const k of ['group', 'summary', 'shape', 'collection', 'feature', 'keywords']) if (b[k] !== undefined) o[k] = b[k];
      o.fields = (b.fields ?? []).map(fieldJson);
      if (Array.isArray(b.samples) && b.samples.length) o.samples = b.samples.map(({ _label, ...s }) => ({ type: b.type, ...s }));
      return o;
    }),
  };
}

export function agentFiles(data, { origin = '', blocks = null, engine = '' } = {}) {
  const abs = (u) => (origin ? new URL(u, origin).href : u);
  const files = new Map();
  const blocksUrl = blocks ? `/${trimSlashes(data.route)}/blocks.json` : null;
  if (blocks) files.set(blocksUrl.slice(1), `${JSON.stringify(catalogJson(blocks, { engine }), null, 2)}\n`);
  data.versions.forEach((v, i) => {
    const base = trimSlashes(v.base);
    const others = data.versions.filter((_, k) => k !== i);
    files.set(`${base}/llms.txt`, llmsTxt(v, data, { abs, blocks: blocksUrl, others }));
    files.set(`${base}/llms-full.txt`, llmsFullTxt(v, data, { abs, blocks: blocksUrl }));
    files.set(v.home.markdownUrl.slice(1), `${String(v.home.markdown).trim()}\n`);
    for (const p of v.pages) files.set(p.markdownUrl.slice(1), `${String(p.markdown).trim()}\n`);
  });
  return files;
}

export function stripMarkdown(data) {
  for (const v of data.versions) {
    delete v.home.markdown;
    for (const p of v.pages) delete p.markdown;
  }
  return data;
}
