// Addon-contributed content collections, merged into a site's collections alongside
// stommeCollections(). Supplied entirely via STOMME_SLOTS_DIR (mirrors the slot seam and
// STOMME_THEMES_DIR — the engine hardcodes no addon location or repo name): the integration
// aliases `@stomme/addon-collections` to the dir's `collections.mjs` when it exists, else to
// a noop that exports `{}`. Resolving through the alias keeps the addon module inside Astro's
// Vite graph, so its `astro:content` imports (defineCollection/z) resolve like any collection.
//
// A site's content.config spreads it after the engine's own:
//   export const collections = { ...stommeCollections(listings), ...stommeAddonCollections() };
//
// No dir / no `collections.mjs` ⇒ `{}` ⇒ the site's collections are unchanged.
import { collections } from '@stomme/addon-collections';

export function stommeAddonCollections(): Record<string, unknown> {
  return (collections as Record<string, unknown>) || {};
}
