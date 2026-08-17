export const prerender = true;

// The renderer's absolute file:// URL, a Vite define from the integration: it MUST be loaded as a runtime dynamic import of that URL and never bundled — sharp/@resvg are native binaries Rollup can't ingest, and externalized bare specifiers wouldn't resolve from a consuming site's dist under pnpm isolation.
declare const __STOMME_OG_RENDERER__: string;

import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { site, features, listings } from '@stomme/config';
import { ogPages, type OgPage } from '../src/og-pages.ts';

export async function getStaticPaths() {
  const settings = (await getEntry('settings', 'site'))?.data;
  if (!settings?.og?.enabled) return [];
  const pages = await ogPages({ features, routes: site.routes, listings });
  return pages.filter((p) => p.card).map((p) => ({ params: { slug: p.slug }, props: { page: p } }));
}

// An independent copy of src/og.mjs's EMPTY_PNG: if that module fails to load at all, nothing it exports is reachable.
const EMPTY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==',
  'base64',
);

async function buildPng(page: OgPage): Promise<Buffer> {
  const warn = (msg: string, e?: unknown) =>
    console.warn(`[stomme og] ${page.slug}: ${msg}${e ? ` — ${(e as Error)?.message ?? e}` : ''} (build continues)`);

  let og;
  try {
    // Variable indirection on purpose: a define-substituted string literal inside import() gets statically resolved and bundled by Rollup even with @vite-ignore.
    const rendererUrl: string = __STOMME_OG_RENDERER__;
    og = await import(/* @vite-ignore */ rendererUrl);
  } catch (e) {
    warn('card renderer failed to load (satori/resvg/sharp)', e);
    return EMPTY_PNG;
  }

  const settings = (await getEntry('settings', 'site'))?.data ?? ({} as Record<string, never>);
  const theme = (await getEntry('theme', 'theme'))?.data ?? {};
  const logo = settings.logo ?? {};
  const name = settings.name || '';
  const vars: Record<string, string> = page.vars ?? {};

  const isDefault = !page.typeKey;
  const t = (page.typeKey && settings.og?.types?.[page.typeKey]) || {};
  const pick = (key?: string) => (!key || key === 'none' ? '' : key === 'business' ? name : vars[key] ?? '');
  const headline = pick(t.headlineField || page.headlineDefault || 'title') || vars.title || name;
  const subline = isDefault ? '' : pick(t.sublineField || page.sublineDefault || 'none');
  const showLogo = !isDefault && t.showLogo !== false;

  const input = {
    title: headline,
    tagline: subline,
    wordmark: showLogo ? (logo.textPre || logo.textAccent ? { pre: logo.textPre, accent: logo.textAccent } : name) : null,
    og: { style: t.style, scrim: t.scrim, showLogo, accent: t.accent },
    theme,
  };

  const bg = await og.loadImageSource(page.image);
  if (page.image && !bg) warn(`background image not found (${page.image}) — using the brand background`);
  try {
    return await og.renderOgCard({ ...input, bgImageBuffer: bg });
  } catch (e) {
    warn('card generation failed', e);
  }
  if (bg) {
    try {
      return await og.renderOgCard(input);
    } catch (e) {
      warn('brand-background card failed too', e);
    }
  }
  if (settings.ogImage) {
    try {
      const raw = await og.loadImageSource(settings.ogImage);
      if (raw) return await og.rawImagePng(raw);
      warn(`settings.ogImage not found (${settings.ogImage})`);
    } catch (e) {
      warn('settings.ogImage fallback failed', e);
    }
  }
  try {
    return await og.solidPng(theme.brand);
  } catch (e) {
    warn('solid-colour fallback failed', e);
    return EMPTY_PNG;
  }
}

export const GET: APIRoute = async ({ props }) => {
  const { page } = props as { page: OgPage };
  const png = await buildPng(page);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
