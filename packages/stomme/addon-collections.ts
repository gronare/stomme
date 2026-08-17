// The integration aliases `@stomme/addon-collections` to STOMME_SLOTS_DIR's `collections.mjs`, or to a noop exporting `{}` — going through the alias is what keeps the addon module inside Astro's Vite graph, so its `astro:content` imports resolve like any collection's.
import { collections } from '@stomme/addon-collections';

export function stommeAddonCollections(): Record<string, unknown> {
  return (collections as Record<string, unknown>) || {};
}
