export interface SiteConfig {
  // Canonical absolute site URL — drives Astro.site, so og:image/og:url/canonical/sitemap are absolute; the site's astro.config falls back to SITE_URL then its own host.
  url?: string;
  // A site's public URLs are its own content: every route is per-site and localizable, read by the blocks, the integration's detail-route injection and the CMS generator.
  routes?: {
    services?: string; // serviceGrid + ServicePage detail-page prefix
    towns?: string; // linkChips + TownPage detail-page prefix
    blog?: string; // postList detail-page prefix
    contact?: string; // contact page (town/service CTAs link here)
    formSuccess?: string; // contactForm success page
    // Unknown keys pass through so an out-of-tree extension can route its own pages on a path the engine never names; the whole map reaches the addon manifests.
    [key: string]: string | undefined;
  };
  // Path prefixes served normally but marked noindex — a link someone already holds keeps working while search engines are told to leave it alone.
  noindex?: string[];
  // BCP47 language + region. Drives date/number formatting and which built-in wording is used ('sv' and 'en' shipped, else English); `strings` overrides individual phrases.
  locale?: string;
  // Theme directory name, resolved at build from STOMME_THEMES_DIR. Unset means no theme layer; a name whose theme.css is missing fails the build rather than shipping unstyled.
  style?: string;
  // Lives in code, not CMS content: the CMS rewrites managed files on save and would drop it. cfToken is the cookieless Cloudflare beacon, so no consent banner is needed.
  analytics?: { cfToken?: string };
  // Language of the /admin field labels only — baked into config.yml by stomme-gen, so re-run it after changing. The public site follows `locale`.
  cmsLocale?: string;
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
    service?: { eyebrow?: string; quoteEyebrow?: string; quoteHeading?: string; cta?: string };
    listingStatus?: { available?: string; reserved?: string; sold?: string; all?: string };
    listingCta?: string;
  };
  // Forwarded to blocks via the `site` prop so a catalog block resolves its specs without reaching for the integration's config alias.
  listings?: Listing[];
  // stomme-gen emits the `backend:` block from this between the cms:generated markers, so a site picks its backend without hand-editing config.yml.
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
  // The contact-form edge Worker. Separate from `cms` on purpose: the CMS proxy moved to the caller, the form endpoint stayed at the edge. Unset falls back to cms.baseUrl.
  contact?: {
    endpoint?: string; // form worker origin, e.g. 'https://example.com'
  };
}

// A missing flag — or a missing `features` object — resolves to false, so a new engine feature never turns itself on for an existing site. contactForm and pages are the two deliberate exceptions.
export interface StommeFeatures {
  blog?: boolean; // posts collection + /<blog> routes + postList block
  areas?: boolean; // towns collection + /<towns> routes + linkChips block
  services?: boolean; // services collection + /<services> routes + serviceGrid block
  testimonials?: boolean; // testimonials collection + testimonials block
  faq?: boolean; // faq collection + faq block
  tracking?: boolean; // analytics (GTM/GA4/Meta) + cookie-consent banner + the Tracking settings pane
  // Deliberate exception: on by DEFAULT, so a site that never set it keeps its form. Gated in BlockRenderer.
  contactForm?: boolean;
  // Deliberate exception: on by DEFAULT — the collection predates feature flags, and absent-means-off would orphan existing page content. Gated in the config generator.
  pages?: boolean;
  // A flag the engine does not name type-checks here and passes through resolveFeatures untouched, so a site can gate an extension's own collection without the engine knowing it.
  [flag: string]: boolean | undefined;
}
export const FEATURE_DEFAULTS: Required<StommeFeatures> = {
  blog: false,
  areas: false,
  services: false,
  testimonials: false,
  faq: false,
  tracking: false,
  contactForm: true,
  pages: true,
};
export function resolveFeatures(f?: StommeFeatures): Required<StommeFeatures> {
  return { ...FEATURE_DEFAULTS, ...(f || {}) };
}

