import { Marked } from 'marked';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const UNESC = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
export const plainText = (html) => String(html ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_m, k) => UNESC[k])
  .replace(/\s+/g, ' ')
  .trim();

const trimSlashes = (s) => String(s ?? '').replace(/^\/+|\/+$/g, '');

export function resolveDocsConfig(docs) {
  const d = docs && typeof docs === 'object' ? docs : {};
  const route = `/${trimSlashes(d.route || '/docs')}`;
  return {
    repo: typeof d.repo === 'string' ? d.repo.trim() : '',
    path: trimSlashes(d.path ?? 'docs'),
    route: route === '/' ? '/docs' : route,
    branch: typeof d.branch === 'string' ? d.branch.trim() : '',
    dir: typeof d.dir === 'string' ? d.dir : '',
  };
}

// Paths are repo-relative and slash-separated; '..' above the repo root is dropped the way a browser drops it above the host.
export function joinPath(fromFile, rel) {
  const parts = rel.startsWith('/') ? [] : fromFile.split('/').slice(0, -1);
  for (const p of rel.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.' && p !== '') parts.push(p);
  }
  return parts.join('/');
}

export function pageSlug(rel) {
  const noExt = rel.replace(/\.md$/i, '');
  if (/(^|\/)readme$/i.test(noExt)) return noExt.replace(/(^|\/)readme$/i, '');
  return noExt;
}

export function pageUrl(base, slug, hash = '') {
  const path = [trimSlashes(base), trimSlashes(slug)].filter(Boolean).join('/');
  return `/${path}${path ? '/' : ''}${hash ? `#${hash}` : ''}`;
}

const githubUrl = (repo, ref, repoPath, kind = 'blob') =>
  `https://github.com/${repo}/${kind}/${encodeURIComponent(ref)}/${repoPath.split('/').map(encodeURIComponent).join('/')}`;

