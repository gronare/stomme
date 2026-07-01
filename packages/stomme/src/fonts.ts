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
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
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
export function resolveFonts(
  theme: { fontDisplay?: string; fontBody?: string } = {},
  customDisplayUrl?: string | null,
  customBodyUrl?: string | null,
): { vars: string[]; fontFace: string | null; preloads: { href: string; type: string }[] } {
  const stack = (key: string | undefined, customFamily: string | null): string | null => {
    if (key === 'custom') return customFamily ? `${customFamily}, ${FONT_STACKS.system}` : null;
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
  return { vars, fontFace: faces.length ? faces.join('') : null, preloads };
}
