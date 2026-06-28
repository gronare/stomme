// Contact-form endpoint — sends the submission via Resend.
// Needs RESEND_API_KEY + CONTACT_FROM (and CONTACT_TO or settings.email) in the env.
// `prerender` must be declared literally here — Astro doesn't detect it via re-export.
export const prerender = false;
export { POST } from '@gronare/stomme/contact';
