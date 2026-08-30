export interface SiteConfig {
  url?: string;
  routes?: {
    services?: string;
    towns?: string;
    blog?: string;
    contact?: string;
    formSuccess?: string;
    [key: string]: string | undefined;
  };
  noindex?: string[];
  locale?: string;
  // Content locales, default first. Fewer than two turns the whole i18n layer off — no locale routes, no hreflang, no switcher, and the CMS gets no i18n declaration.
  locales?: string[];
  localeTags?: Record<string, string>;
  style?: string;
  analytics?: { cfToken?: string };
  maps?: { provider?: 'google' | 'osm'; key?: string };
  metrics?: { endpoint?: string };
  cmsLocale?: string;
  strings?: {
    readMore?: string;
    latest?: string;
    changeLanguage?: string;
    contact?: { name?: string; email?: string; phone?: string; message?: string; submit?: string; direct?: string; honeypot?: string; hours?: string; visit?: string; findUs?: string; follow?: string; map?: string; reveal?: string; error?: string };
    beforeAfter?: { before?: string; after?: string; compare?: string };
    collage?: { more?: string; more1?: string; open?: string; viewer?: string; prev?: string; next?: string; close?: string; counter?: string };
    map?: {
      google?: string; apple?: string;
      embed?: string; embedNote?: string; embedLoading?: string; embedTitle?: string;
      embedOsm?: string; embedNoteOsm?: string; embedLoadingOsm?: string; embedTitleOsm?: string;
    };
    footer?: { links?: string; areas?: string };
    documents?: { separator?: string; file?: string };
    town?: {
      eyebrow?: string;
      heading?: string;
      cta?: string;
      whyHeading?: string;
      problemsHeading?: string;
      districtsHeading?: string;
      caseHeading?: string;
      reasons?: { title: string; body: string }[];
      servicesHeading?: string;
      servicesCta?: string;
      ctaEyebrow?: string;
      ctaHeading?: string;
    };
    service?: { eyebrow?: string; quoteEyebrow?: string; quoteHeading?: string; cta?: string };
    listingStatus?: { available?: string; reserved?: string; sold?: string; all?: string };
    listingCta?: string;
  };
  listings?: Listing[];
  cms?: {
    backend?: string;
    repo?: string;
    branch?: string;
    baseUrl?: string;
    authEndpoint?: string;
    apiRoot?: string;
    gatewayUrl?: string;
    identityUrl?: string;
  };
  contact?: {
    endpoint?: string;
  };
  media?: MediaConfig;
}

// Where Sveltia keeps uploads. `git` commits them under public/media. `r2` adds Sveltia's own Cloudflare R2 library: uploads go straight from the browser to the bucket and content holds absolute URLs under publicUrl. `maxFileSize` (bytes) makes Sveltia refuse a larger upload in the browser; unset means no cap. A `pointers` key is tolerated and ignored, so older site configs keep parsing.
export type MediaConfig =
  | { storage?: 'git'; pointers?: boolean; maxFileSize?: number }
  | { storage: 'r2'; accountId: string; bucket: string; accessKeyId: string; publicUrl: string; prefix?: string; jurisdiction?: 'default' | 'eu' | 'fedramp'; maxFileSize?: number };

