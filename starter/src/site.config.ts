import type { KitConfig, StommeFeatures } from '@gronare/stomme/config';

// Optional engine features. Flip true → that collection's CMS editor, blocks, and
// detail routes switch on. Omitted/false = off, so new engine features never appear
// until you opt in. (Drives stomme-gen + the stomme() integration in astro.config.)
export const features: StommeFeatures = {
  faq: true, // the starter ships an FAQ demo
  blog: false, // → posts + /blog + postList
  areas: false, // → towns + /areas + linkChips
  services: false, // → services + /services + serviceGrid
  testimonials: false,
};

// Per-site config for the library blocks (routes / locale / fixed strings).
// Defaults are neutral English, so this only matters once you use collection-backed
// blocks (linkChips → towns, postList → posts) or want different prefixes/locale.
// Pass it to the engine renderer via a thin src/blocks/BlockRenderer.astro wrapper
// (`<Engine config={kit} registry={…} />`) — see docs/customizing.md. Route prefixes
// must match the route folders under src/pages/.
export const kit: KitConfig = {
  routes: { towns: '/areas', blog: '/blog', formSuccess: '/thanks' },
  locale: 'en-US', // date/number formatting
  cmsLocale: 'en', // Decap admin UI language: 'en' | 'sv' | 'da' | 'nb_no' | … (stomme-gen writes it to config.yml)
  strings: { readMore: 'Read more' },
};
