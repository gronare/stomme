// Contact-form endpoint — sends the submission via Resend.
// Needs RESEND_API_KEY + CONTACT_FROM (and CONTACT_TO or settings.email) in the env.
// Astro only detects `prerender` / handlers declared literally here — not via
// `export { POST } from …` — so import and re-assign.
import { POST as contact } from '@gronare/stomme/contact';

export const prerender = false;
export const POST = contact;
