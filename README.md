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
| `starter` | A brand-neutral site that consumes it — the scaffold template. |
| `examples/an example site-new` | A real branded site built on the library. |

## Quickstart

The engine `@gronare/stomme` is **private** (GitHub Packages). Two ways to start a site:

```bash
# A) inside this monorepo (today) — uses the local workspace copy, nothing published
node packages/create-stomme/bin/create.mjs examples/my-site   # or sites/my-site
pnpm install
cd examples/my-site && pnpm dev        # site on :4321 + CMS on /admin

# B) standalone repo (once @gronare/stomme is published — see Publishing below)
pnpm dlx create-stomme my-site
```

Then: edit content under `src/content/`, recolor in `src/content/theme/theme.md`
(or the `:root` tokens in `src/styles/global.css`), and compose pages at `/admin`.

`/admin` needs no login locally — `pnpm dev` runs the Decap proxy alongside Astro.
In production, Decap authenticates via Netlify Identity (git-gateway).

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

## Publishing (private, GitHub Packages)

`@gronare/stomme` is scoped to GitHub Packages (see its `publishConfig`). Nothing is
public. To cut a release:

```bash
# 1. Authenticate (once). A GitHub PAT with `write:packages` (read:packages to install):
#    ~/.npmrc
#      @gronare:registry=https://npm.pkg.github.com
#      //npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
# 2. Bump the version, then publish from the package:
cd packages/stomme
npm version patch
npm publish            # → https://npm.pkg.github.com (private to the gronare scope)
```

A **separate** site repo then installs it with an `.npmrc` declaring the scope registry
(`@gronare:registry=https://npm.pkg.github.com` + the token), and depends on
`"@gronare/stomme": "^x.y.z"` instead of `workspace:*`. Until you publish, sites live in
this monorepo and resolve the package locally — fully private, no registry needed.

## Docs

- [docs/customizing.md](docs/customizing.md) — theming, custom blocks, config,
  collections, images, admin previews.
- [docs/blocks-reference.md](docs/blocks-reference.md) — every built-in block and
  its fields.

## Stack

Astro 5 (content collections, `astro:assets`), Decap CMS, marked. pnpm workspace,
Node ≥ 20.
