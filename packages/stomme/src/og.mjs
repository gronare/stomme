// Build-time OG-card renderer (settings.og, Phase 2): the page's photo sharp-cropped
// to 1200×630 as the background (or a brand gradient when there is none), a transparent
// gradient scrim, and title/tagline/wordmark composited on top per the `style` preset —
// satori (flex layout → SVG) + resvg (SVG → PNG).
//
// Deliberately plain .mjs, and loaded ONLY via the runtime dynamic import in
// routes/og.ts (through the __STOMME_OG_RENDERER__ file URL the integration defines) —
// never through the site's Vite bundle. Bundling is exactly what must not happen here:
// sharp/@resvg are native (Rollup chokes on .node binaries), and externalizing bare
// specifiers doesn't survive pnpm isolation (they aren't in the SITE's node_modules).
// Loaded from its real package location, node resolves every dep naturally.
//
// Fonts: the engine ships no font files (src/fonts.ts wires site-side variable woff2,
// which satori can't parse) — the static @fontsource woffs are direct deps for exactly
// this. Card typography is fixed Inter / Inter Tight regardless of the site theme:
// brand-consistent with the engine's default type, and deterministic across sites.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const require = createRequire(import.meta.url);

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// renderOgCard input:
//   title           string (required) — the resolved headline (routes/og.ts picks it
//                   from the item field the type's headlineField selects)
//   tagline         string — the resolved second line ('' = none)
//   wordmark        string | { pre, accent } — settings.logo.textPre/textAccent
//   bgImageBuffer   Buffer | null — item photo; null → solid brand background
//   og              { style: 'editorial'|'bold'|'ops', scrim: 0–100, showLogo,
//                     accent } (a settings.og.types[<key>] config)
//   theme           { brand, ink, onDark, dark } (theme collection)

