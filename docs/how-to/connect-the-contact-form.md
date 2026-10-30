# Connect the contact form

Make the `contactForm` and `contactSwitch` blocks deliver, through the built-in handler, your own endpoint or your own route.

The form is a plain `<form method="POST">` that also submits over `fetch` when JavaScript runs, so it works either way. It posts to the first of these that is set: `contact.endpoint` + `/contact`, `cms.baseUrl` + `/contact`, then `/api/contact`.

## Use the built-in handler

On an adapter build the engine serves `/api/contact`, which sends the message as an email through [Resend](https://resend.com).

1. Verify a sending domain in Resend and create an API key.
2. Set three variables in the site's environment on your host:

   | Variable | Value |
   |---|---|
   | `RESEND_API_KEY` | the Resend API key |
   | `CONTACT_FROM` | the sender, an address on the verified domain |
   | `CONTACT_TO` | where messages go; left unset, the `email` in the contact settings is used |

3. Deploy, send a message from the form, and it arrives at `CONTACT_TO` with the visitor's address as reply-to.

If a variable is missing, the handler answers `500` with `Contact form not configured`, and the form shows its error line.

The handler trims each field and keeps at most 200 characters of `name` and `email`, 60 of `phone`, 120 of `category`, `unit` and `inbox`, and 5000 of `message`. A submit without JavaScript is answered with a `303` redirect to `routes.formSuccess`, with a trailing slash.

On Cloudflare Workers, bind a KV namespace as `STOMME_RL` to rate-limit the form: after five messages from one IP to one host, the handler answers `429` until ten minutes have passed since the last one it accepted. See [Deploy a site](deploy.md#cloudflare-workers).

## Point the form at your own endpoint

1. Set `contact.endpoint` in `src/site.config.ts`.

   ```ts
   export const site: SiteConfig = {
     contact: { endpoint: 'https://forms.example.com' },
   };
   ```

2. Serve `POST /contact` at that address, a Worker, a Lambda or a form service, following [the handler contract](#the-handler-contract).
3. Build and submit the form. It posts to `https://forms.example.com/contact`.

This is how a `build:static` site gets a working form.

## Replace the route with your own

1. Create `src/pages/api/contact.ts` with a `POST` handler that follows [the handler contract](#the-handler-contract).
2. Build. The engine sees the file and does not inject its own route, so the form keeps posting to `/api/contact` with your code behind it.

## The handler contract

The form posts `multipart/form-data` with these fields.

| Field | Sent | What it holds |
|---|---|---|
| `name`, `email`, `message` | always | the visitor's input |
| `phone` | when the block shows the phone field | the visitor's phone |
| `category` | when `showCategory` is on and `categories` has entries | the chosen category |
| `unit` | when `showUnit` is on | the visitor's unit |
| `inbox` | when the block sets `inbox` | which inbox the message is for; empty or absent means the site's default |
| `bot-field` | always, hidden | a honeypot; when it is not empty, answer success and discard the message |
| `_success` | always | the thank-you path, from `routes.formSuccess` |
| `cf-turnstile-response` | when `PUBLIC_TURNSTILE_SITE_KEY` is set | the Turnstile token to verify |

Answer by the request:

- **JSON** when `Accept` contains `application/json` or `X-Requested-With` is `fetch`: `{ "ok": true }` with status 200, or `{ "ok": false, "error": "…" }` with an error status. On success the script keeps a recap of the message for the thank-you page and opens `_success`; on failure it shows the form's error line.
- **A 303 redirect to `_success`** otherwise, for a submit without JavaScript. Use `_success` rather than a fixed `/thanks`, since a site may rename its thank-you page.

## Add a bot check

1. Create a Turnstile widget in Cloudflare and set its site key at build time.

   ```bash
   PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA… pnpm build
   ```

2. Set the widget's secret key as `TURNSTILE_SECRET_KEY` in the site's environment on your host. The built-in `/api/contact` then verifies every token with Cloudflare and answers `403` when the check fails or the token is missing. In your own handler, verify `cf-turnstile-response` with the secret key yourself.
3. Open the form: the Turnstile widget loads from Cloudflare, and each submit carries a fresh token.
