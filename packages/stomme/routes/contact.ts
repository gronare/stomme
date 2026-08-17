// Injected by the stomme integration at /api/contact on adapter builds (skipped on `static`, and when the site ships its own). Astro only detects `prerender` and handlers declared literally — hence the re-export by assignment.
import { POST as contact } from '../src/contact';

export const prerender = false;
export const POST = contact;