export function rewriteHref(href, ctx) {
  const raw = String(href ?? '');
  if (!raw || raw.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return raw;
  const cut = raw.search(/[?#]/);
  const pathPart = cut === -1 ? raw : raw.slice(0, cut);
  const rest = cut === -1 ? '' : raw.slice(cut);
  const hash = rest.includes('#') ? rest.slice(rest.indexOf('#') + 1) : '';
  const prefix = ctx.docsPath ? `${ctx.docsPath}/` : '';
  const from = `${prefix}${ctx.file}`;
  const target = pathPart ? joinPath(from, pathPart) : from;
  const inDocs = !prefix || target.startsWith(prefix);
  const rel = inDocs ? target.slice(prefix.length) : '';
  if (inDocs && /\.md$/i.test(rel) && ctx.pages.has(rel)) return pageUrl(ctx.base, pageSlug(rel), hash);
  return githubUrl(ctx.repo, ctx.ref, target) + (hash ? `#${hash}` : '');
}

export function headingId(text, seen) {
  const base = plainText(text).toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-') || 'section';
  let id = base;
  for (let n = 1; seen.has(id); n++) id = `${base}-${n}`;
  seen.add(id);
  return id;
}

function createRenderer(ctx, seen, headings) {
  return new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        if (depth === 1) return `<h1>${inner}</h1>\n`;
        const id = headingId(inner, seen);
        if (depth === 2) headings.push({ id, html: inner, text: plainText(inner) });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${escapeHtml(rewriteHref(href, ctx))}"${t}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, title, text }) {
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<img src="${escapeHtml(imageSrc(href, ctx))}" alt="${escapeHtml(text)}"${t} loading="lazy" decoding="async">`;
      },
      code({ text, lang }) {
        const l = String(lang || '').trim().split(/\s+/)[0];
        return `<pre class="docs-code"><code${l ? ` class="language-${escapeHtml(l)}"` : ''}>${escapeHtml(text)}</code></pre>\n`;
      },
    },
  });
}

function imageSrc(href, ctx) {
  const raw = String(href ?? '');
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return raw;
  const target = joinPath(`${ctx.docsPath ? `${ctx.docsPath}/` : ''}${ctx.file}`, raw.split(/[?#]/)[0]);
  if (ctx.media?.has(target)) return ctx.media.get(target);
  return `https://raw.githubusercontent.com/${ctx.repo}/${encodeURIComponent(ctx.ref)}/${target.split('/').map(encodeURIComponent).join('/')}`;
}

export function imageRefs(md, file, docsPath) {
  const out = new Set();
  const m = new Marked({ gfm: true });
  const from = `${docsPath ? `${docsPath}/` : ''}${file}`;
  m.walkTokens(m.lexer(md), (t) => {
    if (t.type !== 'image') return;
    const href = String(t.href ?? '');
    if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return;
    out.add(joinPath(from, href.split(/[?#]/)[0]));
  });
  return [...out];
}

const ITEM_RE = /^\[([^\]]+)\]\(([^)\s#]+)(?:#[^)\s]*)?(?:\s+"[^"]*")?\)\s*(?::\s*([\s\S]*))?$/;

export function parseIndex(readme) {
  const toks = new Marked({ gfm: true }).lexer(String(readme ?? ''));
  const out = { title: '', lede: '', sections: [] };
  let section = null;
  let label = null;
  for (const t of toks) {
    if (t.type === 'heading' && t.depth === 1 && !out.title) out.title = t.text.trim();
    else if (t.type === 'heading' && t.depth === 2) { section = { name: t.text.trim(), groups: [] }; out.sections.push(section); label = null; }
    else if (t.type === 'paragraph' && !section) { if (!out.lede) out.lede = t.text.trim(); }
    else if (t.type === 'paragraph' && section) label = t.text.trim();
    else if (t.type === 'list' && section) {
      const items = t.items.map((it) => {
        const m = ITEM_RE.exec(it.text.trim());
        return m ? { title: m[1].trim(), path: m[2], description: (m[3] || '').replace(/\s+/g, ' ').trim() } : null;
      }).filter(Boolean);
      if (items.length) section.groups.push({ label, items });
      label = null;
    }
  }
  return out;
}

export function renderDoc(md, ctx) {
  const seen = new Set();
  const headings = [];
  const marked = createRenderer(ctx, seen, headings);
  const toks = marked.lexer(String(md ?? ''));
  const links = toks.links;
  let title = '';
  const h1 = toks.findIndex((t) => t.type === 'heading' && t.depth === 1);
  if (h1 !== -1) title = marked.parseInline(toks.splice(h1, 1)[0].text);
  let lede = '';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.type === 'heading') break;
    if (t.type !== 'paragraph') continue;
    if ((t.tokens || []).every((x) => x.type === 'image' || (x.type === 'text' && !x.text.trim()))) continue;
    lede = marked.parseInline(t.text);
    toks.splice(i, 1);
    break;
  }
  toks.links = links;
  const html = marked.parser(toks);
  return { title, lede, html, headings, text: plainText(html) };
}

export function inlineHtml(md, ctx) {
  return createRenderer(ctx, new Set(), []).parseInline(String(md ?? ''));
}

export function buildVersion(version, files, { repo, docsPath, media = new Map() }) {
  const pages = new Set([...files.keys()].filter((p) => /\.md$/i.test(p)));
  const readmePath = [...pages].find((p) => /^readme\.md$/i.test(p));
  if (!readmePath) throw new Error(`stomme docs: ${repo} has no README.md in ${docsPath || 'the repo root'}/ at ${version.ref} — the docs nav is read from it.`);
  const ctxFor = (file) => ({ repo, ref: version.ref, docsPath, base: version.base, file, pages, media });
  const index = parseIndex(files.get(readmePath));
  const homeCtx = ctxFor(readmePath);
  const order = [];
  const sectionOf = new Map();
  const nav = index.sections.map((s) => ({
    name: s.name,
    nameHtml: inlineHtml(s.name, homeCtx),
    groups: s.groups.map((g) => ({
      label: g.label,
      labelHtml: g.label ? inlineHtml(g.label, homeCtx) : '',
      items: g.items.map((it) => {
        const target = joinPath(`${docsPath ? `${docsPath}/` : ''}${readmePath}`, it.path);
        const rel = docsPath ? target.slice(docsPath.length + 1) : target;
        const known = (!docsPath || target.startsWith(`${docsPath}/`)) && pages.has(rel);
        const item = {
          path: known ? rel : null,
          url: rewriteHref(it.path, homeCtx),
          titleHtml: inlineHtml(it.title, homeCtx),
          title: plainText(inlineHtml(it.title, homeCtx)),
          descriptionHtml: inlineHtml(it.description, homeCtx),
        };
        if (known && !sectionOf.has(rel)) { sectionOf.set(rel, s.name); order.push(item); }
        return item;
      }),
    })),
  }));

  const rendered = [...pages].filter((p) => p !== readmePath).sort().map((file) => {
    const doc = renderDoc(files.get(file), ctxFor(file));
    const slug = pageSlug(file);
    return {
      path: file,
      slug,
      url: pageUrl(version.base, slug),
      title: plainText(doc.title) || slug,
      titleHtml: doc.title || escapeHtml(slug),
      ledeHtml: doc.lede,
      lede: plainText(doc.lede),
      html: doc.html,
      headings: doc.headings,
      text: doc.text,
      section: sectionOf.get(file) ?? null,
      edit: githubUrl(repo, version.ref, `${docsPath ? `${docsPath}/` : ''}${file}`),
    };
  });
  const byPath = new Map(rendered.map((p) => [p.path, p]));
  order.forEach((item, i) => {
    const page = byPath.get(item.path);
    const link = (o) => (o ? { url: o.url, titleHtml: o.titleHtml } : null);
    page.prev = link(order[i - 1]);
    page.next = link(order[i + 1]);
  });
  for (const p of rendered) { p.prev ??= null; p.next ??= null; }
  const search = rendered.map(({ title, url, section, lede, text }) => ({ t: title, u: url, s: section ?? '', x: `${lede} ${text}`.trim() }));
  for (const p of rendered) delete p.text;

  return {
    ...version,
    home: {
      url: pageUrl(version.base, ''),
      title: plainText(inlineHtml(index.title, homeCtx)) || 'Docs',
      titleHtml: inlineHtml(index.title, homeCtx) || 'Docs',
      ledeHtml: inlineHtml(index.lede, homeCtx),
      lede: plainText(inlineHtml(index.lede, homeCtx)),
      edit: githubUrl(repo, version.ref, `${docsPath ? `${docsPath}/` : ''}${readmePath}`),
    },
    nav,
    pages: rendered,
    search,
  };
}

export function routeParam(route, url) {
  const rest = trimSlashes(url.slice(trimSlashes(route).length + 1));
  return rest || undefined;
}
