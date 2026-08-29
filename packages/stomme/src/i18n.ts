import type { SiteConfig } from './config.ts';

export interface ResolvedLocales {
  enabled: boolean;
  locales: string[];
  default: string;
}

export interface AlternateLink {
  hreflang: string;
  href: string;
}

export interface LocaleEntry {
  id: string;
  data?: { published?: boolean; url?: string } & Record<string, unknown>;
}

export interface LocaleRoutes {
  locales: ResolvedLocales;
  served: Set<string>;
  // Per locale: the site path a page is written under → the path that locale serves it on, and the same mapping read backwards.
  localized: Map<string, Map<string, string>>;
  bases: Map<string, Map<string, string>>;
  custom: boolean;
}

export interface LocaleChoice {
  locale: string;
  code: string;
  label: string;
  href: string;
  current: boolean;
}

const shortLang = (tag?: string) => String(tag || '').split(/[-_]/)[0].toLowerCase();

// A trailing language subtag on an entry id — `kontakt.en`, `kontakt.nb-no`. Only ever honoured against the site's own locale list, so a page really called `plan.b` keeps its id.
const LOCALE_SUFFIX = /\.([a-z]{2,3}(?:-[a-z0-9]{2,8})?)$/i;

const PAGE_URL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ENDONYMS: Record<string, string> = {
  sv: 'Svenska', en: 'English', no: 'Norsk', nb: 'Norsk bokmål', nn: 'Norsk nynorsk',
  da: 'Dansk', de: 'Deutsch', fi: 'Suomi', fr: 'Français', es: 'Español', it: 'Italiano',
};

export function localeEndonym(locale: string): string {
  const code = String(locale || '');
  return ENDONYMS[shortLang(code)] || code.toUpperCase();
}

export function resolveLocales(site?: Pick<SiteConfig, 'locales' | 'locale' | 'cmsLocale'>): ResolvedLocales {
  const raw = Array.isArray(site?.locales) ? site!.locales! : [];
  const list = [...new Set(raw.map((l) => String(l || '').trim().toLowerCase()).filter(Boolean))];
  const fallback = shortLang(site?.locale || site?.cmsLocale) || 'en';
  if (list.length < 2) return { enabled: false, locales: [], default: fallback };
  return { enabled: true, locales: list, default: list[0] };
}

