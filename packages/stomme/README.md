# stomme

A block-based CMS engine + component library for **Astro + Decap**. Compose pages
from ~20 styled, themeable blocks; edit in a Git-backed CMS with a live preview of
the real components; ship static. Extend with your own blocks.

Quickstart: `pnpm dlx create-stomme my-site`. Full docs in the
[repository](https://example.com) (`README.md` + `docs/`).

## Exports

| Import | What |
|---|---|
| `stomme/BlockRenderer.astro` | Renders a `blocks` array. Built-in registry + optional `registry` (custom blocks) and `config` (routes/locale/strings) props. |
| `stomme/catalog` | `defaultBlocks` — the built-in block field definitions. |
| `stomme/styles.css` | Design tokens + all component classes (override to rebrand). |
| `stomme/config` | `KitConfig` type + defaults (routes/locale/strings). |
| `stomme/kit` | Field/block types + field helpers for catalogs. |
| `stomme/Header.astro`, `stomme/Footer.astro` | Themeable site chrome. |
| `stomme/Cover.astro`, `stomme/Icon.astro` | Optimized image + icon set. |
| `stomme/markdown`, `stomme/href` | `renderMarkdown`, `resolveLink`. |

## Bin scripts

- `stomme-gen` — generate the Decap admin from your catalog (+ copy the previews).
- `stomme-new-block` — scaffold a custom block component.

Peer dependency: `astro >= 5`.
