// Contact-form endpoint — injected by the stomme integration at /api/contact on
// adapter builds (skipped on `static`, where no server exists, and when the site
// ships its own src/pages/api/contact.ts). Sends the submission via Resend:
// needs RESEND_API_KEY + CONTACT_FROM (and CONTACT_TO or settings.email) in the env.
// Astro only detects `prerender` / handlers declared literally — hence the re-assign.
import { POST as contact } from '../src/contact';

export const prerender = false;
export const POST = contact;
