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

const seo = z.object({ title: z.string(), description: z.string() });
const blocks = z.array(z.object({ type: z.string() }).passthrough()).default([]);
const link = z.any().optional();
const md = (name: string) => glob({ pattern: '**/*.md', base: `./src/content/${name}` });

export function stommeCollections() {
  return {
    home: defineCollection({ loader: md('home'), schema: z.object({ seo, blocks }) }),
    pages: defineCollection({ loader: md('pages'), schema: z.object({ title: z.string(), seo, blocks }) }),

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
        highlight: z.string().default('#f59e0b'),
      }),
    }),

    navigation: defineCollection({
      loader: md('navigation'),
      schema: z.object({
        logo: z.object({ textPre: z.string().default(''), textAccent: z.string().default(''), image: z.string().optional(), alt: z.string().optional() }).default({}),
        items: z.array(z.object({ label: z.string(), link })).default([]),
        cta: z.object({ label: z.string(), link }).optional(),
      }),
    }),

    footer: defineCollection({
      loader: md('footer'),
      schema: z.object({
        tagline: z.string().default(''),
        linksHeading: z.string().default(''),
        links: z.array(z.object({ label: z.string(), link })).default([]),
        showTowns: z.boolean().default(false),
        townsHeading: z.string().default(''),
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

    posts: defineCollection({
      loader: md('posts'),
      schema: z.object({
        title: z.string(),
        date: z.union([z.string(), z.date()]).transform((d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d)),
        excerpt: z.string().default(''),
      }),
    }),

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
}
