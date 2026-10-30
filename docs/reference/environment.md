# Environment variables

Every environment variable the engine and the starter read, and where each one is read.

## On the server

Set these in the host's environment for the deployed site. On Cloudflare Workers, `/api/contact` reads the Worker's own bindings (variables and secrets) first, then the process environment, then the build's `import.meta.env`.

| Variable | What it does |
|---|---|
| `RESEND_API_KEY` | the Resend API key for the built-in `/api/contact` |
| `CONTACT_FROM` | the sender address, on a domain verified in Resend |
| `CONTACT_TO` | the recipient; unset, the `email` in the contact settings is used |
| `TURNSTILE_SECRET_KEY` | the Cloudflare Turnstile secret key; when set, `/api/contact` verifies the form's `cf-turnstile-response` and refuses a message that fails |
| `STOMME_RL` | Cloudflare Workers only, a KV namespace binding rather than a variable; when bound, `/api/contact` counts messages per visitor IP and host, and after the fifth answers `429` until 10 minutes have passed since the last accepted one |

## At build time

| Variable | What it does |
|---|---|
| `STOMME_TARGET` | `netlify` (default), `cloudflare`, `vercel`, `node` or `static`; the `build:*` scripts set it |
| `PUBLIC_TURNSTILE_SITE_KEY` | a Cloudflare Turnstile site key; the contact form renders the widget and sends `cf-turnstile-response` |
| `GITHUB_TOKEN` | a token for reading a private docs repository, or for GitHub's higher rate limit |
| `STOMME_DOCS_DIR` | a local docs folder to build the docs section from, as one version |
| `STOMME_SLOTS_DIR` | an [outside directory](../how-to/extend-from-an-outside-directory.md) of slots, blocks, collections, CMS editors and routes |
| `STOMME_LOOKBOOK` | any value builds `/lookbook` into a production build |

## For the CMS generator

| Variable | What it does |
|---|---|
| `STOMME_SCHEMA` | the catalog file, default `src/blocks/schema.ts`; only the generator reads it, the build always uses `src/blocks/schema.ts` |
| `STOMME_CONFIG` | the CMS config file, default `public/admin/config.yml` |
| `STOMME_SVELTIA_SRC` | the URL of the Sveltia CMS script that `/admin` loads |

The generator also reads `STOMME_SLOTS_DIR` for an outside directory's `block-catalog.mjs`, CMS editors and previews.
