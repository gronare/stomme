const pageFile = (id) => `src/content/pages/${id}.md`;

export function normalizeParentPath(value) {
  const raw = String(value ?? '').trim().replace(/^["']|["']$/g, '');
  if (!raw) return '';
  const path = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/+$/, '');
  return path === '' ? '' : path;
}

export function parentSegmentId(parentPath) {
  return parentPath.slice(parentPath.lastIndexOf('/') + 1);
}

export function pagePathMap(entries) {
  const parents = new Map();
  for (const e of entries || []) {
    if (!e || e.id === undefined || e.id === null) continue;
    parents.set(String(e.id), normalizeParentPath(e.parent));
  }
  const resolved = new Map();
  const walk = (id, chain) => {
    const known = resolved.get(id);
    if (known) return known;
    const parent = parents.get(id);
    if (!parent) {
      resolved.set(id, `/${id}`);
      return `/${id}`;
    }
    const parentId = parentSegmentId(parent);
    if (parentId === id) {
      throw new Error(`stomme pages: ${pageFile(id)} names itself as its parent page. Clear \`parent\`, or point it at another page.`);
    }
    if (chain.includes(id)) {
      throw new Error(`stomme pages: the parent pages run in a circle — ${[...chain.slice(chain.indexOf(id)), id].map(pageFile).join(' → ')}. Clear one \`parent\` to break it.`);
    }
    if (!parents.has(parentId)) {
      throw new Error(`stomme pages: ${pageFile(id)} names \`parent: ${parent}\`, and the site has no page at that address. Point \`parent\` at a page that exists, or clear it.`);
    }
    const parentPath = walk(parentId, [...chain, id]);
    if (parentPath !== parent) {
      throw new Error(`stomme pages: ${pageFile(id)} names \`parent: ${parent}\`, but ${pageFile(parentId)} now answers on ${parentPath}. Set \`parent\` to the address that page has today.`);
    }
    const path = `${parentPath}/${id}`;
    resolved.set(id, path);
    return path;
  };
  const out = new Map();
  for (const id of parents.keys()) out.set(id, walk(id, []));
  return out;
}
