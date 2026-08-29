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

const shortLang = (tag?: string) => String(tag || '').split(/[-_]/)[0].toLowerCase();

// A trailing language subtag on an entry id — `kontakt.en`, `kontakt.nb-no`. Only ever honoured against the site's own locale list, so a page really called `plan.b` keeps its id.
const LOCALE_SUFFIX = /\.([a-z]{2,3}(?:-[a-z0-9]{2,8})?)$/i;

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

export function localeHref(href: string, locale: string, l: ResolvedLocales): string {
  const h = String(href || '');
  const prefix = localePrefix(locale, l.default);
  if (!l.enabled || !prefix) return h;
  if (!h.startsWith('/') || h.startsWith('//')) return h;
  if (h === prefix || h.startsWith(`${prefix}/`)) return h;
  return h === '/' ? `${prefix}/` : prefix + h;
}

export function localePathFor(path: string, locale: string, l: ResolvedLocales): string {
  const p = normalizeLocalePath(path);
  const prefix = localePrefix(locale, l.default);
  if (!prefix) return p;
  return p === '/' ? `${prefix}/` : prefix + p;
}

// Every locale is listed because every locale URL is built: an untranslated page still answers there, in the default language. x-default points at the default locale.
export function hreflangLinks(pathname: string, site?: SiteConfig, base?: URL | string | null): AlternateLink[] {
  const l = resolveLocales(site);
  if (!l.enabled) return [];
  const { path } = splitLocalePath(pathname, l);
  // The alternate has to name the same URL the canonical does, trailing slash included, or the two tell a crawler about two different pages.
  const slashed = String(pathname || '/').length > 1 && String(pathname).endsWith('/');
  const at = (loc: string) => {
    const p = localePathFor(path, loc, l);
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

export function localeSwitcher(
  pathname: string,
  site: SiteConfig | undefined,
  translatedIds: Iterable<string> = [],
): { locale: string; label: string; href: string; current: boolean }[] {
  const l = resolveLocales(site);
  if (!l.enabled) return [];
  const { locale: current, path } = splitLocalePath(pathname, l);
  const id = path === '/' ? 'home' : path.slice(1);
  const ids = [...translatedIds];
  // An untranslated page has nowhere to send you in that language but its front page. The language you are already reading always points at the page you are on, translated or not.
  return l.locales.map((loc) => ({
    locale: loc,
    label: loc.toUpperCase(),
    href: loc === current || hasTranslation(ids, id, loc, l) ? localePathFor(path, loc, l) : localePathFor('/', loc, l),
    current: loc === current,
  }));
}

export function sitemapI18n(site?: SiteConfig): { i18n?: { defaultLocale: string; locales: Record<string, string> } } {
  const l = resolveLocales(site);
  if (!l.enabled) return {};
  const locales: Record<string, string> = {};
  for (const loc of l.locales) locales[loc] = htmlLang(loc, site);
  return { i18n: { defaultLocale: l.default, locales } };
}