// A bare string spec keys off its position (spec_0, spec_1…), so renaming a label never orphans stored data — but REORDERING does. Give an explicit key to be safe.
export type SpecInput = string | { key?: string; label: string };
export interface SpecDef { key: string; label: string }
export function resolveSpecs(specs?: SpecInput[]): SpecDef[] {
  return (Array.isArray(specs) ? specs : []).map((s, i) =>
    typeof s === 'string' ? { key: `spec_${i}`, label: s } : { key: s.key || `spec_${i}`, label: s.label });
}
export function listingSpecRows(entryData: any, listing?: { specs?: SpecDef[] }): { label: string; value: string }[] {
  const vals = (entryData && entryData.specs) || {};
  return (listing?.specs || [])
    .map(({ key, label }) => ({ label, value: vals[key] }))
    .filter((r) => r.value);
}

// A collection with an index + detail pages, instantiated from config so several can coexist without bespoke engine features. `preset` picks both schema and presentation.
export interface Listing {
  id: string; // collection name + content folder (src/content/<id>)
  route: string; // index + detail route base, e.g. '/for-sale'
  label: string; // CMS collection + nav label
  preset: 'article' | 'catalog';
  specs?: SpecInput[]; // catalog: the spec fields every item shares (config-defined, consistent)
  options?: { columns?: number; showImages?: boolean; featured?: boolean; filters?: boolean };
}
export function resolveListings(l?: Listing[]): (Omit<Listing, 'specs'> & { specs: SpecDef[] })[] {
  return (Array.isArray(l) ? l : [])
    .filter((x) => x && x.id && x.route && (x.preset === 'article' || x.preset === 'catalog'))
    .map((x) => ({ ...x, route: x.route.startsWith('/') ? x.route : `/${x.route}`, specs: resolveSpecs(x.specs) }));
}

// English is the base; another locale overrides only the keys it translates, and a site's own `config.strings` overrides all of it.
const STRINGS_EN = {
  readMore: 'Read more',
  latest: 'Latest',
  contact: { name: 'Name', email: 'Email', phone: 'Phone', message: 'Describe your project', submit: 'Send request', direct: 'Direct contact', honeypot: 'Leave this field empty', hours: 'Opening hours', visit: 'Visit' },
  beforeAfter: { before: 'Before', after: 'After' },
  town: {
    eyebrow: 'Local service: {name}',
    heading: '{name}',
    cta: 'Get a quote',
    whyHeading: 'Why choose us in {name}?',
    problemsHeading: 'Common problems we solve',
    districtsHeading: 'Where we work in {name}',
    caseHeading: 'Local case',
    fieldNote: 'Field note',
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
  contact: { name: 'Namn', email: 'E-post', phone: 'Telefon', message: 'Beskriv ditt projekt', submit: 'Skicka förfrågan', direct: 'Direktkontakt', honeypot: 'Lämna fältet tomt', hours: 'Öppettider', visit: 'Hitta hit' },
  beforeAfter: { before: 'Före', after: 'Efter' },
  town: {
    eyebrow: 'Lokal tjänst: {name}',
    heading: '{name}',
    cta: 'Begär offert',
    whyHeading: 'Varför välja oss i {name}?',
    problemsHeading: 'Vanliga problem vi löser',
    districtsHeading: 'Var vi arbetar i {name}',
    caseHeading: 'Lokalt exempel',
    fieldNote: 'Fältnotis',
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

// Driven by `locale`, NOT cmsLocale — cmsLocale only picks the /admin label language, and is read here purely as a fallback for older configs that set it without a locale.
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

// Prefix match on WHOLE segments: '/book' covers '/book/anything' but never '/booking'.
export function isUnlisted(pathname: string, noindex?: string[]): boolean {
  const path = String(pathname || '');
  return (noindex ?? []).some((raw) => {
    const prefix = String(raw || '').trim().replace(/\/+$/, '');
    return prefix !== '' && (path === prefix || path.startsWith(`${prefix}/`));
  });
}

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
