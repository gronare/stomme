# stomme

A block-based CMS engine + component library for **Astro + Sveltia CMS**. Compose pages from
Over forty styled, themeable blocks; edit them in a Git-backed CMS with a live preview of the real
components; ship static. Extend with your own blocks, routes and collections.

Published on npm as `stomme`. A site depends on it under the name its imports use,
`"@gronare/stomme": "npm:stomme@^<version>"`, which the scaffolder writes:

```bash
pnpm create stomme my-site
```

See the [repository README](https://github.com/gronare/stomme#install) and `docs/` for theming,
custom blocks, collections and the contact form's handler.

## Exports

| Import | What |
|---|---|
| `@gronare/stomme/integration` | The Astro integration. Wires the CMS generator, virtual aliases, `/preview`, `/404`, `/robots.txt`, `/api/contact`, `/og`, the docs section (`features.docs`), theme splicing and the addon seams. |
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
| `@gronare/stomme/markdown`, `href`, `fonts`, `theme`, `contact` | `renderMarkdown`, `resolveLink`, `resolveFonts`, `themeStyle`/`nightStyle` (the theme's day and night colours), the contact-form handler. |
| `@gronare/stomme/blocks/*`, `routes/*` | Individual block components and the injectable routes. |

## The `stomme` command

`stomme new <directory>`, `dev`, `build [--target static|netlify|cloudflare|vercel|node]`, `cms`,
`block new <name>` and `lint`; `stomme --help` lists them. The older bin names (`stomme-gen`,
`stomme-new-block`, `stomme-lint-content`, `stomme-lint-styles`, `stomme-lint-comments`) still work.
`stomme-gen-schema` and `stomme-gen-blocks` emit the engine's own schema and block manifests.

Peer dependency: `astro >= 5`. Node `>= 20`.
