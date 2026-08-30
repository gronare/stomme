// Every collection is ALWAYS defined, optional ones included, and each schema is the superset the templates + generated CMS editors expect — features gate routes/admin/blocks, never the schema, so getCollection() can't error on a site that lacks the folder.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { readdirSync } from 'node:fs';
import { resolveListings, type Listing } from './src/config.ts';

const seo = z.object({ title: z.string(), description: z.string(), image: z.string().optional(), ogRaw: z.boolean().optional() });
const blocks = z.array(z.object({ type: z.string() }).passthrough()).default([]);
const link = z.any().optional();
const hasMd = (dir: string) => {
  try { return readdirSync(dir, { recursive: true }).some((f) => String(f).endsWith('.md')); }
  catch { return false; }
};
// Astro's own entry id is the filename run through github-slugger, which drops the dot: `kontakt.en` would collapse into `kontakten` and the locale file could never be looked up. Same slug rules, one exception — a trailing language subtag survives.
const LOCALE_TAIL = /\.([a-z]{2,3}(?:-[a-z0-9]{2,8})?)$/i;
const slugSegment = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}\-_]+/gu, '');
export function localeAwareId(entry: string): string {
  const noExt = String(entry).replace(/\.[^./]+$/, '');
  const tail = noExt.match(LOCALE_TAIL);
  const stem = tail ? noExt.slice(0, -tail[0].length) : noExt;
  const id = stem.split('/').map(slugSegment).join('/').replace(/\/index$/, '');
  return tail ? `${id}.${tail[1].toLowerCase()}` : id;
}
const md = (name: string) =>
  hasMd(`./src/content/${name}`)
    ? glob({ pattern: '**/*.md', base: `./src/content/${name}`, generateId: ({ entry, data }) => (data?.slug ? String(data.slug) : localeAwareId(entry)) })
    : { name: 'stomme-empty', load: async () => {} };
const dateField = z.union([z.string(), z.date()]).transform((d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d));

export const PRESET_SCHEMAS = {
  article: z.object({ title: z.string(), date: dateField, excerpt: z.string().default(''), cover: z.string().optional(), showCover: z.boolean().default(false) }),
  catalog: z.object({
    title: z.string(),
    price: z.string().default(''),
    status: z.enum(['available', 'reserved', 'sold']).default('available'),
    category: z.string().default(''),
    cover: z.string().optional(),
    gallery: z.array(z.object({ image: z.string(), alt: z.string().default('') })).default([]),
    specs: z.record(z.string()).default({}),
    date: dateField.optional(),
  }),
} as const;

