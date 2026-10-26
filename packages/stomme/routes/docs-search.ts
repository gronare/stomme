export const prerender = true;

import type { APIRoute } from 'astro';
import docs from '@stomme/docs';

export function getStaticPaths() {
  return docs.versions.map((v) => ({ params: { version: v.key } }));
}

export const GET: APIRoute = ({ params }) => {
  const version = docs.versions.find((v) => v.key === params.version);
  return new Response(JSON.stringify(version?.search ?? []), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
