// Injected by the stomme integration at /og/[...slug] — the generated-OG-card
// endpoint (settings.og, Phase 2). Prerendered: every OG-eligible page (see
// src/og-pages.ts — the same enumeration Head.astro points og:image with) emits one
// static 1200×630 PNG at /og/<page path>.png; home is /og/index.png.
//
// The master switch is CONTENT (settings.og.enabled), which doesn't exist yet at
// astro:config:setup — so the route is always injected and gates itself here:
// disabled ⇒ getStaticPaths returns [] ⇒ nothing is emitted, and the renderer's
// native deps are never even loaded (dynamic import inside the build step).
//
// Bulletproof by contract: a card failure must NEVER fail the build. Every step
// falls through with a warning — full card → card on the brand background →
// settings.ogImage as a plain PNG → solid brand colour → a 1×1 placeholder.
export const prerender = true;

// The renderer's absolute file:// URL, injected by the integration as a Vite define.
// It MUST be loaded as a runtime dynamic import of that URL — NOT bundled: its deps
// (sharp/@resvg) are native binaries Rollup can't ingest, and externalized bare
// specifiers wouldn't resolve from a consumer site's dist under pnpm isolation.
// Imported from its real package location, node resolves everything naturally.
declare const __STOMME_OG_RENDERER__: string;

import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
// @ts-expect-error — virtual alias to the site's src/site.config.ts (integration-wired).
import { site, features, listings } from '@stomme/config';
import { ogPages, type OgPage } from '../src/og-pages.ts';

export async function getStaticPaths() {
  const settings = (await getEntry('settings', 'site'))?.data;
  if (!settings?.og?.enabled) return [];
  const pages = await ogPages({ features, routes: site.routes, listings });
  return pages.map((p) => ({ params: { slug: p.slug }, props: { page: p } }));
}

// Local last resort: og.ts exports EMPTY_PNG, but if that module itself fails to load
// (native-dep trouble), nothing from it is reachable — keep an independent copy.
const EMPTY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==',
  'base64',
);

async function buildPng(page: OgPage): Promise<Buffer> {
  const warn = (msg: string, e?: unknown) =>
    console.warn(`[stomme og] ${page.slug}: ${msg}${e ? ` — ${(e as Error)?.message ?? e}` : ''} (build continues)`);

  let og; // the renderer module — loaded lazily so disabled sites never touch native deps
  try {
    // Variable indirection on purpose: a define-substituted string literal inside
    // import() gets statically resolved and bundled by Rollup even with @vite-ignore.
    const rendererUrl: string = __STOMME_OG_RENDERER__;
    og = await import(/* @vite-ignore */ rendererUrl);
  } catch (e) {
    warn('card renderer failed to load (satori/resvg/sharp)', e);
    return EMPTY_PNG;
  }

  const settings = (await getEntry('settings', 'site'))?.data ?? ({} as Record<string, never>);
  const theme = (await getEntry('theme', 'theme'))?.data ?? {};
  const footer = (await getEntry('footer', 'footer'))?.data;
  const cfg = settings.og ?? {};
  const logo = settings.logo ?? {};
  const input = {
    title: page.title || settings.name || '',
    tagline: cfg.tagline || footer?.tagline || settings.name || '',
    wordmark: logo.textPre || logo.textAccent ? { pre: logo.textPre, accent: logo.textAccent } : settings.name,
    og: cfg,
    theme,
  };

  // 1. The full card — page photo background when the page has one.
  const bg = await og.loadImageSource(page.image);
  if (page.image && !bg) warn(`background image not found (${page.image}) — using the brand background`);
  try {
    return await og.renderOgCard({ ...input, bgImageBuffer: bg });
  } catch (e) {
    warn('card generation failed', e);
  }
  // 2. Same card on the brand background (a bad/undecodable photo shouldn't unbrand the page).
  if (bg) {
    try {
      return await og.renderOgCard(input);
    } catch (e) {
      warn('brand-background card failed too', e);
    }
  }
  // 3. The static share image (Phase-1 behaviour, as a PNG at the card URL).
  if (settings.ogImage) {
    try {
      const raw = await og.loadImageSource(settings.ogImage);
      if (raw) return await og.rawImagePng(raw);
      warn(`settings.ogImage not found (${settings.ogImage})`);
    } catch (e) {
      warn('settings.ogImage fallback failed', e);
    }
  }
  // 4. Solid brand colour; 5. a valid empty PNG.
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