// A missing flag — or a missing `features` object — resolves to false, so a new engine feature never turns itself on for an existing site. contactForm and pages are the two deliberate exceptions.
export interface StommeFeatures {
  blog?: boolean;
  areas?: boolean;
  services?: boolean;
  testimonials?: boolean;
  faq?: boolean;
  documents?: boolean;
  tracking?: boolean;
  contactForm?: boolean;
  pages?: boolean;
  [flag: string]: boolean | undefined;
}
export const FEATURE_DEFAULTS: Required<StommeFeatures> = {
  blog: false,
  areas: false,
  services: false,
  testimonials: false,
  faq: false,
  documents: false,
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

export interface Listing {
  id: string;
  route: string;
  label: string;
  preset: 'article' | 'catalog';
  specs?: SpecInput[];
  options?: { columns?: number; showImages?: boolean; featured?: boolean; filters?: boolean };
}
export function resolveListings(l?: Listing[]): (Omit<Listing, 'specs'> & { specs: SpecDef[] })[] {
  return (Array.isArray(l) ? l : [])
    .filter((x) => x && x.id && x.route && (x.preset === 'article' || x.preset === 'catalog'))
    .map((x) => ({ ...x, route: x.route.startsWith('/') ? x.route : `/${x.route}`, specs: resolveSpecs(x.specs) }));
}

const STRINGS_EN = {
  readMore: 'Read more',
  latest: 'Latest',
  changeLanguage: 'Change language',
  contact: {
    name: 'Name', email: 'Email', phone: 'Phone', message: 'Describe your project', submit: 'Send request',
    direct: 'Direct contact', honeypot: 'Leave this field empty', hours: 'Opening hours', visit: 'Visit',
    findUs: 'Find us', follow: 'Follow', map: 'Map',
    reveal: 'Contact details — enable JavaScript to reveal',
    error: 'Sorry — could not send. Please try again or email us directly.',
  },
  beforeAfter: { before: 'Before', after: 'After', compare: 'Drag to compare before and after' },
  collage: {
    more: '+{n} images', more1: '+1 image', open: 'Open the image viewer', viewer: 'Image viewer',
    prev: 'Previous image', next: 'Next image', close: 'Close', counter: '{i} of {n}',
  },
  map: {
    google: 'Directions in Google Maps', apple: 'Directions in Apple Maps',
    embed: 'Show interactive map', embedNote: 'Loads from Google when you click',
    embedLoading: 'Loading the map from Google',
    embedTitle: 'Google map of {address}',
    embedOsm: 'Show interactive map', embedNoteOsm: 'Loads from OpenStreetMap when you click',
    embedLoadingOsm: 'Loading the map from OpenStreetMap',
    embedTitleOsm: 'OpenStreetMap map of {address}',
  },
  footer: { links: 'Links', areas: 'Areas' },
  documents: { separator: '·', file: 'FILE' },
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
  changeLanguage: 'Byt språk',
  contact: {
    name: 'Namn', email: 'E-post', phone: 'Telefon', message: 'Beskriv ditt projekt', submit: 'Skicka förfrågan',
    direct: 'Direktkontakt', honeypot: 'Lämna fältet tomt', hours: 'Öppettider', visit: 'Hitta hit',
    findUs: 'Hitta hit', follow: 'Följ oss', map: 'Karta',
    reveal: 'Kontaktuppgifter, aktivera JavaScript för att visa dem',
    error: 'Det gick inte att skicka. Försök igen eller mejla oss direkt.',
  },
  beforeAfter: { before: 'Före', after: 'Efter', compare: 'Dra för att jämföra före och efter' },
  collage: {
    more: '+{n} bilder', more1: '+1 bild', open: 'Öppna bildvisaren', viewer: 'Bildvisare',
    prev: 'Föregående bild', next: 'Nästa bild', close: 'Stäng', counter: '{i} av {n}',
  },
  map: {
    google: 'Vägbeskrivning i Google Maps', apple: 'Vägbeskrivning i Apple Kartor',
    embed: 'Visa interaktiv karta', embedNote: 'Laddas från Google när du klickar',
    embedLoading: 'Laddar kartan från Google',
    embedTitle: 'Google-karta över {address}',
    embedOsm: 'Visa interaktiv karta', embedNoteOsm: 'Laddas från OpenStreetMap när du klickar',
    embedLoadingOsm: 'Laddar kartan från OpenStreetMap',
    embedTitleOsm: 'OpenStreetMap-karta över {address}',
  },
  footer: { links: 'Länkar', areas: 'Områden' },
  documents: { separator: '·', file: 'FIL' },
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

const STRINGS_NO: typeof STRINGS_EN = {
  readMore: 'Les mer',
  latest: 'Siste',
  changeLanguage: 'Bytt språk',
  contact: {
    name: 'Navn', email: 'E-post', phone: 'Telefon', message: 'Beskriv prosjektet ditt', submit: 'Send forespørsel',
    direct: 'Direktekontakt', honeypot: 'La feltet stå tomt', hours: 'Åpningstider', visit: 'Finn fram',
    findUs: 'Finn fram', follow: 'Følg oss', map: 'Kart',
    reveal: 'Kontaktopplysninger, slå på JavaScript for å vise dem',
    error: 'Det gikk ikke å sende. Prøv igjen, eller send oss en e-post direkte.',
  },
  beforeAfter: { before: 'Før', after: 'Etter', compare: 'Dra for å sammenligne før og etter' },
  collage: {
    more: '+{n} bilder', more1: '+1 bilde', open: 'Åpne bildeviseren', viewer: 'Bildeviser',
    prev: 'Forrige bilde', next: 'Neste bilde', close: 'Lukk', counter: '{i} av {n}',
  },
  map: {
    google: 'Veibeskrivelse i Google Maps', apple: 'Veibeskrivelse i Apple Kart',
    embed: 'Vis interaktivt kart', embedNote: 'Lastes fra Google når du klikker',
    embedLoading: 'Laster kartet fra Google',
    embedOsm: 'Vis interaktivt kart', embedNoteOsm: 'Lastes fra OpenStreetMap når du klikker',
    embedLoadingOsm: 'Laster kartet fra OpenStreetMap',
    embedTitle: 'Google-kart over {address}',
    embedTitleOsm: 'OpenStreetMap-kart over {address}',
  },
  footer: { links: 'Lenker', areas: 'Områder' },
  documents: { separator: '·', file: 'FIL' },
  town: {
    eyebrow: 'Lokal tjeneste: {name}',
    heading: '{name}',
    cta: 'Be om tilbud',
    whyHeading: 'Hvorfor velge oss i {name}?',
    problemsHeading: 'Vanlige problemer vi løser',
    districtsHeading: 'Hvor vi jobber i {name}',
    caseHeading: 'Lokalt eksempel',
    fieldNote: 'Feltnotat',
    reasons: [],
    servicesHeading: 'Våre tjenester i {name}',
    servicesCta: 'Ta kontakt i dag',
    ctaEyebrow: 'Gratis tilbud',
    ctaHeading: 'Be om tilbud i {name}',
  },
  service: { eyebrow: 'Tjeneste', quoteEyebrow: 'Gratis tilbud', quoteHeading: 'Vil du vite hva det koster?', cta: 'Be om tilbud' },
  listingStatus: { available: 'Tilgjengelig', reserved: 'Reservert', sold: 'Solgt', all: 'Alle' },
  listingCta: 'Ta kontakt',
  thanks: {
    eyebrow: 'Sendt',
    heading: 'Takk{name} — meldingen er på vei.',
    lead: 'Vi har fått meldingen din og svarer innen én virkedag.',
    recapLabel: 'Det du sendte',
    talkLabel: 'Heller snakke?',
    home: 'Til forsiden',
    to: 'til',
    from: 'fra',
  },
  notFound: {
    title: 'Fant ikke siden',
    heading: 'Fant ikke siden',
    lead: 'Siden du leter etter finnes ikke, eller den kan ha blitt flyttet.',
    home: 'Til forsiden',
  },
  consent: {
    text: 'Vi bruker informasjonskapsler til statistikk og for å gjøre nettstedet bedre.',
    accept: 'Godta',
    decline: 'Avslå',
    more: 'Les mer',
    settings: 'Innstillinger for informasjonskapsler',
  },
};

const STRINGS_BY_LANG: Record<string, typeof STRINGS_EN> = { en: STRINGS_EN, sv: STRINGS_SV, no: STRINGS_NO, nb: STRINGS_NO, nn: STRINGS_NO };

function baseStrings(locale?: string, cmsLocale?: string) {
  const lang = String(locale || cmsLocale || 'en').split(/[-_]/)[0].toLowerCase();
  const b = STRINGS_BY_LANG[lang] || STRINGS_EN;
  return {
    ...STRINGS_EN, ...b,
    contact: { ...STRINGS_EN.contact, ...b.contact },
    beforeAfter: { ...STRINGS_EN.beforeAfter, ...b.beforeAfter },
    collage: { ...STRINGS_EN.collage, ...b.collage },
    map: { ...STRINGS_EN.map, ...b.map },
    footer: { ...STRINGS_EN.footer, ...b.footer },
    documents: { ...STRINGS_EN.documents, ...b.documents },
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

export function isUnlisted(pathname: string, noindex?: string[]): boolean {
  const path = String(pathname || '');
  return (noindex ?? []).some((raw) => {
    const prefix = String(raw || '').trim().replace(/\/+$/, '');
    return prefix !== '' && (path === prefix || path.startsWith(`${prefix}/`));
  });
}

const DEMO_HOST_SUFFIXES = ['.pages.dev', '.workers.dev'];

export function demoHost(hostname?: string): boolean {
  const h = String(hostname || '');
  return DEMO_HOST_SUFFIXES.some((s) => h.endsWith(s));
}

// '' when the site's own address is a demo host: a demo has no real domain to send anyone to, and bouncing it to itself would loop.
export function canonicalBounceHost(siteUrl?: string | URL): string {
  let host = '';
  try { host = new URL(String(siteUrl || '')).hostname; } catch { return ''; }
  return !host || demoHost(host) ? '' : host;
}

// `locale` renders the chrome in another language than the site's own: the site's `strings` overrides are written in the default language, so they are dropped whenever the requested language is not that one.
export function resolveSite(c?: SiteConfig, locale?: string) {
  const lang = (t?: string) => String(t || '').split(/[-_]/)[0].toLowerCase();
  const own = lang((c && c.locale) || (c && c.cmsLocale) || SITE_DEFAULTS.locale);
  const s = !locale || lang(locale) === own ? c && c.strings : undefined;
  const base = baseStrings(locale || (c && c.locale), c && c.cmsLocale);
  return {
    routes: { ...SITE_DEFAULTS.routes, ...(c && c.routes) },
    locale: locale || (c && c.locale) || SITE_DEFAULTS.locale,
    cmsLocale: (c && c.cmsLocale) || SITE_DEFAULTS.cmsLocale,
    strings: {
      ...base,
      ...s,
      contact: { ...base.contact, ...(s && s.contact) },
      town: { ...base.town, ...(s && s.town) },
      service: { ...base.service, ...(s && s.service) },
      listingStatus: { ...base.listingStatus, ...(s && s.listingStatus) },
      listingCta: (s && s.listingCta) || base.listingCta,
      thanks: { ...base.thanks, ...((s && (s as any).thanks) || {}) },
      notFound: { ...base.notFound, ...((s && (s as any).notFound) || {}) },
      beforeAfter: { ...base.beforeAfter, ...((s && (s as any).beforeAfter) || {}) },
      collage: { ...base.collage, ...((s && (s as any).collage) || {}) },
      map: { ...base.map, ...((s && (s as any).map) || {}) },
      footer: { ...base.footer, ...((s && (s as any).footer) || {}) },
      documents: { ...base.documents, ...((s && (s as any).documents) || {}) },
      consent: { ...base.consent, ...((s && (s as any).consent) || {}) },
    },
    listings: resolveListings(c && c.listings),
    cms: c && c.cms,
    contact: c && c.contact,
    maps: c && c.maps,
    media: c && c.media,
  };
}
