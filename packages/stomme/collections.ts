// Every collection is ALWAYS defined, optional ones included, and each schema is the superset the templates + generated CMS editors expect — features gate routes/admin/blocks, never the schema, so getCollection() can't error on a site that lacks the folder.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { readdirSync } from 'node:fs';
import { resolveListings, type Listing } from './src/config.ts';

// `ogRaw` opts an item out of its generated share card — its own image is shared untouched instead; ignored when settings.og.enabled is off.
const seo = z.object({ title: z.string(), description: z.string(), image: z.string().optional(), ogRaw: z.boolean().optional() });
const blocks = z.array(z.object({ type: z.string() }).passthrough()).default([]);
const link = z.any().optional();
// A content-less collection loads via a no-op loader, not a glob, only to silence the "No files found" warning; the first committed entry flips it back to the glob on the NEXT build — a running dev server needs a restart.
const hasMd = (dir: string) => {
  try { return readdirSync(dir, { recursive: true }).some((f) => String(f).endsWith('.md')); }
  catch { return false; }
};
const md = (name: string) =>
  hasMd(`./src/content/${name}`)
    ? glob({ pattern: '**/*.md', base: `./src/content/${name}` })
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
    // Keyed by the listing's configured spec keys (see Listing.specs); labels live in config.
    specs: z.record(z.string()).default({}),
    date: dateField.optional(),
  }),
} as const;

export function stommeCollections(listings?: Listing[]) {
  const base: Record<string, ReturnType<typeof defineCollection>> = {
    home: defineCollection({ loader: md('home'), schema: z.object({ seo, blocks }) }),
    pages: defineCollection({ loader: md('pages'), schema: z.object({ title: z.string(), seo, blocks, published: z.boolean().default(false) }) }),

    // `name` is the business name (footer ©, contact card, LocalBusiness schema, logo aria-label), never a page title — pages carry their own required seo.title/description.
    settings: defineCollection({
      loader: md('settings'),
      schema: z.object({
        name: z.string(),
        // One logo for BOTH header and footer; each picks the mark / wordmark via its own showLogo + showWordmark.
        logo: z.object({ image: z.string().optional(), alt: z.string().optional(), textPre: z.string().default(''), textAccent: z.string().default('') }).default({}),
        // Unset ⇒ the shipped /favicon.svg; `appleIcon` is the iOS home-screen PNG (180×180).
        favicon: z.string().optional(),
        appleIcon: z.string().optional(),
        ogImage: z.string().optional(),
        // `enabled` is the MASTER switch, default FALSE = zero behaviour change: off ⇒ og:image is the per-page override ?? ogImage; on ⇒ per-page override → per-type generated card → ogImage → home-hero image → a generated brand card. `types` is keyed by a listing id or "towns"/"services", and every field defaults so existing content still validates.
        og: z.object({
          enabled: z.boolean().default(false),
          types: z
            .record(
              z.object({
                enabled: z.boolean().default(false),
                // editorial = bottom gradient, bold = centred statement, ops = left panel.
                style: z.enum(['editorial', 'bold', 'ops']).default('editorial'),
                // The item field the big line comes from, or 'business' for the business name; blank ⇒ the per-type default (towns: name, else title).
                headlineField: z.string().default(''),
                // The small second line: an item field, 'business' or 'none'; blank ⇒ the per-type default (catalog: price, else none).
                sublineField: z.string().default(''),
                scrim: z.number().min(0).max(100).default(55),
                showLogo: z.boolean().default(true),
                // Accent colour (rule/bar + wordmark accent). Defaults to theme.brand.
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
        // On, neither tel:/mailto: nor the value itself may reach the HTML anywhere — an obfuscated link is emitted and a page script reveals it in-browser.
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
        // Shows on every contact card, and a page script hides it once `until` has passed.
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
        // Left unset these derive from `brand` (styles.css :root); set them to pin the dark surface exactly.
        dark: z.string().optional(),
        darkInk: z.string().optional(),
        darkLine: z.string().optional(),
        // A curated stack key (src/fonts.ts) or 'custom', in which case the matching uploaded file below is used.
        fontDisplay: z.string().optional(),
        fontBody: z.string().optional(),
        fontCustomFile: z.string().optional(),
        fontCustomBodyFile: z.string().optional(),
        // The marker on the small label above headings: a dash, a dot, or 'bold' — no marker, bold and wide-tracked instead.
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
          menu: z.string().optional(), // "<collectionId>::<routeBase>" → auto dropdown
          children: z.array(z.object({ label: z.string(), link })).default([]), // manual dropdown
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
        legal: z.array(z.object({ label: z.string(), link })).default([]),
        note: z.string().default(''),
        showLogo: z.boolean().default(false),
        showWordmark: z.boolean().default(false),
      }),
    }),

    faq: defineCollection({ loader: md('faq'), schema: z.object({ question: z.string(), answer: z.string(), order: z.number().default(0), tags: z.array(z.string()).default([]) }) }),
    // Blank fields fall back to the localized defaults, so every one of these is optional.
    thanks: defineCollection({ loader: md('thanks'), schema: z.object({ variant: z.string().optional(), heading: z.string().optional(), message: z.string().optional(), button: link, button2: link, showContact: z.boolean().default(false) }) }),
    tracking: defineCollection({ loader: md('tracking'), schema: z.object({ gtmId: z.string().default(''), ga4Id: z.string().default(''), metaPixelId: z.string().default(''), privacyUrl: z.string().default('') }) }),

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
        // Grouped shape (block-field convention): the page photo lives in `media`.
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
        // Grouped shape (block-field convention): the card/header photo lives in `media`.
        media: z.object({ image: z.string().optional(), imageAlt: z.string().optional() }).optional(),
        seo: seo.optional(),
        // ServicePage upgrades a BLOCK-COMPOSED entry to a compact page-header when this is present, and renders the legacy layout when it isn't; everything is optional because ticks fall back to `bullets`, the CTA to the service strings + contact route, and the image to the entry's own `media.image`.
        hero: z
          .object({
            image: z.string().optional(),
            imageAlt: z.string().optional(),
            ticks: z.array(z.string()).default([]),
            // Grouped buttons (buttonField shape); the flat pairs are legacy content.
            cta: z.object({ label: z.string().optional(), link }).optional(),
            cta2: z.object({ label: z.string().optional(), link }).optional(),
            ctaLabel: z.string().optional(),
            ctaHref: link,
            cta2Label: z.string().optional(),
            cta2Href: link,
          })
          .passthrough() // tolerate older content (e.g. a leftover hero `media` key)
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
