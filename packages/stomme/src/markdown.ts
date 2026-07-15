import { marked } from 'marked';
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

// Render CMS markdown to HTML and lay out inline images. Placement is set by the
// image *title* keyword — `![caption](src "right")` — so images stay inline in the
// brödtext yet get controlled positioning:
//   (none) → centred & contained   left / right → float, text wraps
//   wide → breakout                 + small | large → size
// Uploads are optimised via Astro; alt → caption, title keyword → placement/size.
const uploads = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/media/**/*.{jpg,jpeg,png,webp,avif}',
);
const mediaKey = (s: string) => (s && s.startsWith('/media/') ? `/src/assets/media/${s.slice('/media/'.length)}` : null);

const PLACEMENTS = new Set(['left', 'right', 'wide', 'center']);
const SIZES = new Set(['small', 'large']);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const attr = (tag: string, name: string) => (tag.match(new RegExp(`\\b${name}="([^"]*)"`)) ?? ['', ''])[1];

export async function renderMarkdown(md = ''): Promise<string> {
  let html = await marked.parse(md ?? '');

  for (const tag of new Set([...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]))) {
    const src = attr(tag, 'src');
    const alt = attr(tag, 'alt');
    const tokens = attr(tag, 'title').toLowerCase().split(/\s+/).filter(Boolean);
    const placement = tokens.find((t) => PLACEMENTS.has(t)) ?? 'center';
    const size = tokens.find((t) => SIZES.has(t));

    let out = src;
    let portrait = false;
    const k = mediaKey(src);
    const loader = k ? uploads[k] : undefined;
    if (loader) {
      const mod = await loader();
      out = (await getImage({ src: mod.default })).src;
      portrait = mod.default.height > mod.default.width;
    }

    const cls = ['prose-fig', `prose-fig--${placement}`];
    if (size) cls.push(`prose-fig--${size}`);
    if (portrait) cls.push('prose-fig--portrait');

    const figure =
      `<figure class="${cls.join(' ')}">` +
      `<img src="${out}" alt="${alt}" loading="lazy" decoding="async">` +
      (alt ? `<figcaption>${alt}</figcaption>` : '') +
      '</figure>';

    // Replace a standalone <p><img></p> with the figure; otherwise the bare tag.
    html = html.replace(new RegExp(`<p>\\s*${esc(tag)}\\s*</p>`, 'g'), figure).split(tag).join(figure);
  }
  return html;
}
