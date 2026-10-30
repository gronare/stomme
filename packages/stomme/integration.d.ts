import type { AstroIntegration } from 'astro';
import type { Listing, StommeFeatures } from './src/config';

export interface StommeIntegrationOptions {
  features?: StommeFeatures;
  routes?: Record<string, string | undefined>;
  listings?: Listing[];
  layout?: string;
  config?: string;
  // Normally read straight from the site config's `locales`; pass it here only to override that. Fewer than two locales injects no locale routes at all.
  locales?: string[];
  // Removed: the engine loads no theme directories, and refuseStyle stops a build that still passes one.
  style?: never;
}
export default function stomme(options?: StommeIntegrationOptions): AstroIntegration;
export function localePages(root?: string): { id: string; data: { published: boolean; url?: string } }[];
