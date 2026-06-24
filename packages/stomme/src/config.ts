// Per-site configuration for the library blocks: where collection pages live,
// how dates format, and a few fixed strings. A site passes this to BlockRenderer
// (`<BlockRenderer config={...}>`), which forwards it to every block as `kit`.
// The TownPage/ServicePage templates take the same `kit`.
// Defaults are neutral English; override only what differs.
export interface KitConfig {
  routes?: {
    services?: string; // serviceGrid + ServicePage detail-page prefix
    towns?: string; // linkChips + TownPage detail-page prefix
    blog?: string; // postList detail-page prefix
    contact?: string; // contact page (town/service CTAs link here)
    formSuccess?: string; // contactForm success page
  };
  locale?: string; // date/number formatting (BCP47, e.g. 'sv-SE')
  cmsLocale?: string; // Decap admin UI language (e.g. 'en', 'sv'); written to config.yml by stomme-gen
  strings?: {
    readMore?: string;
    contact?: { name?: string; email?: string; phone?: string; message?: string; submit?: string; direct?: string };
    // TownPage chrome. Strings may contain `{name}` — replaced with the town name.
    town?: {
      eyebrow?: string;
      heading?: string; // H1 template when a town has no `title`; e.g. 'Cleaning in {name}'
      cta?: string;
      whyHeading?: string;
      problemsHeading?: string;
      districtsHeading?: string;
      caseHeading?: string;
      reasons?: { title: string; body: string }[]; // shown as cards on every town; `{name}` interpolated
      servicesHeading?: string;
      servicesCta?: string;
    };
    // ServicePage chrome.
    service?: { eyebrow?: string; quoteEyebrow?: string; quoteHeading?: string; cta?: string };
    // Catalog listing chrome (for-sale presentation).
    listingStatus?: { available?: string; reserved?: string; sold?: string; all?: string };
    listingCta?: string;
  };
}

// Optional capabilities a site can switch on. A flag that's missing (or the whole
// `features` object) resolves to false — so adding new features to the engine never
// turns anything on for existing sites; they stay hidden until a site opts in.
export interface StommeFeatures {
  blog?: boolean; // posts collection + /<blog> routes + postList block
  areas?: boolean; // towns collection + /<towns> routes + linkChips block
  services?: boolean; // services collection + /<services> routes + serviceGrid block
  testimonials?: boolean; // testimonials collection + testimonials block
  faq?: boolean; // faq collection + faq block
}
export const FEATURE_DEFAULTS: Required<StommeFeatures> = {
  blog: false,
  areas: false,
  services: false,
  testimonials: false,
  faq: false,
};
// Resolve a site's flags over the all-false defaults. Unknown keys are ignored;
// known-but-omitted keys are false.
export function resolveFeatures(f?: StommeFeatures): Required<StommeFeatures> {
  return { ...FEATURE_DEFAULTS, ...(f || {}) };
}

// A content listing: a collection with an index + detail pages, instantiated from
// config so several can coexist (news, for-sale, …) without bespoke engine features.
// `preset` picks the schema + presentation: `article` (date/excerpt/cover — blog & news)
// or `catalog` (price/status/specs/gallery — for-sale of anything). The engine adds a
// collection per listing, a CMS editor, a seeded editable index page, and detail routes.
export interface Listing {
  id: string; // collection name + content folder (src/content/<id>)
  route: string; // index + detail route base, e.g. '/till-salu'
  label: string; // CMS collection + nav label
  preset: 'article' | 'catalog';
  options?: { columns?: number; showImages?: boolean; featured?: boolean; filters?: boolean };
}
// Normalize: drop entries missing an id/route/preset; default the route slash.
export function resolveListings(l?: Listing[]): Listing[] {
  return (Array.isArray(l) ? l : [])
    .filter((x) => x && x.id && x.route && (x.preset === 'article' || x.preset === 'catalog'))
    .map((x) => ({ ...x, route: x.route.startsWith('/') ? x.route : `/${x.route}` }));
}

export const KIT_DEFAULTS = {
  routes: { services: '/services', towns: '/areas', blog: '/blog', contact: '/contact', formSuccess: '/thanks' },
  locale: 'en-US',
  cmsLocale: 'en',
  strings: {
    readMore: 'Read more',
    town: {
      eyebrow: 'Local service: {name}',
      heading: '{name}',
      cta: 'Get a quote',
      whyHeading: 'Why choose us in {name}?',
      problemsHeading: 'Common problems we solve',
      districtsHeading: 'Where we work in {name}',
      caseHeading: 'Local case',
      reasons: [] as { title: string; body: string }[],
      servicesHeading: 'Our services in {name}',
      servicesCta: 'Contact us today',
    },
    service: { eyebrow: 'Service', quoteEyebrow: 'Free quote', quoteHeading: 'Want to know what it costs?', cta: 'Get a quote' },
    listingStatus: { available: 'Available', reserved: 'Reserved', sold: 'Sold', all: 'All' },
    listingCta: 'Contact us',
  },
};

export function resolveKit(c?: KitConfig) {
  const s = c && c.strings;
  return {
    routes: { ...KIT_DEFAULTS.routes, ...(c && c.routes) },
    locale: (c && c.locale) || KIT_DEFAULTS.locale,
    cmsLocale: (c && c.cmsLocale) || KIT_DEFAULTS.cmsLocale,
    strings: {
      ...KIT_DEFAULTS.strings,
      ...s,
      // Deep-merge the nested string groups so a site can override one key
      // without having to re-supply the whole group.
      contact: { ...(s && s.contact) },
      town: { ...KIT_DEFAULTS.strings.town, ...(s && s.town) },
      service: { ...KIT_DEFAULTS.strings.service, ...(s && s.service) },
      listingStatus: { ...KIT_DEFAULTS.strings.listingStatus, ...(s && s.listingStatus) },
      listingCta: (s && s.listingCta) || KIT_DEFAULTS.strings.listingCta,
    },
  };
}
