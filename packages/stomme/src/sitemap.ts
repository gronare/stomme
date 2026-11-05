import { isUnlisted, type SiteConfig } from './config.ts';
import { normalizeLocalePath, resolveLocales, splitLocalePath } from './i18n.ts';

export function sitemapExcludes(site?: SiteConfig, hiddenPrefixes: readonly string[] = []): (pathname: string) => boolean {
  const locales = resolveLocales(site);
  const prefixes = hiddenPrefixes.map(normalizeLocalePath).filter((p) => p !== '/');
  return (pathname) => {
    const path = normalizeLocalePath(pathname);
    if (prefixes.some((p) => path === p || path.startsWith(`${p}/`))) return true;
    return isUnlisted(splitLocalePath(path, locales).path, site?.noindex, site?.routes?.formSuccess);
  };
}

interface SitemapHooks {
  'astro:routes:resolved'?: (opts: { routes: Array<{ pathname?: string }> } & Record<string, unknown>) => unknown;
  'astro:build:done'?: (opts: { pages: Array<{ pathname: string }> } & Record<string, unknown>) => unknown;
}

export function filterSitemap(integration: { hooks: SitemapHooks } | undefined, excluded: (pathname: string) => boolean): boolean {
  if (!integration?.hooks) return false;
  const { hooks } = integration;
  const routesResolved = hooks['astro:routes:resolved'];
  const buildDone = hooks['astro:build:done'];
  if (routesResolved) hooks['astro:routes:resolved'] = (opts) => routesResolved({ ...opts, routes: opts.routes.filter((r) => !r.pathname || !excluded(r.pathname)) });
  if (buildDone) hooks['astro:build:done'] = (opts) => buildDone({ ...opts, pages: opts.pages.filter((p) => !excluded(p.pathname)) });
  return true;
}
