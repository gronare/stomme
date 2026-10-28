// Ambient stand-ins for the `@stomme/*` module aliases integration.mjs creates at astro:config:setup — they exist only inside a build's Vite graph, so TypeScript has nothing to resolve without these.
declare module '@stomme/config' {
  export const site: import('./src/config.ts').SiteConfig;
  export const features: import('./src/config.ts').StommeFeatures;
  export const listings: import('./src/config.ts').Listing[];
}

// Defined by integration.mjs on every build, true only where it injected /map/[point].png.
declare const __STOMME_MAP_PROXY__: boolean;

declare module '@stomme/base' {
  const Base: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default Base;
}

declare module '@stomme/renderer' {
  const BlockRenderer: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default BlockRenderer;
}

// The platform's bindings and secrets: `cloudflare:workers` on the Cloudflare adapter, undefined on every other target.
declare module '@stomme/runtime-env' {
  export const env: Record<string, any> | undefined;
}

declare module '@stomme/addon-blocks' {
  export const blocks: Record<string, import('astro/runtime/server/index.js').AstroComponentFactory>;
}

declare module '@stomme/addon-catalog' {
  export const BLOCKS: Array<Record<string, unknown>>;
}

declare module '@stomme/addon-collections' {
  export const collections: Record<string, unknown>;
}

declare module '@stomme/slot-*' {
  const Slot: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default Slot;
}

// The docs feature's build-time data, written by integration.mjs only when features.docs is on.
declare module '@stomme/docs' {
  const docs: import('./src/docs-data').DocsData;
  export default docs;
}
