import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';

// Contact-form handler (SSR endpoint). A site exposes it at /api/contact:
//   export { POST, prerender } from '@gronare/stomme/contact';
// The ContactForm block POSTs name/email/phone/message + a bot-field honeypot here.
// Sends via Resend: from a verified COMPANY sender (env CONTACT_FROM — one verified
// domain serves every site), TO the business inbox (env CONTACT_TO, else the CMS
// settings email), reply-to the visitor.
//
// Responds JSON to fetch (the block shows an inline "what you sent" confirmation),
// or 303→/thanks for a plain (no-JS) form POST.
//
// Env (Cloudflare: Pages var/secret on locals.runtime.env; Netlify/node: process.env):
//   RESEND_API_KEY  (secret, required)
//   CONTACT_FROM    (required — e.g. 'forms@your-company.com'; must be a Resend-verified domain)
//   CONTACT_TO      (optional override; default = settings.email)

export const prerender = false;

function env(locals: any, key: string): string | undefined {
  return locals?.runtime?.env?.[key] ?? (import.meta as any).env?.[key];
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const wantsJson =
    (request.headers.get('accept') || '').includes('application/json') ||
    request.headers.get('x-requested-with') === 'fetch';
  const ok = (body: any) => (wantsJson ? new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }) : redirect('/thanks', 303));
  const fail = (msg: string, status: number) => (wantsJson ? new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: { 'Content-Type': 'application/json' } }) : new Response(msg, { status }));

  if (form.get('bot-field')) return ok({ ok: true }); // honeypot → silently "succeed"

  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim();
  const phone = String(form.get('phone') || '').trim();
  const message = String(form.get('message') || '').trim();

  const apiKey = env(locals, 'RESEND_API_KEY');
  const from = env(locals, 'CONTACT_FROM');
  let to = env(locals, 'CONTACT_TO');
  if (!to) {
    try { to = (await getEntry('settings', 'site'))?.data?.email; } catch {}
  }
  if (!apiKey || !from || !to) {
    return fail('Contact form not configured (RESEND_API_KEY, CONTACT_FROM, CONTACT_TO/settings.email).', 500);
  }

  const subject = `New enquiry from ${name || email || 'website'}`;
  const text = [`Name:  ${name}`, `Email: ${email}`, `Phone: ${phone}`, '', message].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, reply_to: email || undefined, subject, text }),
  });
  if (!res.ok) return fail('Could not send your message — please try again.', 502);

  return ok({ ok: true });
};
