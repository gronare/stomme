# @gronare/stomme

A block-based CMS engine + component library for **Astro + Sveltia CMS**. Compose pages from
37 styled, themeable blocks; edit them in a Git-backed CMS with a live preview of the real
components; ship static. Extend with your own blocks, routes and collections.

Not published to a registry yet — clone the repository and scaffold from it. See the
[repository README](https://github.com/gronare/stomme#quickstart) for the quickstart, and
`docs/` for theming, custom blocks, collections and the contact form's handler.

## Exports

| Import | What |
|---|---|
| `@gronare/stomme/integration` | The Astro integration. Wires the CMS generator, virtual aliases, `/preview`, `/404`, `/robots.txt`, `/api/contact`, `/og`, theme splicing and the addon seams. |
| `@gronare/stomme/BlockRenderer.astro` | Renders a `blocks` array. Built-in registry plus optional `registry` (your blocks) and `config` (routes/locale/strings) props. |
| `@gronare/stomme/catalog` | `defaultBlocks` — the built-in block field definitions. |
| `@gronare/stomme/collections` | `stommeCollections()` — the content-collection schemas. |
| `@gronare/stomme/addon-collections` | `stommeAddonCollections()` — collections contributed by an out-of-tree addon dir. |
| `@gronare/stomme/kit` | `SiteConfig`-independent field/block types and field helpers for building a catalog. |
| `@gronare/stomme/config` | `SiteConfig` / `StommeFeatures` / `Listing` types, defaults, and the per-locale string sets. |
| `@gronare/stomme/virtual-aliases` | Ambient declarations for the `@stomme/*` aliases the integration creates at build time. An extension adds `/// <reference types="@gronare/stomme/virtual-aliases" />` and gets typed `site`, `features` and `listings` instead of casts. |
| `@gronare/stomme/styles.css` | Design tokens + every component class (override the tokens to rebrand). |
| `@gronare/stomme/Header.astro`, `Footer.astro` | Themeable site chrome. |
| `@gronare/stomme/Head.astro` | Title, description, Open Graph, Twitter card, favicon, canonical and noindex. |
| `@gronare/stomme/Cover.astro`, `Icon.astro` | Optimized image + the icon set. |
| `@gronare/stomme/Thanks.astro`, `TownPage.astro`, `ServicePage.astro`, `PostPage.astro`, `CatalogPage.astro` | Page templates. |
| `@gronare/stomme/markdown`, `href`, `fonts`, `contact` | `renderMarkdown`, `resolveLink`, `resolveFonts`, the contact-form handler. |
| `@gronare/stomme/blocks/*`, `routes/*` | Individual block components and the injectable routes. |

## Bin scripts

- `stomme-gen` — generate the Sveltia admin from your catalog, and copy the preview assets.
- `stomme-new-block` — scaffold a custom block component.
- `stomme-gen-schema`, `stomme-gen-blocks` — emit the schema and block manifests.
- `stomme-lint-styles` — fail on a new hardcoded colour outside the token block.

Peer dependency: `astro >= 5`. Node `>= 20`.
