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
  // Optional look & feel: the name of a theme directory supplied at build time. When set,
  // the engine splices that theme's tokens.css + theme.css into the site's global.css
  // (after the engine stylesheet import, before the site's own rules) and — via stomme-gen —
  // into the CMS preview stylesheet, and seeds the theme colours once. The theme directory is
  // found under STOMME_THEMES_DIR or a themes checkout beside the engine. Unset ⇒ no theme
  // layer is added and the build is unchanged.
  style?: string;
  // Operator-owned analytics — lives in code (site.config.ts), NOT in CMS content, so an
  // editor can't disable it (Decap rewrites managed files on save and would drop it).
  // cfToken = Cloudflare Web Analytics beacon token: cookieless, no consent banner needed.
  analytics?: { cfToken?: string };
  cmsLocale?: string; // Decap admin UI language (e.g. 'en', 'sv'); written to config.yml by stomme-gen
  strings?: {
    readMore?: string;
    latest?: string; // "Latest" tag on the featured post
    contact?: { name?: string; email?: string; phone?: string; message?: string; submit?: string; direct?: string; honeypot?: string };
    beforeAfter?: { before?: string; after?: string };
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
      ctaEyebrow?: string; // closing CTA band
      ctaHeading?: string; // closing CTA heading; `{name}` interpolated
    };
    // ServicePage chrome.
    service?: { eyebrow?: string; quoteEyebrow?: string; quoteHeading?: string; cta?: string };
    // Catalog listing chrome (for-sale presentation).
    listingStatus?: { available?: string; reserved?: string; sold?: string; all?: string };
    listingCta?: string;
  };
  // Config-defined listings, forwarded to blocks via the `site` prop so catalog blocks
  // can resolve their specs without importing the integration's config alias. A site
  // that uses listings passes them in (e.g. `config={{ ...site, listings }}`).
  listings?: Listing[];
  // CMS auth/backend for the generated Decap config.yml. stomme-gen emits the
  // `backend:` block from this (between the `# >>> cms:generated` markers) so a
  // site picks its backend without hand-editing config.yml. Generic across
  // github / git-gateway (Netlify Identity, DecapBridge, a custom OAuth proxy).
  cms?: {
    backend?: string; // 'github' | 'git-gateway' | 'gitlab'
    repo?: string; // 'owner/name' (github/gitlab)
    branch?: string; // default 'main'
    baseUrl?: string; // OAuth base / proxy origin (github backend, custom OAuth)
    authEndpoint?: string; // OAuth path under baseUrl (e.g. 'auth')
    apiRoot?: string; // git provider API root (a proxy that injects the server token)
    gatewayUrl?: string; // git-gateway gateway URL (DecapBridge / self-hosted)
    identityUrl?: string; // git-gateway identity URL (DecapBridge / GoTrue)
  };
  // The public contact-form gateway — a thin edge Worker (spam-gate + rate limit) that
  // hands off to the control plane (which stores + sends). Kept separate from `cms`: the CMS proxy
  // moved to the control plane, but the form endpoint stays at the edge for portability. When unset,
  // ContactForm falls back to cms.baseUrl (legacy, pre-consolidation sites).
  contact?: {
    endpoint?: string; // form worker origin, e.g. 'https://forms.gronare.se'
  };
}

