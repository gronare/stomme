import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Inline a site-local SVG so it can tint to its context. Used for logos: a
// lockup whose wordmark is `fill="currentColor"` follows the surrounding
// `.logo` colour (ink in the light header, on-dark in the footer, light when
// overlaid on a dark hero) while the mark badge keeps its own fixed colours.
// Only local `/…​.svg` paths are inlined (read from the site's public/ dir);
// anything else — uploaded rasters, remote URLs — returns null so the caller
// falls back to an <img>. Runs at build/SSR (Node), so fs is available.
export function inlineLocalSvg(src?: string | null): string | null {
  if (!src || !src.startsWith('/') || !src.toLowerCase().endsWith('.svg')) return null;
  try {
    return readFileSync(join(process.cwd(), 'public', src.replace(/^\//, '')), 'utf8');
  } catch {
    return null;
  }
}
