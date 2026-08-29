import { marked } from 'marked';
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

const uploads = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/media/**/*.{jpg,jpeg,png,webp,avif}',
);
const mediaKey = (s: string) => (s && s.startsWith('/media/') ? `/src/assets/media/${s.slice('/media/'.length)}` : null);

const PLACEMENTS = new Set(['left', 'right', 'wide', 'center']);
const SIZES = new Set(['small', 'large']);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const attr = (tag: string, name: string) => (tag.match(new RegExp(`\\b${name}="([^"]*)"`)) ?? ['', ''])[1];

// `link` rewrites the href of every inline link — the locale mapper, so a body's own [text](/page) lands in the language the page is read in.
export async function renderMarkdown(md = '', link?: (href: string) => string): Promise<string> {
  let html = await marked.parse(md ?? '');
  if (link) html = html.replace(/(<a\b[^>]*\bhref=")([^"]*)(")/g, (_m, pre, href, post) => pre + link(href) + post);

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

    html = html.replace(new RegExp(`<p>\\s*${esc(tag)}\\s*</p>`, 'g'), figure).split(tag).join(figure);
  }
  return html;
}
