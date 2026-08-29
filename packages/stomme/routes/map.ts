// Nothing is cached on this side: the Maps Platform terms (3.2.3(b)) forbid storing the image, so only Google's own Cache-Control travels back with it.
export const prerender = false;

import type { APIRoute } from 'astro';
import { site } from '@stomme/config';
import { parseMapPoint } from '../src/map-point.ts';

const STATIC_MAP = 'https://maps.googleapis.com/maps/api/staticmap';

// The body never names the upstream or the key: this response reaches the visitor.
const refused = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export const GET: APIRoute = async ({ params, request }) => {
  const point = parseMapPoint(params.point);
  if (!point) return refused(404, 'no such map point');

  const key = typeof site?.maps?.key === 'string' ? site.maps.key.trim() : '';
  if (!key) return refused(502, 'map image unavailable');

  const language = String(site?.locale || 'en').split(/[-_]/)[0].toLowerCase().slice(0, 2) || 'en';
  const url = `${STATIC_MAP}?center=${point}&zoom=15&size=640x320&scale=2&format=png&maptype=roadmap`
    + `&language=${encodeURIComponent(language)}&key=${encodeURIComponent(key)}`;
  // The key is referrer-restricted to the site's own hosts, so the subrequest presents the site's origin; cacheEverything lets the Cloudflare edge honour Google's own headers on it without us storing anything.
  const init = {
    headers: { Referer: `${new URL(request.url).origin}/` },
    cf: { cacheEverything: true },
  } as RequestInit;

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch {
    return refused(502, 'map image unavailable');
  }
  if (upstream.status !== 200 || !upstream.body) return refused(502, 'map image unavailable');

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'image/png',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': upstream.headers.get('Cache-Control') || 'no-store',
    },
  });
};
