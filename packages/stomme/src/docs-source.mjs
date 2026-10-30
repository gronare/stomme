import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, relative, sep, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { buildVersion, imageRefs, routeParam } from './docs.mjs';

const MEDIA_EXT = /\.(png|jpe?g|gif|webp|avif|svg|mp4|webm)$/i;
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');

const refSlug = (ref) => String(ref).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'branch';

export function versionSlots(route, latest, branch) {
  const key = refSlug(branch);
  if (!latest) return [{ key, ref: branch, label: branch, kind: 'unreleased', base: route }];
  return [
    { key: 'latest', ref: latest, label: latest, kind: 'release', base: route },
    { key, ref: branch, label: branch, kind: 'unreleased', base: `${route}/${key}` },
  ];
}

export function githubSource(cfg, { fetch = globalThis.fetch, token = process.env.GITHUB_TOKEN } = {}) {
  const auth = token ? { Authorization: `Bearer ${token}` } : {};
  const fail = (what, res) => {
    const limited = res && (res.status === 403 || res.status === 429) && res.headers?.get?.('x-ratelimit-remaining') === '0';
    const why = res ? `HTTP ${res.status}${limited ? ', API rate limit reached' : ''}` : 'no response';
    const hint = token ? '' : ' Set GITHUB_TOKEN if the repo is private or the build shares an address with many others.';
    return new Error(`stomme docs: could not read ${what} (${why}).${hint}`);
  };
  const api = async (path, what) => {
    let res;
    try { res = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'stomme-docs', ...auth } }); }
    catch (e) { throw new Error(`stomme docs: could not read ${what} (${e?.message || e}).`); }
    if (res.status === 404) return null;
    if (!res.ok) throw fail(what, res);
    return res.json();
  };
  return {
    async versions() {
      const repo = await api(`/repos/${cfg.repo}`, `the repo ${cfg.repo}`);
      if (!repo) throw new Error(`stomme docs: the repo ${cfg.repo} was not found (HTTP 404). Check site.docs.repo${token ? '' : ', and set GITHUB_TOKEN if it is private'}.`);
      const latest = await api(`/repos/${cfg.repo}/releases/latest`, `the latest release of ${cfg.repo}`);
      return versionSlots(cfg.route, latest?.tag_name || null, cfg.branch || repo.default_branch || 'main');
    },
    async tree(ref) {
      const t = await api(`/repos/${cfg.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, `${cfg.repo} at ${ref}`);
      if (!t) throw new Error(`stomme docs: ${cfg.repo} has no ref "${ref}" (HTTP 404). Check site.docs.branch.`);
      if (t.truncated) throw new Error(`stomme docs: the file list of ${cfg.repo} at ${ref} is too large for one API call.`);
      return new Map(t.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]));
    },
    async read(ref, path) {
      const url = `https://raw.githubusercontent.com/${cfg.repo}/${encodeURIComponent(ref)}/${path.split('/').map(encodeURIComponent).join('/')}`;
      let res;
      try { res = await fetch(url, { headers: { 'User-Agent': 'stomme-docs', ...auth } }); }
      catch (e) { throw new Error(`stomme docs: could not read ${path} at ${ref} (${e?.message || e}).`); }
      if (!res.ok) throw fail(`${path} at ${ref}`, res);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

// One version, read from a folder on disk: the folder stands in for cfg.path in the repo, so links and edit URLs read as they would from GitHub.
export function localSource(cfg, dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`stomme docs: the local docs folder ${dir} does not exist.`);
  const prefix = cfg.path ? `${cfg.path}/` : '';
  return {
    async versions() { return [{ key: 'local', ref: cfg.branch || 'main', label: basename(dir), kind: 'local', base: cfg.route }]; },
    async tree() {
      const map = new Map();
      for (const f of readdirSync(dir, { recursive: true }).map(String)) {
        const abs = resolve(dir, f);
        if (f.split(sep).some((s) => s.startsWith('.') || s === 'node_modules') || !statSync(abs).isFile()) continue;
        map.set(prefix + relative(dir, abs).split(sep).join('/'), abs);
      }
      return map;
    },
    async read(_ref, path, tree) { return readFileSync(tree.get(path)); },
  };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

export async function loadDocs(cfg, source, { mediaDir, logger } = {}) {
  const prefix = cfg.path ? `${cfg.path}/` : '';
  const slots = await source.versions();
  const blobs = new Map();
  const cached = (key, load) => { if (!blobs.has(key)) blobs.set(key, load()); return blobs.get(key); };
  if (mediaDir) { rmSync(mediaDir, { recursive: true, force: true }); mkdirSync(mediaDir, { recursive: true }); }
  const written = new Set();
  const versions = [];
  for (const slot of slots) {
    const tree = await source.tree(slot.ref);
    const mdPaths = [...tree.keys()].filter((p) => p.startsWith(prefix) && /\.md$/i.test(p));
    if (!mdPaths.length) throw new Error(`stomme docs: ${cfg.repo || 'the docs source'} has no Markdown under ${cfg.path || 'the root'}/ at ${slot.ref}.`);
    const files = new Map();
    await pool(mdPaths, 8, async (p) => {
      const buf = await cached(`${tree.get(p)}`, () => source.read(slot.ref, p, tree));
      files.set(p.slice(prefix.length), buf.toString('utf8'));
    });
    const media = new Map();
    const wanted = new Set();
    for (const [file, md] of files) for (const ref of imageRefs(md, file, cfg.path)) if (tree.has(ref) && MEDIA_EXT.test(ref)) wanted.add(ref);
    await pool([...wanted], 6, async (p) => {
      const buf = await cached(`${tree.get(p)}`, () => source.read(slot.ref, p, tree));
      const id = sha1(buf).slice(0, 10);
      const name = basename(p).replace(/[^\w.-]/g, '-');
      media.set(p, `${cfg.route}/_media/${id}/${name}`);
      if (mediaDir && !written.has(`${id}/${name}`)) {
        mkdirSync(resolve(mediaDir, id), { recursive: true });
        writeFileSync(resolve(mediaDir, id, name), buf);
        written.add(`${id}/${name}`);
      }
    });
    const built = buildVersion(slot, files, { repo: cfg.repo, docsPath: cfg.path, media });
    for (const w of built.warnings) logger?.warn?.(`docs: ${w}`);
    delete built.warnings;
    built.param = routeParam(cfg.route, built.home.url);
    for (const p of built.pages) p.param = routeParam(cfg.route, p.url);
    versions.push(built);
    logger?.info?.(`docs: ${slot.label} (${slot.ref}) — ${built.pages.length} pages, ${media.size} images`);
  }
  return { route: cfg.route, repo: cfg.repo, path: cfg.path, versions };
}
