// The theme's `fontDisplay` / `fontBody` name a key here (or 'custom'). The picker's option VALUES are hand-authored in bin/gen-admin-blocks.mjs and the CMS preview repeats these stacks in admin/previews.js — both have to match these keys.
export const FONT_STACKS: Record<string, string> = {
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  grotesk: '"Helvetica Neue", Helvetica, Arial, "Segoe UI", system-ui, sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Segoe UI", system-ui, sans-serif',
  slab: 'Rockwell, "Rockwell Nova", "Roboto Slab", "DejaVu Serif", Georgia, serif',
  geometric: 'Futura, "Futura PT", "Century Gothic", "Avenir Next", "URW Geometric", ui-sans-serif, system-ui, sans-serif',
  condensed: '"Arial Narrow", "Helvetica Neue Condensed", "Roboto Condensed", "Liberation Sans Narrow", ui-sans-serif, sans-serif',
  humanist: 'Verdana, "Segoe UI", "Lucida Grande", "Lucida Sans Unicode", Geneva, Tahoma, ui-sans-serif, sans-serif',
  script: '"Snell Roundhand", "Brush Script MT", "Segoe Script", "Bradley Hand", ui-rounded, cursive',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

export interface Webfont { family: string; fallbackFamily: string; fallback: string; }
// resolveFonts authors the real @font-face (latin-subset variable woff2); the capsize metric-matched Arial fallback is what makes the swap shift-free.
export const WEBFONTS: Record<string, Webfont> = {
  inter: {
    family: 'Inter Variable', fallbackFamily: 'Inter Fallback',
    fallback: '@font-face{font-family:"Inter Fallback";src:local("Arial"),local("ArialMT");ascent-override:90.4365%;descent-override:22.518%;line-gap-override:0%;size-adjust:107.1194%;}',
  },
  'inter-tight': {
    family: 'Inter Tight Variable', fallbackFamily: 'Inter Tight Fallback',
    fallback: '@font-face{font-family:"Inter Tight Fallback";src:local("Arial"),local("ArialMT");ascent-override:100.5078%;descent-override:25.0256%;line-gap-override:0%;size-adjust:96.3855%;}',
  },
};

const formatOf = (path: string) =>
  path.endsWith('.woff2') ? 'woff2' : path.endsWith('.woff') ? 'woff' : path.endsWith('.otf') ? 'opentype' : 'truetype';
// MIME type for <link rel=preload as=font type=…>
const mimeOf = (path: string) =>
  path.endsWith('.woff2') ? 'font/woff2' : path.endsWith('.woff') ? 'font/woff' : path.endsWith('.otf') ? 'font/otf' : 'font/ttf';
const fontFace = (family: string, url: string) =>
  `@font-face{font-family:"${family}";src:url("${url}") format("${formatOf(url)}");font-display:swap;font-weight:100 900;}`;

// The theme stores the served /media/fonts/… path; the build-bridge mirrors public/media → src/assets/media and Vite ?url-hashes it. Eager glob = URL strings only, so an unused upload costs deploy bytes, not a fetch.
const uploadedFontUrls = import.meta.glob('/src/assets/media/**/*.{woff2,woff,ttf,otf}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const uploadFontUrl = (p?: string | null): string | null => {
  if (!p) return null;
  const key = p.startsWith('/media/') ? `/src/assets/media/${p.slice('/media/'.length)}` : null;
  return key ? (uploadedFontUrls[key] ?? null) : null;
};

// webfontUrls (curated-webfont key → served latin woff2) stays SITE-provided; custom uploads resolve through the glob above.
export function resolveFonts(
  theme: { fontDisplay?: string; fontBody?: string; fontCustomFile?: string; fontCustomBodyFile?: string } = {},
  webfontUrls: Record<string, string> = {},
): { vars: string[]; fontFace: string | null; preloads: { href: string; type: string }[] } {
  const customDisplayUrl = uploadFontUrl(theme.fontCustomFile);
  const customBodyUrl = uploadFontUrl(theme.fontCustomBodyFile);
  const stack = (key: string | undefined, customFamily: string | null): string | null => {
    if (key === 'custom') return customFamily ? `${customFamily}, ${FONT_STACKS.system}` : null;
    if (key && WEBFONTS[key]) {
      const wf = WEBFONTS[key];
      // Wired → the real family with its metric-matched fallback; unwired → graceful system.
      return webfontUrls[key] ? `"${wf.family}", "${wf.fallbackFamily}", ${FONT_STACKS.system}` : FONT_STACKS.system;
    }
    return key && FONT_STACKS[key] ? FONT_STACKS[key] : null;
  };
  const dispFamily = customDisplayUrl ? '"StommeFontDisplay"' : null;
  // Body custom font falls back to the heading one when not uploaded (one-font setups).
  const bodyFamily = customBodyUrl ? '"StommeFontBody"' : dispFamily;
  const vars: string[] = [];
  const d = stack(theme.fontDisplay, dispFamily);
  if (d) vars.push(`--font-display:${d}`);
  const b = stack(theme.fontBody, bodyFamily);
  if (b) vars.push(`--font-sans:${b}`);
  const faces: string[] = [];
  const preloads: { href: string; type: string }[] = [];
  if (customDisplayUrl) { faces.push(fontFace('StommeFontDisplay', customDisplayUrl)); preloads.push({ href: customDisplayUrl, type: mimeOf(customDisplayUrl) }); }
  if (customBodyUrl) { faces.push(fontFace('StommeFontBody', customBodyUrl)); preloads.push({ href: customBodyUrl, type: mimeOf(customBodyUrl) }); }
  // One @font-face + fallback + preload per distinct wired key (display == body dedupes to a single pair).
  const webfontKeys = [...new Set([theme.fontDisplay, theme.fontBody])].filter(
    (k): k is string => !!k && !!WEBFONTS[k] && !!webfontUrls[k],
  );
  for (const key of webfontKeys) {
    const wf = WEBFONTS[key];
    const url = webfontUrls[key];
    faces.push(fontFace(wf.family, url), wf.fallback);
    preloads.push({ href: url, type: mimeOf(url) });
  }
  return { vars, fontFace: faces.length ? faces.join('') : null, preloads };
}
