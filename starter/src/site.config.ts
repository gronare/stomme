import type { SiteConfig, StommeFeatures, Listing } from '@gronare/stomme/config';

// ─────────────────────────────────────────────────────────────────────────────────────
// site.config.ts — the single file that configures the engine for this site.
// Three exports: `features` (on/off capabilities), `site` (routes, locale, wording),
// and `listings` (config-defined collections). After changing ANYTHING here, re-run the
// generator so /admin reflects it: `pnpm cms:gen` (or just `pnpm dev` / `pnpm build`,
// which run it for you). Editing this file alone does not update the CMS until then.
// ─────────────────────────────────────────────────────────────────────────────────────

// FEATURES — optional capabilities. true → that collection's CMS editor, its blocks, and
// its detail routes switch on (each is its own collection in the admin sidebar).
// false/omitted → completely hidden. Turning one on later never breaks existing content.
export const features: StommeFeatures = {
  faq: true, // FAQ collection + the "FAQ" block
  blog: false, // posts collection + an editable /blog index + /blog/<post> pages + "Blog posts" block
  areas: false, // towns collection + /areas/<town> pages + "Link chips" block
  services: false, // services collection + /services/<service> pages + "Service cards" block
  testimonials: false, // testimonials collection + the "Testimonials" block
};

// SITE — configuration handed to the blocks and page templates.
export const site: SiteConfig = {
  // Route prefixes for collection pages. For the feature-backed ones (blog/areas/services)
  // these must match the route folders under src/pages/. Defaults shown — override as needed.
  routes: {
    services: '/services', // "Service cards" block + service detail pages
    towns: '/areas', // "Link chips" block + town/area detail pages
    blog: '/blog', // "Blog posts" block + post detail pages
    contact: '/contact', // where contact CTAs (town/service pages, catalog) link to
    formSuccess: '/thanks', // the contact-form success page
  },

  // ⚠️ TWO DIFFERENT locales — don't mix them up:
  locale: 'en-US', //   (1) date & number FORMATTING (BCP47 tag). e.g. 'sv-SE', 'nb-NO', 'de-DE'.
  cmsLocale: 'en', //   (2) the Decap ADMIN UI language: 'en' | 'sv' | 'da' | 'nb_no' | …
  //        ↑ This is the one that makes /admin Swedish. Re-run `pnpm cms:gen` after changing it
  //          (it's written into public/admin/config.yml), then hard-reload /admin.

  // Fixed wording used by blocks/templates. Override only what you want changed; anything
  // omitted falls back to the engine's English defaults. All groups below are optional.
  strings: {
    readMore: 'Read more',
    // Contact form field labels:
    // contact: { name: 'Name', email: 'Email', phone: 'Phone', message: 'Message', submit: 'Send', direct: 'Or reach us directly' },
    // Catalog (for-sale) listing wording:
    // listingStatus: { available: 'Available', reserved: 'Reserved', sold: 'Sold', all: 'All' },
    // listingCta: 'Contact us',
    // Town/area page chrome ({name} is replaced with the town name):
    // town: { eyebrow: 'Local service: {name}', heading: '{name}', cta: 'Get a quote', whyHeading: 'Why choose us in {name}?', servicesHeading: 'Our services in {name}' },
    // Service page chrome:
    // service: { eyebrow: 'Service', quoteEyebrow: 'Free quote', quoteHeading: 'Want to know what it costs?', cta: 'Get a quote' },
  },
};

// LISTINGS — config-defined collections. Each entry becomes its own admin collection, an
// editable index page (seeded at `route`), and detail pages at `route`/<slug>. Add as many
// as you want — news AND for-sale AND … can coexist. Empty by default.
//
// Each listing: { id, route, label, preset, options? }
//   id      — collection name + content folder (src/content/<id>)
//   route   — index + detail URL base, e.g. '/till-salu'
//   label   — admin collection + nav label
//   preset  — 'article' (title, date, excerpt, cover, body  → blog/news)
//          — 'catalog' (title, price, status, category, gallery, specs, body → for-sale of anything)
//   options — optional presentation: { columns?: number; showImages?: boolean; featured?: boolean; filters?: boolean }
// Uncomment an example to enable it, then run `pnpm cms:gen`. You then get, per entry:
//   • an admin collection "Nyheter" / "Till salu" to add entries in
//   • an editable index page at the route (pageHeader + the list block), seeded once
//   • detail pages at <route>/<slug>
//   • content under src/content/<id>/ (e.g. src/content/nyheter/my-post.md)
export const listings: Listing[] = [
  // News: /nyheter index + /nyheter/<slug> posts. Entries: title, date, excerpt, cover, body.
  // { id: 'nyheter', route: '/nyheter', label: 'Nyheter', preset: 'article' },

  // For-sale (e.g. used cars): /till-salu index with category filters + status badges
  // (available/reserved/sold), and /till-salu/<slug> detail with price, specs + gallery.
  // { id: 'bilar', route: '/till-salu', label: 'Till salu', preset: 'catalog', options: { columns: 3, filters: true } },
];
