// Fallback target for the @stomme/addon-blocks alias when no blocks module is supplied (or
// STOMME_SLOTS_DIR is unset): exports an empty registry, so a site with no addon dir renders
// exactly the library blocks. See the addon blocks alias in integration.mjs.
export const blocks = {};