// Optional capabilities a site can switch on. A flag that's missing (or the whole
// `features` object) resolves to false — so adding new features to the engine never
// turns anything on for existing sites; they stay hidden until a site opts in.
// The one exception is `contactForm` (see FEATURE_DEFAULTS below).
export interface StommeFeatures {
  blog?: boolean; // posts collection + /<blog> routes + postList block
  areas?: boolean; // towns collection + /<towns> routes + linkChips block
  services?: boolean; // services collection + /<services> routes + serviceGrid block
  testimonials?: boolean; // testimonials collection + testimonials block
  faq?: boolean; // faq collection + faq block
  tracking?: boolean; // analytics (GTM/GA4/Meta) + cookie-consent banner + the Tracking settings pane
  // DELIBERATE exception to the all-false convention: a contact form is on by DEFAULT.
  // Existing sites that never set this keep their form (rule zero). Set it to `false`
  // to remove the contactForm block from the site. Gated in BlockRenderer.
  contactForm?: boolean;
}
export const FEATURE_DEFAULTS: Required<StommeFeatures> = {
  blog: false,
  areas: false,
  services: false,
  testimonials: false,
  faq: false,
  tracking: false,
  // ON by default — a site without the flag keeps its contact form; false removes it.
  contactForm: true,
};
// Resolve a site's flags over the defaults (all false except contactForm, which is on).
// Unknown keys are ignored; known-but-omitted keys fall back to their default.
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

// Per-language site-string defaults. English is the base; other locales override only
// the keys they translate (anything omitted falls back to English). A site's
// `config.strings` still overrides all of this. Contact labels mirror ContactForm.astro's
// own English fallbacks, so English sites are unaffected.
const STRINGS_EN = {
  readMore: 'Read more',
  latest: 'Latest',
  contact: { name: 'Name', email: 'Email', phone: 'Phone', message: 'Describe your project', submit: 'Send request', direct: 'Direct contact', honeypot: 'Leave this field empty' },
  beforeAfter: { before: 'Before', after: 'After' },
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
    ctaEyebrow: 'Free quote',
    ctaHeading: 'Get a quote in {name}',
  },
  service: { eyebrow: 'Service', quoteEyebrow: 'Free quote', quoteHeading: 'Want to know what it costs?', cta: 'Get a quote' },
  listingStatus: { available: 'Available', reserved: 'Reserved', sold: 'Sold', all: 'All' },
  listingCta: 'Contact us',
  // Contact-form confirmation (inline "what you sent" + the /thanks page). {name} → ", Carl" or "".
  thanks: {
    eyebrow: 'Message sent',
    heading: "Thanks{name} — it's on its way.",
    lead: "We've got your message and we'll reply within one business day.",
    recapLabel: 'What you sent',
    talkLabel: 'Prefer to talk?',
    home: 'Back to home',
    to: 'to',
    from: 'from',
  },
  // 404 page (engine-injected /404 route).
  notFound: {
    title: 'Page not found',
    heading: 'Page not found',
    lead: "The page you're looking for doesn't exist or may have moved.",
    home: 'Back to home',
  },
  // Cookie-consent banner (only shown when tracking is enabled).
  consent: {
    text: 'We use cookies for statistics and to improve the site.',
    accept: 'Accept',
    decline: 'Decline',
    more: 'Read more',
    settings: 'Cookie settings',
  },
};

const STRINGS_SV: typeof STRINGS_EN = {
  readMore: 'Läs mer',
  latest: 'Senaste',
  contact: { name: 'Namn', email: 'E-post', phone: 'Telefon', message: 'Beskriv ditt projekt', submit: 'Skicka förfrågan', direct: 'Direktkontakt', honeypot: 'Lämna fältet tomt' },
  beforeAfter: { before: 'Före', after: 'Efter' },
  town: {
    eyebrow: 'Lokal tjänst: {name}',
    heading: '{name}',
    cta: 'Begär offert',
    whyHeading: 'Varför välja oss i {name}?',
    problemsHeading: 'Vanliga problem vi löser',
    districtsHeading: 'Var vi arbetar i {name}',
    caseHeading: 'Lokalt exempel',
    reasons: [],
    servicesHeading: 'Våra tjänster i {name}',
    servicesCta: 'Kontakta oss idag',
    ctaEyebrow: 'Kostnadsfri offert',
    ctaHeading: 'Begär offert i {name}',
  },
  service: { eyebrow: 'Tjänst', quoteEyebrow: 'Kostnadsfri offert', quoteHeading: 'Vill du veta vad det kostar?', cta: 'Begär offert' },
  listingStatus: { available: 'Tillgänglig', reserved: 'Reserverad', sold: 'Såld', all: 'Alla' },
  listingCta: 'Kontakta oss',
  thanks: {
    eyebrow: 'Skickat',
    heading: 'Tack{name} — meddelandet är på väg.',
    lead: 'Vi har fått ditt meddelande och svarar inom en arbetsdag.',
    recapLabel: 'Det du skickade',
    talkLabel: 'Hellre prata?',
    home: 'Till startsidan',
    to: 'till',
    from: 'från',
  },
  notFound: {
    title: 'Sidan hittades inte',
    heading: 'Sidan hittades inte',
    lead: 'Sidan du letar efter finns inte eller kan ha flyttats.',
    home: 'Till startsidan',
  },
  consent: {
    text: 'Vi använder cookies för statistik och för att förbättra sajten.',
    accept: 'Acceptera',
    decline: 'Avböj',
    more: 'Läs mer',
    settings: 'Cookie-inställningar',
  },
};

