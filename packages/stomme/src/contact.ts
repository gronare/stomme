import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
// @ts-expect-error — virtual alias, no static types.
import { site } from '@stomme/config';

// Contact-form handler (SSR endpoint) wired at /api/contact: CONTACT_FROM must sit on a Resend-verified domain, CONTACT_TO defaults to the CMS contact email, and on Cloudflare the env arrives on locals.runtime.env rather than in import.meta.env.

export const prerender = false;

function env(locals: any, key: string): string | undefined {
  return locals?.runtime?.env?.[key] ?? (import.meta as any).env?.[key];
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const wantsJson =
    (request.headers.get('accept') || '').includes('application/json') ||
    request.headers.get('x-requested-with') === 'fetch';
  const ok = (body: any) => (wantsJson ? new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }) : redirect(site?.routes?.formSuccess ?? '/thanks', 303));
  const fail = (msg: string, status: number) => (wantsJson ? new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: { 'Content-Type': 'application/json' } }) : new Response(msg, { status }));

  if (form.get('bot-field')) return ok({ ok: true }); // honeypot → silently "succeed"

  // Per-IP rate limit (5 per 10 min) that also keeps us under Resend's per-second cap; skipped when the STOMME_RL KV binding is absent, so older sites simply don't rate-limit.
  const rlKv = (locals as any)?.runtime?.env?.STOMME_RL;
  if (rlKv) {
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown';
    const key = `c:${new URL(request.url).hostname}:${ip}`;
    const n = Number(await rlKv.get(key)) || 0;
    if (n >= 5) return fail('Too many messages just now — please try again in a few minutes.', 429);
    await rlKv.put(key, String(n + 1), { expirationTtl: 600 });
  }

  const cap = (v: FormDataEntryValue | null, n: number) => String(v || '').trim().slice(0, n);
  const name = cap(form.get('name'), 200);
  const email = cap(form.get('email'), 200);
  const phone = cap(form.get('phone'), 60);
  const message = cap(form.get('message'), 5000);

  const apiKey = env(locals, 'RESEND_API_KEY');
  const from = env(locals, 'CONTACT_FROM');
  let to = env(locals, 'CONTACT_TO');
  if (!to) {
    try { to = (await getEntry('contact', 'contact'))?.data?.email; } catch {}
  }
  if (!apiKey || !from || !to) {
    return fail('Contact form not configured (RESEND_API_KEY, CONTACT_FROM, CONTACT_TO/contact.email).', 500);
  }

  const subject = `New enquiry from ${name || email || 'website'}`;
  const text = [`Name:  ${name}`, `Email: ${email}`, `Phone: ${phone}`, '', message].join('\n');
  // Sanitised to Resend's allowed tag characters.
  const siteTag = new URL(request.url).hostname.replace(/[^a-zA-Z0-9_-]/g, '-');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, reply_to: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : undefined, subject, text, tags: [{ name: 'site', value: siteTag }] }),
  });
  if (res.status === 429) return fail('Too many messages just now — please try again shortly.', 429);
  if (!res.ok) return fail('Could not send your message — please try again.', 502);

  return ok({ ok: true });
};
