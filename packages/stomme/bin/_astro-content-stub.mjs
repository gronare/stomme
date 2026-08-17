// Stands in for the virtual astro:content so gen-schema-manifest.mjs can import collections.ts in plain Node. `z` MUST stay astro/zod — the exact zod the schemas are built with — or .shape introspection silently stops matching the real build.
export { z } from 'astro/zod';
export const defineCollection = (config) => config;
export const reference = () => ({});
