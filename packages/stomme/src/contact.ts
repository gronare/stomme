import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';

// Contact-form handler (SSR endpoint). A site exposes it at /api/contact:
//   export { POST, prerender } from '@gronare/stomme/contact';
// The ContactForm block POSTs name/email/phone/message + a bot-field honeypot here.
// Sends via Resend: from a verified sender (env CONTACT_FROM), TO the business inbox
// (env CONTACT_TO, else the CMS settings email), reply-to the visitor. One verified
// Resend domain serves every site — only To/Reply-To vary.
//
// Env (Cloudflare: Pages secret/var on locals.runtime.env; Netlify/node: process.env):
//   RESEND_API_KEY  (secret, required)
//   CONTACT_FROM    (default 'forms@stomme.dev' — must be on the verified domain)
//   CONTACT_TO      (optional override; default = settings.email)

export const prerender = false;

function env(locals: any, key: string): string | undefined {
  return locals?.runtime?.env?.[key] ?? (import.meta as any).env?.[key];
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  if (form.get('bot-field')) return redirect('/thanks', 303); // honeypot → silently "succeed"

  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim();
  const phone = String(form.get('phone') || '').trim();
  const message = String(form.get('message') || '').trim();

  const apiKey = env(locals, 'RESEND_API_KEY');
  const from = env(locals, 'CONTACT_FROM') || 'forms@stomme.dev';
  let to = env(locals, 'CONTACT_TO');
  if (!to) {
    try { to = (await getEntry('settings', 'site'))?.data?.email; } catch {}
  }
  if (!apiKey || !to) return new Response('Contact email not configured', { status: 500 });

  const subject = `New enquiry from ${name || email || 'website'}`;
  const text = [`Name:  ${name}`, `Email: ${email}`, `Phone: ${phone}`, '', message].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, reply_to: email || undefined, subject, text }),
  });
  if (!res.ok) return new Response('Could not send your message — please try again.', { status: 502 });

  return redirect('/thanks', 303);
};
