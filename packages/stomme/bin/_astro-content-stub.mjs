// Stub for Astro's virtual `astro:content` module, used only by gen-schema-manifest.mjs
// (via jiti alias) so collections.ts can be imported in plain Node — outside an Astro
// build the virtual module doesn't exist. `defineCollection` just returns its config
// (we only need the `.schema` off it), and `z` is Astro's OWN bundled zod (astro/zod),
// i.e. the exact zod the collection schemas are constructed with — so `.shape`
// introspection matches the real build. Not used at runtime by any site.
export { z } from 'astro/zod';
export const defineCollection = (config) => config;
export const reference = () => ({});