export function normalizeLocalePath(pathname: string): string {
  let p = String(pathname || '/');
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export function localePrefix(locale: string, def: string): string {
  return !locale || locale === def ? '' : `/${locale}`;
}

export function splitLocalePath(pathname: string, l: ResolvedLocales): { locale: string; path: string } {
  const p = normalizeLocalePath(pathname);
  if (!l.enabled) return { locale: l.default, path: p };
  const head = p.split('/')[1]?.toLowerCase() ?? '';
  if (head && head !== l.default && l.locales.includes(head)) {
    return { locale: head, path: normalizeLocalePath(p.slice(head.length + 1)) };
  }
  return { locale: l.default, path: p };
}

export function localeEntryId(id: string, locale: string, def: string): string {
  return !locale || locale === def ? id : `${id}.${locale}`;
}

export function stripLocaleSuffix(id: string, locales: string[]): { id: string; locale: string | null } {
  const m = String(id).match(LOCALE_SUFFIX);
  const found = m ? m[1].toLowerCase() : null;
  if (found && locales.includes(found)) return { id: String(id).slice(0, -m![0].length), locale: found };
  return { id: String(id), locale: null };
}

export function defaultLocaleEntries<T extends { id: string }>(entries: T[], site?: SiteConfig): T[] {
  const l = resolveLocales(site);
  if (!l.enabled) return entries;
  return entries.filter((e) => stripLocaleSuffix(e.id, l.locales).locale === null);
}

// The rendered locale, never the requested one: a page with no translation renders the default-locale entry, and every consequence of that — chrome strings, <html lang>, the locale the route reports — follows the content that is actually on the page.
export function pickLocaleEntry<T extends { id: string }>(
  entries: T[],
  id: string,
  locale: string,
  l: ResolvedLocales,
): { entry: T | undefined; locale: string; translated: boolean } {
  const wanted = localeEntryId(id, locale, l.default);
  if (wanted !== id) {
    const hit = entries.find((e) => e.id === wanted);
    if (hit) return { entry: hit, locale, translated: true };
  }
  return { entry: entries.find((e) => e.id === id), locale: l.default, translated: false };
}

export function hasTranslation(ids: Iterable<string>, id: string, locale: string, l: ResolvedLocales): boolean {
  const wanted = localeEntryId(id, locale, l.default);
  if (wanted === id) return true;
  for (const known of ids) if (known === wanted) return true;
  return false;
}

export function htmlLang(locale: string, site?: SiteConfig): string {
  const l = resolveLocales(site);
  const tags = (site && site.localeTags) || {};
  if (tags[locale]) return tags[locale];
  if (!l.enabled || locale === l.default) return (site && site.locale) || locale || 'en';
  return locale;
}

export function pageLang(pathname: string, site?: SiteConfig, rendered?: string): string {
  const l = resolveLocales(site);
  if (!l.enabled) return (site && site.locale) || 'en';
  return htmlLang(rendered || splitLocalePath(pathname, l).locale, site);
}

const pageFile = (id: string, locale: string | null) => `src/content/pages/${id}${locale ? `.${locale}` : ''}.md`;

// One warning per file for the whole build: localeRoutes is rebuilt for every component on every page, and the editor needs to read the line once, not once per render.
const warnedDefaultUrl = new Set<string>();

function customUrl(entry: LocaleEntry | undefined, id: string, locale: string): string {
  const raw = entry && entry.data && entry.data.url;
  const slug = typeof raw === 'string' ? raw.trim() : '';
  if (!slug) return '';
  if (!PAGE_URL.test(slug)) {
    throw new Error(`stomme i18n: "${slug}" in ${pageFile(id, locale)} is not a usable address — use lowercase a-z, digits and single hyphens, e.g. "the-area".`);
  }
  return slug;
}

// The paths a locale actually answers on. integration.mjs injects exactly two routes per non-default locale — `/<loc>` and `/<loc>/[...slug]` — and the second one's static paths are the published, non-suffixed `pages` entries (localePagesEntrypoint). Everything else a site serves (addon routes, /tack, listings, towns, services, 404) is built once, in the default language.
export function localeRoutes(site: SiteConfig | undefined, pages: readonly LocaleEntry[] = []): LocaleRoutes {
  const locales = resolveLocales(site);
  const served = new Set<string>();
  const localized = new Map<string, Map<string, string>>();
  const bases = new Map<string, Map<string, string>>();
  let custom = false;
  if (!locales.enabled) return { locales, served, localized, bases, custom };
  served.add('/');
  const own: LocaleEntry[] = [];
  const byId = new Map<string, LocaleEntry>();
  for (const p of pages) {
    if (!p) continue;
    byId.set(p.id, p);
    if (!p.data || !p.data.published) continue;
    if (stripLocaleSuffix(p.id, locales.locales).locale !== null) continue;
    served.add(normalizeLocalePath(`/${p.id}`));
    own.push(p);
  }
  // The default language's address is the filename: nav items, block links and every hand-written href name it, so a `url` beside it would break them rather than move the page.
  for (const p of own) {
    if (typeof p.data!.url !== 'string' || !p.data!.url.trim() || warnedDefaultUrl.has(p.id)) continue;
    warnedDefaultUrl.add(p.id);
    console.warn(`stomme i18n: ignoring \`url\` in ${pageFile(p.id, null)} — the address in ${locales.default} is the file's own name. Set \`url\` in the translations instead.`);
  }
  for (const loc of locales.locales) {
    const forward = new Map<string, string>([['/', '/']]);
    const back = new Map<string, string>([['/', '/']]);
    const claimed = new Map<string, string>();
    for (const p of own) {
      const from = normalizeLocalePath(`/${p.id}`);
      const slug = loc === locales.default ? '' : customUrl(byId.get(localeEntryId(p.id, loc, locales.default)), p.id, loc);
      const to = slug ? `/${slug}` : from;
      if (slug) custom = true;
      const file = pageFile(p.id, slug ? loc : null);
      const taken = claimed.get(to);
      if (taken) throw new Error(`stomme i18n: /${loc}${to} is the address of two pages — ${taken} and ${file}. Give one of them a different \`url\`.`);
      claimed.set(to, file);
      forward.set(from, to);
      back.set(to, from);
    }
    localized.set(loc, forward);
    bases.set(loc, back);
  }
  return { locales, served, localized, bases, custom };
}

// The path a locale serves a page on, the prefix left off — `/omradet` read in en with `url: the-area` is `/the-area`.
export function localePagePath(path: string, locale: string, routes: LocaleRoutes): string {
  const base = normalizeLocalePath(path);
  return routes.localized.get(locale)?.get(base) ?? base;
}

export function basePagePath(path: string, locale: string, routes: LocaleRoutes): string {
  const p = normalizeLocalePath(path);
  return routes.bases.get(locale)?.get(p) ?? p;
}

// A prefix is added only to a path this locale is known to serve — a link to anything else would be a 404 in that language rather than a translation, so it is left as it is and answers in the default language.
export function localeHref(href: string, locale: string, routes: LocaleRoutes): string {
  const h = String(href || '');
  const l = routes.locales;
  const prefix = localePrefix(locale, l.default);
  if (!l.enabled || !prefix) return h;
  if (!h.startsWith('/') || h.startsWith('//')) return h;
  if (h === prefix || h.startsWith(`${prefix}/`)) return h;
  const cut = h.search(/[?#]/);
  const written = cut === -1 ? h : h.slice(0, cut);
  const rest = cut === -1 ? '' : h.slice(cut);
  const base = normalizeLocalePath(written);
  if (!routes.served.has(base)) return h;
  const to = localePagePath(base, locale, routes);
  const slash = written.length > 1 && written.endsWith('/');
  return `${prefix}${to === '/' ? '/' : to + (slash ? '/' : '')}${rest}`;
}

export function localeLinker(site: SiteConfig | undefined, locale: string, pages: readonly LocaleEntry[] = []): (href: string) => string {
  const routes = localeRoutes(site, pages);
  return (href: string) => localeHref(href, locale, routes);
}

// Block link fields as src/href.ts reads them: a `link` holding either a { page, url } object or a plain string, plus the legacy `ctaHref`/`href2`/… strings. Rewritten once here, so no block component has to know the page is being rendered in a language.
const LINK_KEY = /^link$|href\d*$/i;
const isPlain = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

function mapLinkValue(value: unknown, map: (href: string) => string): unknown {
  if (typeof value === 'string') return map(value);
  if (!isPlain(value)) return value;
  let out = value;
  for (const k of ['page', 'url']) {
    const v = value[k];
    if (typeof v !== 'string') continue;
    const next = map(v);
    if (next === v) continue;
    if (out === value) out = { ...value };
    out[k] = next;
  }
  return out;
}

export function localizeLinks<T>(value: T, map: (href: string) => string): T {
  if (Array.isArray(value)) {
    let out: unknown[] = value;
    value.forEach((item, i) => {
      const next = localizeLinks(item, map);
      if (next === item) return;
      if (out === value) out = [...value];
      out[i] = next;
    });
    return out as unknown as T;
  }
  if (!isPlain(value)) return value;
  let out: Record<string, unknown> = value;
  for (const [k, v] of Object.entries(value)) {
    const next = LINK_KEY.test(k) ? mapLinkValue(v, map) : localizeLinks(v, map);
    if (next === v) continue;
    if (out === value) out = { ...value };
    out[k] = next;
  }
  return out as unknown as T;
}

export function localePathFor(path: string, locale: string, l: ResolvedLocales): string {
  const p = normalizeLocalePath(path);
  const prefix = localePrefix(locale, l.default);
  if (!prefix) return p;
  return p === '/' ? `${prefix}/` : prefix + p;
}

// Every locale is listed because every locale URL is built: an untranslated page still answers there, in the default language. x-default points at the default locale.
export function hreflangLinks(pathname: string, site?: SiteConfig, base?: URL | string | null, pages: readonly LocaleEntry[] = []): AlternateLink[] {
  const l = resolveLocales(site);
  if (!l.enabled) return [];
  const routes = localeRoutes(site, pages);
  const here = splitLocalePath(pathname, l);
  const path = basePagePath(here.path, here.locale, routes);
  // The alternate has to name the same URL the canonical does, trailing slash included, or the two tell a crawler about two different pages.
  const slashed = String(pathname || '/').length > 1 && String(pathname).endsWith('/');
  const at = (loc: string) => {
    const p = localePathFor(localePagePath(path, loc, routes), loc, l);
    const withSlash = slashed && !p.endsWith('/') ? `${p}/` : p;
    return base ? new URL(withSlash, base).href : withSlash;
  };
  const links = l.locales.map((loc) => ({ hreflang: htmlLang(loc, site), href: at(loc) }));
  links.push({ hreflang: 'x-default', href: at(l.default) });
  return links;
}

// Chrome copy follows the rendered locale: dropping the site's own `strings` overrides with it, since those are written in the default language.
export function localeConfig(site: SiteConfig | undefined, locale: string): SiteConfig | undefined {
  const l = resolveLocales(site);
  if (!site || !l.enabled || locale === l.default) return site;
  const { strings, ...rest } = site;
  return { ...rest, locale: htmlLang(locale, site), cmsLocale: locale };
}

export function localeSwitcher(pathname: string, site: SiteConfig | undefined, entries: readonly LocaleEntry[] = []): LocaleChoice[] {
  const l = resolveLocales(site);
  if (!l.enabled) return [];
  const routes = localeRoutes(site, entries);
  const here = splitLocalePath(pathname, l);
  const path = basePagePath(here.path, here.locale, routes);
  const id = path === '/' ? 'home' : path.slice(1);
  const ids = entries.map((e) => e.id);
  // An untranslated page has nowhere to send you in that language but its front page. The language you are already reading always points at the page you are on, translated or not.
  return l.locales.map((loc) => ({
    locale: loc,
    code: loc.toUpperCase(),
    label: localeEndonym(loc),
    href: loc === here.locale || hasTranslation(ids, id, loc, l)
      ? localePathFor(localePagePath(path, loc, routes), loc, l)
      : localePathFor('/', loc, l),
    current: loc === here.locale,
  }));
}

// The sitemap integration derives an alternate by swapping the locale prefix onto the same path, so the moment one page answers on a different address in one language every alternate it writes is a guess. The in-page hreflang set names the real URLs.
export function sitemapI18n(site?: SiteConfig, pages: readonly LocaleEntry[] = []): { i18n?: { defaultLocale: string; locales: Record<string, string> } } {
  const l = resolveLocales(site);
  if (!l.enabled) return {};
  if (localeRoutes(site, pages).custom) return {};
  const locales: Record<string, string> = {};
  for (const loc of l.locales) locales[loc] = htmlLang(loc, site);
  return { i18n: { defaultLocale: l.default, locales } };
}
