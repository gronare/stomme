# Deploy a site

Build a site for Netlify, Cloudflare Workers, Vercel, your own Node server or any static host.

Every target is one build script. Pages and share cards always prerender. On an adapter build, `/preview` (the CMS's live preview), `/api/contact` (the contact form's handler) and `/map/[point].png` (when a Google map key is set) run on demand. [Routes](../reference/routes.md) lists them all.

| Target | Script | Adapter | Output |
|---|---|---|---|
| Netlify | `pnpm build` | `@astrojs/netlify`, preinstalled | `dist/` plus a function under `.netlify/v1/` |
| Cloudflare Workers | `pnpm build:cloudflare` | `@astrojs/cloudflare`, preinstalled | `dist/client/` and `dist/server/wrangler.json` |
| Vercel | `pnpm build:vercel` | `@astrojs/vercel`, add it first | the adapter's output |
| Node server | `pnpm build:node` | `@astrojs/node`, add it first | a standalone server in `dist/` |
| Static host | `pnpm build:static` | none | a fully static `dist/` |

A target whose adapter is missing stops the build with the command that installs it.

## Netlify

1. Connect the repository in Netlify, with build command `pnpm build` and publish directory `dist`. From the command line, use `netlify deploy` instead.
2. Set `RESEND_API_KEY`, `CONTACT_FROM` and `CONTACT_TO` in the site's environment, so the contact form delivers. See [Connect the contact form](connect-the-contact-form.md).
3. Deploy. The contact handler and the CMS preview ship as a serverless function on their own; open `/preview` on the deployed site and it answers.

## Cloudflare Workers

1. Build for Workers.

   ```bash
   pnpm build:cloudflare
   ```

2. Deploy with the config the build wrote.

   ```bash
   npx wrangler deploy -c dist/server/wrangler.json
   ```

3. Open the URL wrangler prints. A `*.workers.dev` or `*.pages.dev` address is marked `noindex`, and when `site` in `astro.config.mjs` names another host, a page opened on the demo address redirects there.

If the site uses Cloudflare Web Analytics, set `analytics.cfToken`. See [Measure visits](measure-visits.md).

## Vercel

1. Add the adapter.

   ```bash
   pnpm add @astrojs/vercel
   ```

2. Build.

   ```bash
   pnpm build:vercel
   ```

3. Deploy the output with the Vercel CLI or a connected repository using that build command.

## Your own Node server

1. Add the adapter.

   ```bash
   pnpm add @astrojs/node
   ```

2. Build. The adapter runs in standalone mode, so the output is a server you start with Node.

   ```bash
   pnpm build:node
   ```

3. Start the server from the build output and open the site on the port it prints.

   ```bash
   node dist/server/entry.mjs
   ```

## A static host

1. Build without an adapter.

   ```bash
   pnpm build:static
   ```

2. Upload `dist/` to any host that serves files, such as GitHub Pages.

3. Open the site. `/preview` is prerendered, so the CMS preview does not follow typing, and `/api/contact` does not exist. Point the form at your own handler with `contact.endpoint`, see [Connect the contact form](connect-the-contact-form.md).

If the site is a GitHub Pages project site (`user.github.io/repo`), also set `base: '/repo'` in `astro.config.mjs`.

## Set the site's address

Set `site` in `astro.config.mjs` to the address the site is served on. Canonical URLs, Open Graph URLs, hreflang links, the sitemap and the `Sitemap:` line in `robots.txt` are built from it.

```js
export default defineConfig({
  site: 'https://example.com',
  // …
});
```
