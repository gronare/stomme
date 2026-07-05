import type { AstroIntegration } from 'astro';
import type { StommeFeatures } from './src/config';

export interface StommeIntegrationOptions {
  features?: StommeFeatures;
  routes?: Record<string, string | undefined>;
  layout?: string;
  config?: string;
  // Name of a theme directory (under STOMME_THEMES_DIR or a themes checkout beside the
  // engine) whose tokens.css + theme.css are spliced into the site's global.css. Unset
  // (or STOMME_STYLE) ⇒ no theme layer, output unchanged. Missing named theme ⇒ build error.
  style?: string;
}
export default function stomme(options?: StommeIntegrationOptions): AstroIntegration;
