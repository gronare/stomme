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

const DEV_TILE = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320"><rect width="640" height="320" fill="#e8ebe6"/><path d="M0 80h640M0 160h640M0 240h640M160 0v320M320 0v320M480 0v320" stroke="#d5dad2" stroke-width="1"/><circle cx="320" cy="150" r="10" fill="#5c6f62"/><path d="M320 160c-6 8-10 14-10 20a10 10 0 0 0 20 0c0-6-4-12-10-20z" fill="#5c6f62"/></svg>`;

export const GET: APIRoute = async ({ params, request }) => {
  const point = parseMapPoint(params.point);
  if (!point) return refused(404, 'no such map point');

  // Node's fetch strips the Referer header, so the referrer-locked key can never pass in dev; the tile stands in.
  if (import.meta.env.DEV) {
    return new Response(DEV_TILE, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    });
  }

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
