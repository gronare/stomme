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
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

const CUSTOM_FAMILY = '"StommeCustom"';
const formatOf = (path: string) =>
  path.endsWith('.woff2') ? 'woff2' : path.endsWith('.woff') ? 'woff' : path.endsWith('.otf') ? 'opentype' : 'truetype';

// Resolve the theme's font choices into CSS-var declarations + an optional @font-face.
// `customUrl` is the served URL of an uploaded font file (Base resolves it via a glob).
export function resolveFonts(
  theme: { fontDisplay?: string; fontBody?: string } = {},
  customUrl?: string | null,
): { vars: string[]; fontFace: string | null } {
  const stack = (key?: string): string | null => {
    if (key === 'custom') return customUrl ? `${CUSTOM_FAMILY}, ${FONT_STACKS.system}` : null;
    return key && FONT_STACKS[key] ? FONT_STACKS[key] : null;
  };
  const vars: string[] = [];
  const d = stack(theme.fontDisplay);
  if (d) vars.push(`--bk-font-display:${d}`);
  const b = stack(theme.fontBody);
  if (b) vars.push(`--bk-font-sans:${b}`);
  const fontFace = customUrl
    ? `@font-face{font-family:${CUSTOM_FAMILY};src:url("${customUrl}") format("${formatOf(customUrl)}");font-display:swap;font-weight:100 900;}`
    : null;
  return { vars, fontFace };
}
