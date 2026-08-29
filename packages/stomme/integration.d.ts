import type { AstroIntegration } from 'astro';
import type { StommeFeatures } from './src/config';

export interface StommeIntegrationOptions {
  features?: StommeFeatures;
  routes?: Record<string, string | undefined>;
  layout?: string;
  config?: string;
  // A theme directory under STOMME_THEMES_DIR whose tokens.css + theme.css splice into the site's global.css. This and STOMME_STYLE both unset means no theme layer and unchanged output; a name set without the env var, or with no theme.css behind it, is a build error.
  style?: string;
  // Normally read straight from the site config's `locales`; pass it here only to override that. Fewer than two locales injects no locale routes at all.
  locales?: string[];
}
export default function stomme(options?: StommeIntegrationOptions): AstroIntegration;