const STRINGS_BY_LANG: Record<string, typeof STRINGS_EN> = { en: STRINGS_EN, sv: STRINGS_SV };

// Pick the base string set for the SITE language. Driven by `locale` (the site's BCP47
// language/region, e.g. sv-SE) — NOT cmsLocale, which is only the Decap admin UI language.
// cmsLocale is just a fallback for older configs that set it but no locale.
function baseStrings(locale?: string, cmsLocale?: string) {
  const lang = String(locale || cmsLocale || 'en').split(/[-_]/)[0].toLowerCase();
  const b = STRINGS_BY_LANG[lang] || STRINGS_EN;
  return {
    ...STRINGS_EN, ...b,
    contact: { ...STRINGS_EN.contact, ...b.contact },
    town: { ...STRINGS_EN.town, ...b.town },
    service: { ...STRINGS_EN.service, ...b.service },
    listingStatus: { ...STRINGS_EN.listingStatus, ...b.listingStatus },
    thanks: { ...STRINGS_EN.thanks, ...b.thanks },
    notFound: { ...STRINGS_EN.notFound, ...b.notFound },
    consent: { ...STRINGS_EN.consent, ...b.consent },
  };
}

export const SITE_DEFAULTS = {
  routes: { services: '/services', towns: '/areas', blog: '/blog', contact: '/contact', formSuccess: '/thanks' },
  locale: 'en-US',
  cmsLocale: 'en',
  strings: STRINGS_EN,
};

export function resolveSite(c?: SiteConfig) {
  const s = c && c.strings;
  const base = baseStrings(c && c.locale, c && c.cmsLocale);
  return {
    routes: { ...SITE_DEFAULTS.routes, ...(c && c.routes) },
    locale: (c && c.locale) || SITE_DEFAULTS.locale,
    cmsLocale: (c && c.cmsLocale) || SITE_DEFAULTS.cmsLocale,
    strings: {
      ...base,
      ...s,
      // Deep-merge the nested string groups so a site can override one key
      // without having to re-supply the whole group.
      contact: { ...base.contact, ...(s && s.contact) },
      town: { ...base.town, ...(s && s.town) },
      service: { ...base.service, ...(s && s.service) },
      listingStatus: { ...base.listingStatus, ...(s && s.listingStatus) },
      listingCta: (s && s.listingCta) || base.listingCta,
      thanks: { ...base.thanks, ...((s && (s as any).thanks) || {}) },
      notFound: { ...base.notFound, ...((s && (s as any).notFound) || {}) },
      consent: { ...base.consent, ...((s && (s as any).consent) || {}) },
    },
    listings: resolveListings(c && c.listings),
    cms: c && c.cms, // forwarded so blocks (e.g. ContactForm) can reach the gateway baseUrl
    contact: c && c.contact, // forwarded so ContactForm posts to the dedicated form worker
  };
}
