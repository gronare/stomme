const TRANSLATABLE = /\b(label|label_singular|hint): "((?:[^"\\]|\\.)*)"/g;

const unquote = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

function pathOf(frames, aliases) {
  const blockAt = frames.findLastIndex((f) => f.kind === 'container' && f.name === 'types');
  const nodes = (blockAt === -1 ? frames : frames.slice(blockAt)).filter((f) => f.kind === 'node');
  const segs = nodes.map((f) => f.seg ?? '?');
  if (blockAt !== -1) return ['block', ...segs].join('.');
  if (segs.length > 1 && aliases[segs[0]]) segs[0] = aliases[segs[0]];
  return segs.join('.');
}

export function scanLabels(yaml, { aliases = {} } = {}) {
  const lines = yaml.split('\n');
  const stack = [];
  const found = [];
  for (let n = 0; n < lines.length; n++) {
    const raw = lines[n];
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    const col = raw.length - raw.trimStart().length;
    while (stack.length && stack[stack.length - 1].col >= col) stack.pop();

    let body = raw.trim();
    const isItem = body === '-' || body.startsWith('- ');
    if (isItem) body = body.slice(1).trim();
    const container = stack.filter((f) => f.kind === 'container').pop();

    if (isItem) {
      const inner = body.match(/^\{\s*(.*?)\s*\}$/);
      const src = inner ? inner[1] : body;
      const name = src.match(/(?:^|,)\s*name:\s*([^,}\s]+)/);
      let seg = name ? name[1] : null;
      if (!seg && container && container.name === 'options') {
        const v = src.match(/(?:^|,)\s*value:\s*("(?:[^"\\]|\\.)*"|[^,}]*)/);
        seg = `options[${v ? unquote(v[1].trim().replace(/^"|"$/g, '')).split('::')[0] : ''}]`;
      }
      stack.push({ col, kind: 'node', seg });
    } else {
      const kv = body.match(/^([\w-]+):(.*)$/);
      if (kv && kv[1] === 'field') {
        const name = kv[2].match(/name:\s*([^,}\s]+)/);
        stack.push({ col, kind: 'node', seg: name ? name[1] : 'field' });
      } else if (kv && kv[2].trim() === '') {
        stack.push({ col, kind: 'container', name: kv[1] });
      } else if (kv && kv[1] === 'name') {
        const top = stack[stack.length - 1];
        if (top && top.kind === 'node' && top.seg === null) top.seg = kv[2].trim();
      }
    }

    TRANSLATABLE.lastIndex = 0;
    for (let m; (m = TRANSLATABLE.exec(raw)); ) {
      found.push({ line: n, key: m[1], text: unquote(m[2]), frames: stack.slice() });
    }
  }
  return found.map((f) => ({ line: f.line, key: f.key, text: f.text, path: `${pathOf(f.frames, aliases)}.${f.key}` }));
}

export function rewriteLabels(yaml, pick, options) {
  const hits = scanLabels(yaml, options);
  if (!hits.length) return yaml;
  const queued = new Map();
  for (const h of hits) {
    if (!queued.has(h.line)) queued.set(h.line, []);
    queued.get(h.line).push(h);
  }
  const lines = yaml.split('\n');
  for (const [n, queue] of queued) {
    let i = 0;
    lines[n] = lines[n].replace(TRANSLATABLE, (m, key) => {
      const h = queue[i++];
      const next = pick(h.path, h.text);
      if (next === h.text) return m;
      return `${key}: "${String(next).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    });
  }
  return lines.join('\n');
}

export const listingAliases = (listings) =>
  Object.fromEntries((listings || []).map((l) => [l.id, `listing:${l.preset}`]));
