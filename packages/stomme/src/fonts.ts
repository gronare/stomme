// Font picker for the theme. Curated, ready-to-use stacks (system / web-safe — no
// external requests, no GDPR concern) plus an optional custom uploaded font. The
// theme's `fontDisplay` / `fontBody` choose a key here (or 'custom'); Base injects the
// resolved stacks as --bk-font-display / --bk-font-sans, and an @font-face for a
// custom upload. Option VALUES must match the keys below (hand-authored in config.yml).
export const FONT_STACKS: Record<string, string> = {
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  grotesk: '"Helvetica Neue", Helvetica, Arial, "Segoe UI", system-ui, sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Segoe UI", system-ui, sans-serif',
  slab: 'Rockwell, "Rockwell Nova", "Roboto Slab", "DejaVu Serif", Georgia, serif',
  // Geometric sans (Futura family). Web-safe stack: Futura on macOS/iOS, Century Gothic on
  // Windows, else a generic geometric fallback. For pixel-consistent rendering everywhere,
  // upload a self-hosted geometric (e.g. Jost) via the Custom font picker.
  geometric: 'Futura, "Futura PT", "Century Gothic", "Avenir Next", "URW Geometric", ui-sans-serif, system-ui, sans-serif',
  // Condensed sans — narrow, space-efficient headlines (posters, signage, tight nav).
  condensed: '"Arial Narrow", "Helvetica Neue Condensed", "Roboto Condensed", "Liberation Sans Narrow", ui-sans-serif, sans-serif',
  // Humanist sans — open, legible, warm; screen-first (Verdana family). Good for body-heavy sites.
  humanist: 'Verdana, "Segoe UI", "Lucida Grande", "Lucida Sans Unicode", Geneva, Tahoma, ui-sans-serif, sans-serif',
  // Script / handwritten — for wordmarks and accents only, never body copy.
  script: '"Snell Roundhand", "Brush Script MT", "Segoe Script", "Bradley Hand", ui-rounded, cursive',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

export interface Webfont { family: string; fallbackFamily: string; fallback: string; }
// Curated self-hosted webfonts. The real @font-face is authored by resolveFonts
// (latin subset woff2, variable weight) so only latin ships; a capsize metric-
// matched Arial fallback makes the swap shift-free. Self-hosted (GDPR-safe); the
// woff2 is a static, content-hashed, cached-forever asset fetched once per user.
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

// Resolve the theme's font choices into CSS-var declarations, @font-face rules, and
// preload descriptors (so Base fetches custom fonts before paint — avoids the FOUT flash).
// Two independent custom uploads: one for the display (heading) picker, one for the body
// picker — each used where its picker is set to 'custom'. URLs are the served upload paths
// (Base resolves them via a glob).
// `webfontUrls` maps a WEBFONTS key to its served latin-woff2 URL — the SITE provides it
// (?url import of its @fontsource-variable dep), so only sites that wire a webfont ship
// its file. A selected webfont without a wired URL degrades to the system stack.
export function resolveFonts(
  theme: { fontDisplay?: string; fontBody?: string } = {},
  customDisplayUrl?: string | null,
  customBodyUrl?: string | null,
  webfontUrls: Record<string, string> = {},
): { vars: string[]; fontFace: string | null; preloads: { href: string; type: string }[] } {
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
  if (d) vars.push(`--bk-font-display:${d}`);
  const b = stack(theme.fontBody, bodyFamily);
  if (b) vars.push(`--bk-font-sans:${b}`);
  const faces: string[] = [];
  const preloads: { href: string; type: string }[] = [];
  if (customDisplayUrl) { faces.push(fontFace('StommeFontDisplay', customDisplayUrl)); preloads.push({ href: customDisplayUrl, type: mimeOf(customDisplayUrl) }); }
  if (customBodyUrl) { faces.push(fontFace('StommeFontBody', customBodyUrl)); preloads.push({ href: customBodyUrl, type: mimeOf(customBodyUrl) }); }
  // Curated webfonts: one @font-face + fallback + preload per distinct wired key
  // (display == body dedupes to a single pair).
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
