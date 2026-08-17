# stomme

A block-based CMS engine for **Astro + Sveltia CMS**. Compose pages from a styled,
themeable **component library**, edit them in a Git-backed CMS with a **live
preview of the real components**, and ship a fully static site.

> A page is an ordered list of typed blocks. `type` chooses the component; the
> rest of the block is that component's props.

```yaml
# src/content/home/home.md
blocks:
  - type: hero
    heading: "Build pages from blocks"
    media: image
  - type: featureGrid
    items: [ … ]
  - type: faq
```

## What you get

- **A component library** — 31 ready-made, styled blocks (hero, featureGrid,
  testimonials, faq, gallery, before/after, steps, plans, CTA, …). Recolor with CSS
  variables; no Tailwind required.
- **A CMS page builder** — Sveltia CMS, generated from your block catalog, with a live
  preview that renders the *real* components (no parallel preview code).
- **Static output** — pages prerender. On an adapter build two routes stay on-demand:
  `/preview` (the live CMS preview) and `/api/contact` (the form handler).
- **Extensible** — add your own blocks alongside the library ones, mount extra
  routes, collections and header/footer slots from a directory outside the repo, and
  swap the contact form's handler for your own.

## Repository layout

| Path | What it is |
|---|---|
| `packages/stomme` | The engine + component library (the dependency). |
| `packages/create-stomme` | The scaffolder — copies `starter` into a new site. |
| `starter` | A brand-neutral site that consumes it — the scaffold template. |

## Quickstart

```bash
git clone https://github.com/gronare/stomme.git
cd stomme && pnpm install

node packages/create-stomme/bin/create.mjs sites/my-site
cd sites/my-site
pnpm install
pnpm dev          # site on :4321 + CMS on /admin (local file backend)
```

Edit content in `src/content/`, recolor `src/content/theme/theme.md`, compose
pages at `/admin`.

## Deploying

Every deploy target is a build script. The output is mostly static: pages and generated
share cards prerender, while `/preview` and `/api/contact` are served on demand.

```bash
pnpm build              # Netlify (adapter preinstalled) — deploy dist/ + the generated function
pnpm build:cloudflare   # Cloudflare Pages (pnpm add @astrojs/cloudflare first)
pnpm build:vercel       # Vercel          (pnpm add @astrojs/vercel first)
pnpm build:node         # your own server (pnpm add @astrojs/node first)
pnpm build:static       # no adapter — a fully static dist/ for GitHub Pages or any host
```

`build:static` has no server, so `/preview` is prerendered (the live preview stops
updating as you type) and `/api/contact` is not injected at all — a static site needs an
external form handler, see below. For a GitHub Pages *project* site (`user.github.io/repo`),
also set `base: '/<repo>'` in `astro.config.mjs`.

On Netlify: connect the repo (or `netlify deploy`), build command `pnpm build`,
publish directory `dist` — the contact endpoint and CMS preview ship as a
serverless function automatically. Set `RESEND_API_KEY`, `CONTACT_FROM` and
`CONTACT_TO` in the site's environment to make the contact form deliver.

## The contact form

The form is a plain `<form method="POST">` that also submits over `fetch` when JavaScript
runs, so it works either way. You choose what receives it:

**The built-in handler.** On an adapter build the engine injects `/api/contact` and sends
mail through [Resend](https://resend.com). Set `RESEND_API_KEY`, `CONTACT_FROM` (an address
on a Resend-verified domain) and `CONTACT_TO` in the site's environment. Nothing else.

**Your own endpoint.** Point the form anywhere:

```ts
// src/site.config.ts
export const site: SiteConfig = {
  contact: { endpoint: 'https://forms.example.com' },
};
```

It then POSTs to `<endpoint>/contact` — a Worker, a Lambda, a form service, whatever you
host. This is also how a `build:static` site gets a working form.

**Your own route.** Create `src/pages/api/contact.ts` and the engine notices and skips
injecting its own, so you keep the same URL with your code behind it.

Either replacement needs to honour the same small contract — the fields, the honeypot, and
answering JSON to a `fetch` submit but a 303 to a plain one. It is written out in
[docs/customizing.md](docs/customizing.md#the-contact-forms-handler).

## Commands (in a site)

```
pnpm dev          # Astro dev server (+ /admin, /preview)
pnpm build        # cms:gen + astro build
pnpm cms:gen      # regenerate the CMS builder UI from your catalog
pnpm block:new MyBlock      # scaffold a custom block component
```

## How it fits together

- **Catalog** (`src/blocks/schema.ts`) — your block list. Defaults to the library
  catalog (`@gronare/stomme/catalog`); extend it with your own blocks.
- **Renderer** (`@gronare/stomme/BlockRenderer.astro`) — maps each `type` to a component.
  Pass a `registry` prop to add custom blocks and a `config` prop for per-site
  routes/locale/strings.
- **Styling** — import `@gronare/stomme/styles.css` (tokens + component classes), then
  override the CSS variables to rebrand.
- **Config** (`src/site.config.ts`) — route prefixes, date locale, fixed strings.

## License

[AGPL-3.0-only](LICENSE). You can use, modify and self-host stomme freely —
including for client work. If you distribute it, or run a modified version as
a network service, the same freedoms must be passed on.

## Docs

- [docs/customizing.md](docs/customizing.md) — theming, custom blocks, config,
  collections, images, admin previews, the contact form's handler.
- [docs/blocks-reference.md](docs/blocks-reference.md) — every built-in block and
  its fields.

## Stack

Astro 5 (content collections, `astro:assets`), Sveltia CMS, marked. pnpm workspace,
Node ≥ 20.
