// Fallback target for the @stomme/addon-collections alias when no collections module is
// supplied (or STOMME_SLOTS_DIR is unset): exports an empty map, so a site with no addon
// dir merges nothing and its collections are exactly stommeCollections(). See the addon
// collections alias in integration.mjs and stommeAddonCollections() in addon-collections.ts.
export const collections = {};
