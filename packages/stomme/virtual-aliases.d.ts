// Ambient stand-ins for the `@stomme/*` module aliases integration.mjs creates at astro:config:setup — they exist only inside a build's Vite graph, so TypeScript has nothing to resolve without these.
declare module '@stomme/config' {
  export const site: import('./src/config.ts').SiteConfig;
  export const features: import('./src/config.ts').StommeFeatures;
  export const listings: import('./src/config.ts').Listing[];
}

declare module '@stomme/base' {
  const Base: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default Base;
}

declare module '@stomme/renderer' {
  const BlockRenderer: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default BlockRenderer;
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