export function stommeCollections(listings?: Listing[]) {
  const base: Record<string, ReturnType<typeof defineCollection>> = {
    home: defineCollection({ loader: md('home'), schema: z.object({ seo, blocks }) }),
    // The slug rule lives in src/i18n.ts and fails the build there; a second rule here would drift.
    pages: defineCollection({ loader: md('pages'), schema: z.object({ title: z.string(), url: z.string().optional(), seo, blocks, published: z.boolean().default(false) }) }),

    settings: defineCollection({
      loader: md('settings'),
      schema: z.object({
        name: z.string(),
        logo: z.object({ image: z.string().optional(), alt: z.string().optional(), textPre: z.string().default(''), textAccent: z.string().default('') }).default({}),
        favicon: z.string().optional(),
        appleIcon: z.string().optional(),
        languageSwitcher: z.enum(['globe', 'flags']).default('globe'),
        ogImage: z.string().optional(),
        og: z.object({
          enabled: z.boolean().default(false),
          types: z
            .record(
              z.object({
                enabled: z.boolean().default(false),
                style: z.enum(['editorial', 'bold', 'ops']).default('editorial'),
                headlineField: z.string().default(''),
                sublineField: z.string().default(''),
                scrim: z.number().min(0).max(100).default(55),
                showLogo: z.boolean().default(true),
                accent: z.string().optional(),
              }).default({}),
            )
            .default({}),
        }).default({}),
      }),
    }),

    contact: defineCollection({
      loader: md('contact'),
      schema: z.object({
        phone: z.string().default(''),
        phoneE164: z.string().default(''),
        email: z.string().default(''),
        protectContact: z.boolean().default(false),
        address: z.object({
          street: z.string().default(''),
          postcode: z.string().default(''),
          city: z.string().default(''),
          country: z.string().default(''),
          lat: z.number().optional(),
          lng: z.number().optional(),
        }).default({}),
        hours: z.array(z.object({ days: z.string(), hours: z.string() })).default([]),
        hoursNote: z.string().default(''),
        holidayHours: z.array(z.object({ when: z.string(), note: z.string() })).default([]),
        away: z.object({
          enabled: z.boolean().default(false),
          message: z.string().default(''),
          until: z.string().default(''),
        }).default({}),
        socials: z.array(z.object({ platform: z.string(), url: z.string() })).default([]),
        orgNr: z.string().default(''),
        founded: z.string().default(''),
      }),
    }),

    theme: defineCollection({
      loader: md('theme'),
      schema: z.object({
        brand: z.string().default('#4338ca'),
        ink: z.string().default('#1f2937'),
        muted: z.string().optional(),
        onDark: z.string().default('#ffffff'),
        surface: z.string().default('#e0e7ff'),
        paper: z.string().default('#ffffff'),
        line: z.string().default('#e5e7eb'),
        secondary: z.string().optional(),
        highlight: z.string().default('#f59e0b'),
        dark: z.string().optional(),
        darkInk: z.string().optional(),
        darkLine: z.string().optional(),
        fontDisplay: z.string().optional(),
        fontBody: z.string().optional(),
        fontCustomFile: z.string().optional(),
        fontCustomBodyFile: z.string().optional(),
        eyebrow: z.enum(['dash', 'bullet', 'bold']).default('dash'),
        eyebrowColor: z.enum(['brand', 'secondary', 'highlight']).default('brand'),
      }),
    }),

    navigation: defineCollection({
      loader: md('navigation'),
      schema: z.object({
        items: z.array(z.object({
          label: z.string(),
          link,
          menu: z.string().optional(),
          children: z.array(z.object({ label: z.string(), link })).default([]),
        })).default([]),
        cta: z.object({ label: z.string(), link }).optional(),
        sticky: z.boolean().default(false),
        showLogo: z.boolean().default(false),
        showWordmark: z.boolean().default(false),
      }),
    }),

    footer: defineCollection({
      loader: md('footer'),
      schema: z.object({
        dark: z.boolean().default(false),
        tagline: z.string().default(''),
        showLinks: z.boolean().default(false),
        linksHeading: z.string().default(''),
        links: z.array(z.object({ label: z.string(), link })).default([]),
        links2Heading: z.string().default(''),
        links2: z.array(z.object({ label: z.string(), link })).default([]),
        showTowns: z.boolean().default(false),
        townsHeading: z.string().default(''),
        showAddress: z.boolean().default(false),
        showHours: z.boolean().default(false),
        showSocials: z.boolean().default(false),
        legal: z.array(z.object({ label: z.string(), link })).default([]),
        note: z.string().default(''),
        showLogo: z.boolean().default(false),
        showWordmark: z.boolean().default(false),
      }),
    }),

    faq: defineCollection({ loader: md('faq'), schema: z.object({ question: z.string(), answer: z.string(), order: z.number().default(0), tags: z.array(z.string()).default([]) }) }),
    thanks: defineCollection({ loader: md('thanks'), schema: z.object({ variant: z.string().optional(), heading: z.string().optional(), message: z.string().optional(), button: link, button2: link, showContact: z.boolean().default(false) }) }),
    tracking: defineCollection({ loader: md('tracking'), schema: z.object({ gtmId: z.string().default(''), ga4Id: z.string().default(''), metaPixelId: z.string().default(''), privacyUrl: z.string().default('') }) }),

    testimonials: defineCollection({ loader: md('testimonials'), schema: z.object({ name: z.string(), role: z.string().default(''), quote: z.string(), order: z.number().default(0) }) }),

    documents: defineCollection({
      loader: md('documents'),
      schema: z.object({
        title: z.string(),
        file: z.string(),
        group: z.string().default(''),
        date: dateField.optional(),
        note: z.string().default(''),
        order: z.number().default(0),
      }),
    }),

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
        media: z.object({ image: z.string().optional(), imageAlt: z.string().optional() }).optional(),
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
        media: z.object({ image: z.string().optional(), imageAlt: z.string().optional() }).optional(),
        seo: seo.optional(),
        hero: z
          .object({
            image: z.string().optional(),
            imageAlt: z.string().optional(),
            ticks: z.array(z.string()).default([]),
            cta: z.object({ label: z.string().optional(), link }).optional(),
            cta2: z.object({ label: z.string().optional(), link }).optional(),
            ctaLabel: z.string().optional(),
            ctaHref: link,
            cta2Label: z.string().optional(),
            cta2Href: link,
          })
          .passthrough()
          .optional(),
        blocks,
      }),
    }),
  };

  for (const l of resolveListings(listings)) {
    if (!(l.id in base)) base[l.id] = defineCollection({ loader: md(l.id), schema: PRESET_SCHEMAS[l.preset] });
  }
  return base;
}