// ── fonts ────────────────────────────────────────────────────────────────────
let fonts = null;
function loadFonts() {
  if (fonts) return fonts;
  const woff = (spec) => readFileSync(require.resolve(spec));
  fonts = [
    { name: 'Inter', data: woff('@fontsource/inter/files/inter-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Inter', data: woff('@fontsource/inter/files/inter-latin-700-normal.woff'), weight: 700, style: 'normal' },
    { name: 'Inter Tight', data: woff('@fontsource/inter-tight/files/inter-tight-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Inter Tight', data: woff('@fontsource/inter-tight/files/inter-tight-latin-700-normal.woff'), weight: 700, style: 'normal' },
  ];
  return fonts;
}

// ── colour helpers ───────────────────────────────────────────────────────────
// Theme colours are hex from the CMS colour widget; anything unparseable falls back.
function hexToRgb(hex, fallback) {
  const v = (hex || '').trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(v);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const s = /^#?([0-9a-f]{3})$/i.exec(v);
  if (s) {
    const [r, g, b] = s[1].split('');
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)];
  }
  return fallback;
}
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${Math.min(1, Math.max(0, a)).toFixed(3)})`;

// ── satori element tree (object form — no JSX in the package) ────────────────
const el = (type, style, children) =>
  ({ type, props: children == null ? { style } : { style, children } });

// Headline size adapts to length so long titles still fit at 1200px wide.
const titleSize = (t, base) => (t.length > 70 ? base - 20 : t.length > 40 ? base - 10 : base);

function buildTree(input, bgDataUri) {
  const og = input.og || {};
  const style = og.style || 'editorial';
  const alpha = Math.min(100, Math.max(0, og.scrim ?? 55)) / 100;
  const theme = input.theme || {};
  const ink = hexToRgb(theme.dark ?? theme.ink, [31, 41, 55]); // theme.ink default #1f2937
  const brand = hexToRgb(theme.brand, [67, 56, 202]); // theme.brand default #4338ca
  const onDark = theme.onDark || '#ffffff';
  const accent = og.accent || theme.brand || '#4338ca';

  const wm = typeof input.wordmark === 'string' ? { pre: input.wordmark, accent: '' } : (input.wordmark || {});
  const hasWordmark = og.showLogo !== false && !!(wm.pre || wm.accent);
  const tagline = (input.tagline || '').trim();

  const layers = [];
  if (bgDataUri) {
    layers.push({ type: 'img', props: { src: bgDataUri, width: OG_WIDTH, height: OG_HEIGHT, style: { position: 'absolute', top: 0, left: 0, width: OG_WIDTH, height: OG_HEIGHT, objectFit: 'cover' } } });
  } else {
    // Solid theme-brand background — no photo, but never blank. A faint dark wash from
    // the bottom keeps the overlay text legible on a light brand colour.
    layers.push(el('div', {
      position: 'absolute', top: 0, left: 0, width: OG_WIDTH, height: OG_HEIGHT,
      backgroundColor: rgba(brand, 1),
      backgroundImage: `linear-gradient(150deg, ${rgba(ink, 0.28)} 0%, ${rgba(ink, 0)} 55%)`,
    }));
  }

  // Scrim — only over a photo (the brand background is already dark and even).
  const scrims = [];
  if (bgDataUri) {
    if (style === 'editorial') {
      scrims.push(`linear-gradient(to top, ${rgba(ink, alpha)} 0%, ${rgba(ink, alpha * 0.85)} 26%, ${rgba(ink, 0)} 62%)`);
      if (hasWordmark) scrims.push(`linear-gradient(to bottom, ${rgba(ink, alpha * 0.5)} 0%, ${rgba(ink, 0)} 22%)`);
    } else if (style === 'ops') {
      scrims.push(`linear-gradient(to right, ${rgba(ink, Math.min(1, alpha * 1.2))} 0%, ${rgba(ink, alpha * 0.92)} 44%, ${rgba(ink, 0)} 80%)`);
    } else {
      scrims.push(`linear-gradient(to bottom, ${rgba(ink, alpha * 0.85)} 0%, ${rgba(ink, Math.min(1, alpha * 1.2))} 100%)`);
    }
  }
  for (const s of scrims) {
    layers.push(el('div', { position: 'absolute', top: 0, left: 0, width: OG_WIDTH, height: OG_HEIGHT, backgroundImage: s }));
  }

  const wordmarkEl = el('div', { display: 'flex', fontFamily: 'Inter Tight', fontWeight: 700, fontSize: 30, color: onDark, letterSpacing: '-0.01em' }, [
    ...(wm.pre ? [el('span', {}, wm.pre)] : []),
    ...(wm.accent ? [el('span', { color: accent }, wm.accent)] : []),
  ]);
  const ruleEl = (extra = {}) =>
    el('div', { width: 72, height: 6, backgroundColor: accent, borderRadius: 3, ...extra });
  const titleEl = (size, extra = {}) =>
    el('div', { fontFamily: 'Inter Tight', fontWeight: 700, fontSize: size, lineHeight: 1.06, color: onDark, letterSpacing: '-0.02em', ...extra }, input.title);
  const taglineEl = (extra = {}) =>
    el('div', { fontFamily: 'Inter', fontWeight: 400, fontSize: 26, lineHeight: 1.35, color: rgba(hexToRgb(onDark, [255, 255, 255]), 0.92), ...extra }, tagline);

  let content;
  if (style === 'ops') {
    // Left info panel: full-height accent bar, text column vertically centred.
    content = [
      el('div', { position: 'absolute', top: 0, left: 0, width: 10, height: OG_HEIGHT, backgroundColor: accent }),
      ...(hasWordmark ? [el('div', { position: 'absolute', top: 56, left: 74, display: 'flex' }, [wordmarkEl])] : []),
      el('div', { position: 'absolute', top: 0, left: 74, width: 700, height: OG_HEIGHT, display: 'flex', flexDirection: 'column', justifyContent: 'center' }, [
        ruleEl({ marginBottom: 26 }),
        titleEl(titleSize(input.title, 58)),
        ...(tagline ? [taglineEl({ marginTop: 18 })] : []),
      ]),
    ];
  } else if (style === 'bold') {
    // Big centred statement under a heavy scrim.
    content = [
      el('div', { position: 'absolute', top: 0, left: 0, width: OG_WIDTH, height: OG_HEIGHT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 96px' }, [
        titleEl(titleSize(input.title, 70), { textAlign: 'center' }),
        ruleEl({ marginTop: 30 }),
        ...(tagline ? [taglineEl({ marginTop: 24, textAlign: 'center' })] : []),
      ]),
      ...(hasWordmark ? [el('div', { position: 'absolute', bottom: 52, left: 0, width: OG_WIDTH, display: 'flex', justifyContent: 'center' }, [wordmarkEl])] : []),
    ];
  } else {
    // editorial (default): gradient rises from the bottom, text bottom-left.
    content = [
      ...(hasWordmark ? [el('div', { position: 'absolute', top: 56, left: 64, display: 'flex' }, [wordmarkEl])] : []),
      el('div', { position: 'absolute', bottom: 0, left: 0, width: OG_WIDTH, display: 'flex', flexDirection: 'column', padding: '0 64px 60px', maxWidth: 980 }, [
        ruleEl({ marginBottom: 26 }),
        titleEl(titleSize(input.title, 62)),
        ...(tagline ? [taglineEl({ marginTop: 18 })] : []),
      ]),
    ];
  }

  return el('div', { display: 'flex', position: 'relative', width: OG_WIDTH, height: OG_HEIGHT, fontFamily: 'Inter' }, [...layers, ...content]);
}

// ── background sources ───────────────────────────────────────────────────────
// Content image values are served paths: '/media/…' (CMS media folder, on disk under
// public/media as-is) or '/…' under public/ — plus the odd absolute URL. Returns the raw
// bytes, or null when unresolvable (caller falls to the brand background).
export async function loadImageSource(src, root = process.cwd()) {
  if (!src) return null;
  try {
    if (/^https?:\/\//.test(src)) {
      const res = await fetch(src);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    const rel = src.replace(/^\//, '');
    const path = rel.startsWith('src/') ? resolve(root, rel) : resolve(root, 'public', rel);
    return readFileSync(path);
  } catch {
    return null;
  }
}

// ── the card ─────────────────────────────────────────────────────────────────
export async function renderOgCard(input) {
  let bgDataUri = null;
  if (input.bgImageBuffer) {
    // Exact 1200×630 centre-crop; flattened + jpeg-encoded so satori embeds a small,
    // alpha-free raster (the scrim provides all the darkening).
    const bg = await sharp(input.bgImageBuffer)
      .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82 })
      .toBuffer();
    bgDataUri = `data:image/jpeg;base64,${bg.toString('base64')}`;
  }
  const svg = await satori(buildTree(input, bgDataUri), { width: OG_WIDTH, height: OG_HEIGHT, fonts: loadFonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng());
}

// ── build-safe fallbacks (a card failure must NEVER fail the build) ──────────
// settings.ogImage bytes → plain 1200×630 PNG (no overlay — it's already a designed card).
export async function rawImagePng(buf) {
  return sharp(buf).resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover' }).flatten({ background: '#ffffff' }).png().toBuffer();
}
// Solid brand-colour PNG — the deepest sharp-only fallback (no satori/resvg involved).
export async function solidPng(hex) {
  const [r, g, b] = hexToRgb(hex, [31, 41, 55]);
  return sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 3, background: { r, g, b } } }).png().toBuffer();
}
// Absolute last resort: a valid-but-empty 1×1 PNG, so the response/emit never throws.
export const EMPTY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==',
  'base64',
);
