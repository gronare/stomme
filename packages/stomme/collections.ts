// The engine's content collections, as a factory. A site's content.config.ts is a
// one-liner: `export const collections = { ...stommeCollections(), ...myOwn }`.
//
// All collections are ALWAYS defined (even the optional ones). An optional
// collection with no content folder simply loads empty — harmless — and that's what
// lets feature flags gate *routes/admin/blocks* without the schema disappearing
// (so getCollection() never errors). Features decide what's shown; this decides what
// exists. Schemas are the superset the templates + generated CMS editors expect.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { resolveListings, type Listing } from './src/config.ts';

const seo = z.object({ title: z.string(), description: z.string() });
const blocks = z.array(z.object({ type: z.string() }).passthrough()).default([]);
const link = z.any().optional();
const md = (name: string) => glob({ pattern: '**/*.md', base: `./src/content/${name}` });
const dateField = z.union([z.string(), z.date()]).transform((d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d));

// Listing preset schemas — `article` (blog/news) and `catalog` (for-sale of anything).
export const PRESET_SCHEMAS = {
  article: z.object({ title: z.string(), date: dateField, excerpt: z.string().default(''), cover: z.string().optional(), showCover: z.boolean().default(false) }),
  catalog: z.object({
    title: z.string(),
    price: z.string().default(''),
    status: z.enum(['available', 'reserved', 'sold']).default('available'),
    category: z.string().default(''),
    cover: z.string().optional(),
    gallery: z.array(z.object({ image: z.string(), alt: z.string().default('') })).default([]),
    // Keyed by the listing's configured spec keys (see Listing.specs); labels live in config.
    specs: z.record(z.string()).default({}),
    date: dateField.optional(),
  }),
} as const;

// `listings` (from site.config) adds one collection per entry, keyed by id, using its
// preset schema — so news/for-sale/… exist as real collections without bespoke code.
export function stommeCollections(listings?: Listing[]) {
  const base: Record<string, ReturnType<typeof defineCollection>> = {
    home: defineCollection({ loader: md('home'), schema: z.object({ seo, blocks }) }),
    pages: defineCollection({ loader: md('pages'), schema: z.object({ title: z.string(), seo, blocks, published: z.boolean().default(true) }) }),

    settings: defineCollection({
      loader: md('settings'),
      schema: z.object({
        name: z.string(),
        description: z.string().default(''),
        phone: z.string().default(''),
        phoneE164: z.string().default(''),
        email: z.string().default(''),
        orgNr: z.string().default(''),
        founded: z.string().default(''),
        hq: z.string().default(''),
        facts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
        partners: z.array(z.string()).default([]),
        partnersLead: z.string().default(''),
        // Browser-tab icon (SVG recommended — scales to any size). Falls back to
        // the shipped /favicon.svg when unset. `appleIcon` is the iOS home-screen
        // PNG (180×180); optional.
        favicon: z.string().optional(),
        appleIcon: z.string().optional(),
      }),
    }),

    theme: defineCollection({
      loader: md('theme'),
      schema: z.object({
        brand: z.string().default('#4338ca'),
        ink: z.string().default('#1f2937'),
        onDark: z.string().default('#ffffff'),
        surface: z.string().default('#e0e7ff'),
        paper: z.string().default('#ffffff'),
        line: z.string().default('#e5e7eb'),
        // Secondary brand accent — a deployable second colour (eyebrow/callout choices).
        secondary: z.string().optional(),
        highlight: z.string().default('#f59e0b'),
        // Dark-section tokens — optional. Left unset, they derive from `brand`
        // (see styles.css :root). Set to override the dark surface exactly.
        dark: z.string().optional(),
        darkInk: z.string().optional(),
        darkLine: z.string().optional(),
        // Fonts — a curated stack key (see src/fonts.ts) or 'custom'; + an optional
        // uploaded font file used when a picker is set to 'custom'.
        fontDisplay: z.string().optional(),
        fontBody: z.string().optional(),
        fontCustomFile: z.string().optional(), // heading custom font
        fontCustomBodyFile: z.string().optional(), // body custom font
        fontCustomName: z.string().optional(),
        // Site-wide eyebrow style (the small label above headings): dash marker,
        // bullet marker, or the bold/wide cover treatment with no marker.
        eyebrow: z.enum(['dash', 'bullet', 'bold']).default('dash'),
        // Eyebrow marker colour — pick which accent the dash/bullet uses.
        eyebrowColor: z.enum(['brand', 'secondary', 'highlight']).default('brand'),
      }),
    }),

    navigation: defineCollection({
      loader: md('navigation'),
      schema: z.object({
        logo: z.object({ textPre: z.string().default(''), textAccent: z.string().default(''), image: z.string().optional(), alt: z.string().optional() }).default({}),
        items: z.array(z.object({
          label: z.string(),
          link,
          menu: z.string().optional(), // "<collectionId>::<routeBase>" → auto dropdown
          children: z.array(z.object({ label: z.string(), link })).default([]), // manual dropdown
        })).default([]),
        cta: z.object({ label: z.string(), link }).optional(),
        sticky: z.boolean().default(false),
      }),
    }),

    footer: defineCollection({
      loader: md('footer'),
      schema: z.object({
        dark: z.boolean().default(false),
        tagline: z.string().default(''),
        showLinks: z.boolean().default(true),
        linksHeading: z.string().default(''),
        links: z.array(z.object({ label: z.string(), link })).default([]),
        showTowns: z.boolean().default(false),
        townsHeading: z.string().default(''),
        legal: z.array(z.object({ label: z.string(), link })).default([]),
        note: z.string().default(''),
      }),
    }),

    // ── Optional (gated by features for admin/blocks/routes; always defined here) ──
    faq: defineCollection({ loader: md('faq'), schema: z.object({ question: z.string(), answer: z.string(), order: z.number().default(0) }) }),

    testimonials: defineCollection({ loader: md('testimonials'), schema: z.object({ name: z.string(), role: z.string().default(''), quote: z.string(), order: z.number().default(0) }) }),

    towns: defineCollection({
      loader: md('towns'),
      schema: z.object({
        name: z.string(),
        title: z.string().optional(),
        order: z.number().default(0),
        heroSubtitle: z.string().optional(),
        heroNote: z.string().optional(),
        why: z.string().optional(),
        problems: z.array(z.string()).default([]),
        districts: z.array(z.string()).default([]),
        localCase: z.string().optional(),
        services: z.array(z.string()).default([]),
        image: z.string().optional(),
        imageAlt: z.string().optional(),
        seo: seo.optional(),
      }),
    }),

    posts: defineCollection({ loader: md('posts'), schema: PRESET_SCHEMAS.article }),

    services: defineCollection({
      loader: md('services'),
      schema: z.object({
        title: z.string(),
        navLabel: z.string(),
        summary: z.string().default(''),
        order: z.number().default(0),
        bullets: z.array(z.string()).default([]),
        image: z.string().optional(),
        imageAlt: z.string().optional(),
        seo: seo.optional(),
      }),
    }),
  };

  // One collection per listing (skip ids that would clash with a base collection).
  for (const l of resolveListings(listings)) {
    if (!(l.id in base)) base[l.id] = defineCollection({ loader: md(l.id), schema: PRESET_SCHEMAS[l.preset] });
  }
  return base;
}
