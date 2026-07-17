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
import { readdirSync } from 'node:fs';
import { resolveListings, type Listing } from './src/config.ts';

// `ogRaw` opts an item out of its generated share card (settings.og): the item's own
// image is shared untouched instead of a card. Ignored when the master switch is off.
const seo = z.object({ title: z.string(), description: z.string(), image: z.string().optional(), ogRaw: z.boolean().optional() });
const blocks = z.array(z.object({ type: z.string() }).passthrough()).default([]);
const link = z.any().optional();
// A collection with no content on this site (missing folder, or a scaffolded folder
// holding only .gitkeep) loads empty via a no-op loader instead of a glob — same
// result (getCollection → []), but without the glob-loader "No files found" warning
// on every build. The first real entry (committed via CMS) flips it back to the glob
// on the next build; a running dev server needs a restart.
const hasMd = (dir: string) => {
  try { return readdirSync(dir, { recursive: true }).some((f) => String(f).endsWith('.md')); }
  catch { return false; }
};
const md = (name: string) =>
  hasMd(`./src/content/${name}`)
    ? glob({ pattern: '**/*.md', base: `./src/content/${name}` })
    : { name: 'stomme-empty', load: async () => {} };
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
    pages: defineCollection({ loader: md('pages'), schema: z.object({ title: z.string(), seo, blocks, published: z.boolean().default(false) }) }),

    // Identity — business name, logo, icons. `name` is the company name (footer ©, contact
    // card, LocalBusiness schema, logo aria-label), NOT a page title — pages set their own
    // required seo.title/description. Contact details live in the `contact` collection;
    // facts/partners live on their blocks (Stats / Logo-strip).
    settings: defineCollection({
      loader: md('settings'),
      schema: z.object({
        name: z.string(),
        // Logo lives with site identity (used in BOTH header and footer); each of those
        // chooses whether to show the mark / wordmark via their own toggles.
        logo: z.object({ image: z.string().optional(), alt: z.string().optional(), textPre: z.string().default(''), textAccent: z.string().default('') }).default({}),
        // Browser-tab icon (SVG recommended — scales to any size). Falls back to
        // the shipped /favicon.svg when unset. `appleIcon` is the iOS home-screen PNG (180×180).
        favicon: z.string().optional(),
        appleIcon: z.string().optional(),
        // Site default social-share image (og:image / Twitter card): the fallback shown
        // for the start page and any page with no per-page override and no generated card.
        ogImage: z.string().optional(),
        // Generated share cards — a presence-driven, layered, per-type model.
        //
        //   `enabled` is the MASTER switch (default FALSE = zero behaviour change):
        //     OFF → og:image = per-page override (image/seo.image) ?? ogImage (Phase-1).
        //     ON  → the layered system: per-page override → per-type generated card →
        //           site default (ogImage → home-hero image → a generated brand card).
        //
        //   `types` holds ONE config per generatable type (key = a listing id, or
        //   "towns"/"services"). When a type's `enabled` is true (and the master is on)
        //   each of its items gets a build-time card: the item photo cropped to 1200×630
        //   with a scrim + a headline/second line picked from the item's own fields +
        //   an optional wordmark. All optional with defaults so existing content validates.
        og: z.object({
          enabled: z.boolean().default(false),
          types: z
            .record(
              z.object({
                enabled: z.boolean().default(false),
                // Card layout preset: editorial (bottom gradient — default),
                // bold (centred statement), ops (left panel).
                style: z.enum(['editorial', 'bold', 'ops']).default('editorial'),
                // Which item field the headline (big line) is filled from; 'business' =
                // the business name. Blank ⇒ the per-type default (towns: name, else title).
                headlineField: z.string().default(''),
                // The smaller second line: an item field, 'business', or 'none'. Blank ⇒
                // the per-type default (catalog: price, else none).
                sublineField: z.string().default(''),
                // Gradient opacity over the photo, 0–100.
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

    // Contact details — phone/email/hours + registration (used by the contact form,
    // the direct-contact card, and the footer).
    contact: defineCollection({
      loader: md('contact'),
      schema: z.object({
        phone: z.string().default(''),
        phoneE164: z.string().default(''),
        email: z.string().default(''),
        // Hide phone + email from scrapers: don't emit tel:/mailto: or the value in the
        // HTML anywhere — render an obfuscated link that a page script reveals in-browser.
        protectContact: z.boolean().default(false),
        // Structured address — feeds the card, the footer, the map, and the LocalBusiness schema.
        address: z.object({
          street: z.string().default(''),
          postcode: z.string().default(''),
          city: z.string().default(''),
          country: z.string().default(''),
          lat: z.number().optional(),
          lng: z.number().optional(),
        }).default({}),
        // Weekly hours as editable lines (days + hours text), an optional note under the
        // list (e.g. "Closed 12–13 for lunch"), plus special/holiday lines.
        hours: z.array(z.object({ days: z.string(), hours: z.string() })).default([]),
        hoursNote: z.string().default(''),
        holidayHours: z.array(z.object({ when: z.string(), note: z.string() })).default([]),
        // Global "we're away" banner — shows on every card; auto-hides past `until` (client-side).
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
        items: z.array(z.object({
          label: z.string(),
          link,
          menu: z.string().optional(), // "<collectionId>::<routeBase>" → auto dropdown
          children: z.array(z.object({ label: z.string(), link })).default([]), // manual dropdown
        })).default([]),
        cta: z.object({ label: z.string(), link }).optional(),
        sticky: z.boolean().default(false),
        // Which parts of the site logo (Identity settings) the header shows.
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
        // Optional second link group (e.g. a services column beside the shortcuts).
        links2Heading: z.string().default(''),
        links2: z.array(z.object({ label: z.string(), link })).default([]),
        showTowns: z.boolean().default(false),
        townsHeading: z.string().default(''),
        legal: z.array(z.object({ label: z.string(), link })).default([]),
        note: z.string().default(''),
        // Which parts of the site logo (Identity settings) the footer shows.
        showLogo: z.boolean().default(false),
        showWordmark: z.boolean().default(false),
      }),
    }),

    // ── Optional (gated by features for admin/blocks/routes; always defined here) ──
    faq: defineCollection({ loader: md('faq'), schema: z.object({ question: z.string(), answer: z.string(), order: z.number().default(0), tags: z.array(z.string()).default([]) }) }),
    // Contact-form confirmation copy (the "Thank-you" settings pane + /thanks page). All
    // optional — blank falls back to the localized defaults.
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
        // Optional COMPACT page-header for block-composed entries: ServicePage
        // renders eyebrow + H1 (= title) + lede (= summary) + ✓ ticks + CTA with
        // the image beside the text — lighter than a hero (that belongs to the
        // homepage). All fields optional — ticks default to `bullets`; the primary
        // CTA defaults to the service strings + contact route; image defaults to
        // the entry's own `image` (the same art as its card in service lists).
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
        // Optional composed sections (same block picker as pages) — rendered by
        // ServicePage between the intro and the quote CTA, so a service detail can
        // be fleshed out beyond the template (feature rows, steps, CTA bands…).
        blocks,
      }),
    }),
  };

  // One collection per listing (skip ids that would clash with a base collection).
  for (const l of resolveListings(listings)) {
    if (!(l.id in base)) base[l.id] = defineCollection({ loader: md(l.id), schema: PRESET_SCHEMAS[l.preset] });
  }
  return base;
}
