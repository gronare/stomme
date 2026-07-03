# stomme

A block-based CMS engine for **Astro + Decap**. Compose pages from a styled,
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

- **A component library** — ~20 ready-made, styled blocks (hero, featureGrid,
  testimonials, faq, gallery, before/after, steps, CTA, …). Recolor with CSS
  variables; no Tailwind required.
- **A CMS page builder** — Decap, generated from your block catalog, with a live
  preview that renders the *real* components (no parallel preview code).
- **Static output** — every page prerenders; only `/preview` is on-demand.
- **Extensible** — add your own blocks alongside the library ones.

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

Every deploy target is a build script — the output is a mostly-static site with
two on-demand routes (`/api/contact`, `/preview`):

```bash
pnpm build              # Netlify (adapter preinstalled) — deploy dist/ + the generated function
pnpm build:cloudflare   # Cloudflare Pages (pnpm add @astrojs/cloudflare first)
pnpm build:vercel       # Vercel          (pnpm add @astrojs/vercel first)
pnpm build:node         # your own server (pnpm add @astrojs/node first)
```

On Netlify: connect the repo (or `netlify deploy`), build command `pnpm build`,
publish directory `dist` — the contact endpoint and CMS preview ship as a
serverless function automatically. Set `RESEND_API_KEY`, `CONTACT_FROM` and
`CONTACT_TO` in the site's environment to make the contact form deliver.

> `pnpm build:static` produces a fully static `dist/` (no adapter), but the
> contact endpoint and live preview need a server — use one of the adapter
> targets if you want the form.

## Commands (in a site)

```
pnpm dev          # Astro + Decap local proxy (+ /admin, /preview)
pnpm build        # cms:gen + astro build
pnpm cms:gen      # regenerate the CMS builder UI from your catalog
pnpm block:new -- MyBlock   # scaffold a custom block component
```

## How it fits together

- **Catalog** (`src/blocks/schema.ts`) — your block list. Defaults to the library
  catalog (`stomme/catalog`); extend it with your own blocks.
- **Renderer** (`stomme/BlockRenderer.astro`) — maps each `type` to a component.
  Pass a `registry` prop to add custom blocks and a `config` prop for per-site
  routes/locale/strings.
- **Styling** — import `stomme/styles.css` (tokens + component classes), then
  override the CSS variables to rebrand.
- **Config** (`src/site.config.ts`) — route prefixes, date locale, fixed strings.

## License

[AGPL-3.0-only](LICENSE). You can use, modify and self-host stomme freely —
including for client work. If you distribute it, or run a modified version as
a network service, the same freedoms must be passed on.

## Docs

- [docs/customizing.md](docs/customizing.md) — theming, custom blocks, config,
  collections, images, admin previews.
- [docs/blocks-reference.md](docs/blocks-reference.md) — every built-in block and
  its fields.

## Stack

Astro 5 (content collections, `astro:assets`), Decap CMS, marked. pnpm workspace,
Node ≥ 20.
