// Per-site configuration for the library blocks: where collection pages live,
// how dates format, and a few fixed strings. A site passes this to BlockRenderer
// (`<BlockRenderer config={...}>`), which forwards it to every block as `site`.
// The TownPage/ServicePage templates take the same `site`.
// Defaults are neutral English; override only what differs.
export interface SiteConfig {
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
// A catalog spec field: a label (in the site's language) + a stable key the entry data
// is stored under. A bare string is shorthand — the key defaults to its position
// (`spec_0`, `spec_1`, …) so renaming a label (e.g. to localize) never orphans the data;
// only reordering would. Give an explicit `key` for a readable key in the content files.
export type SpecInput = string | { key?: string; label: string };
export interface SpecDef { key: string; label: string }
export function resolveSpecs(specs?: SpecInput[]): SpecDef[] {
  return (Array.isArray(specs) ? specs : []).map((s, i) =>
    typeof s === 'string' ? { key: `spec_${i}`, label: s } : { key: s.key || `spec_${i}`, label: s.label });
}
// The {label, value} rows to render for a catalog entry: the listing's configured specs,
// paired with the entry's keyed values; empty values are dropped.
export function listingSpecRows(entryData: any, listing?: { specs?: SpecDef[] }): { label: string; value: string }[] {
  const vals = (entryData && entryData.specs) || {};
  return (listing?.specs || [])
    .map(({ key, label }) => ({ label, value: vals[key] }))
    .filter((r) => r.value);
}

export interface Listing {
  id: string; // collection name + content folder (src/content/<id>)
  route: string; // index + detail route base, e.g. '/till-salu'
  label: string; // CMS collection + nav label
  preset: 'article' | 'catalog';
  specs?: SpecInput[]; // catalog: the spec fields every item shares (config-defined, consistent)
  options?: { columns?: number; showImages?: boolean; featured?: boolean; filters?: boolean };
}
// Normalize: drop entries missing an id/route/preset; default the route slash; resolve specs.
export function resolveListings(l?: Listing[]): (Omit<Listing, 'specs'> & { specs: SpecDef[] })[] {
  return (Array.isArray(l) ? l : [])
    .filter((x) => x && x.id && x.route && (x.preset === 'article' || x.preset === 'catalog'))
    .map((x) => ({ ...x, route: x.route.startsWith('/') ? x.route : `/${x.route}`, specs: resolveSpecs(x.specs) }));
}

export const SITE_DEFAULTS = {
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

export function resolveSite(c?: SiteConfig) {
  const s = c && c.strings;
  return {
    routes: { ...SITE_DEFAULTS.routes, ...(c && c.routes) },
    locale: (c && c.locale) || SITE_DEFAULTS.locale,
    cmsLocale: (c && c.cmsLocale) || SITE_DEFAULTS.cmsLocale,
    strings: {
      ...SITE_DEFAULTS.strings,
      ...s,
      // Deep-merge the nested string groups so a site can override one key
      // without having to re-supply the whole group.
      contact: { ...(s && s.contact) },
      town: { ...SITE_DEFAULTS.strings.town, ...(s && s.town) },
      service: { ...SITE_DEFAULTS.strings.service, ...(s && s.service) },
      listingStatus: { ...SITE_DEFAULTS.strings.listingStatus, ...(s && s.listingStatus) },
      listingCta: (s && s.listingCta) || SITE_DEFAULTS.strings.listingCta,
    },
  };
}
