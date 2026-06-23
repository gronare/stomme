import type { AstroIntegration } from 'astro';
import type { StommeFeatures } from './src/config';

export interface StommeIntegrationOptions {
  features?: StommeFeatures;
  routes?: Record<string, string | undefined>;
  layout?: string;
  config?: string;
}
export default function stomme(options?: StommeIntegrationOptions): AstroIntegration;
