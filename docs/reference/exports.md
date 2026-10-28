# Package exports

Every import path `@gronare/stomme` publishes. Import by these names only, since other paths inside the package can move.

| Import | What it gives |
|---|---|
| `@gronare/stomme/integration` | the Astro integration, `stomme(options)`, and `localePages()` for the sitemap |
| `@gronare/stomme/BlockRenderer.astro` | renders a `blocks` list; props `blocks`, `registry` (your components by type), `config` (the site config) and `features` |
| `@gronare/stomme/catalog` | `defaultBlocks`, the library's catalog entries |
| `@gronare/stomme/kit` | `BlockDef`, `Field` and the field helpers, see [Field kit](field-kit.md) |
| `@gronare/stomme/collections` | `stommeCollections(listings)`, the content collections |
| `@gronare/stomme/addon-collections` | `stommeAddonCollections()`, collections from `STOMME_SLOTS_DIR` |
| `@gronare/stomme/config` | `SiteConfig`, `StommeFeatures`, `Listing`, `resolveSite()`, `SITE_DEFAULTS` |
| `@gronare/stomme/styles.css` | the design tokens and every component class |
| `@gronare/stomme/theme` | `themeStyle()` and `nightStyle()`, the theme's day and night colours as CSS |
| `@gronare/stomme/fonts` | `resolveFonts()` and `curatedWebfontUrls()` |
| `@gronare/stomme/i18n` | `pageLang()`, `defaultLocaleEntries()`, `sitemapI18n()` and the other language helpers |
| `@gronare/stomme/pages` | `pagePath()` and the page-tree helpers |
| `@gronare/stomme/href` | `resolveLink()` and `resolveButton()`, a `{ page, url }` link or a button to an address, and `withTrailingSlash()` |
| `@gronare/stomme/markdown` | `renderMarkdown()`, Markdown with optimised, placed images |
| `@gronare/stomme/calendar` | `calendarFeed(collection, prefix)`, an `.ics` route for an article collection |
| `@gronare/stomme/contact` | the built-in contact handler, `POST` |
| `@gronare/stomme/form-samples` | sample form content for previews |
| `@gronare/stomme/Head.astro` | the page's head tags |
| `@gronare/stomme/Header.astro`, `Footer.astro` | the site header and footer, from the navigation, footer and settings collections |
| `@gronare/stomme/Tracking.astro`, `ConsentBanner.astro`, `Metrics.astro` | Cloudflare analytics and marketing tags, the consent banner, first-party metrics |
| `@gronare/stomme/Cover.astro`, `Icon.astro` | an optimised image for an image field, and the icon set |
| `@gronare/stomme/DirectContact.astro`, `ContactLink.astro` | the direct-contact card and a protected phone or email link |
| `@gronare/stomme/Thanks.astro`, `TownPage.astro`, `ServicePage.astro`, `PostPage.astro`, `CatalogPage.astro` | page templates |
| `@gronare/stomme/blocks/*` | each block component, for extending one |
| `@gronare/stomme/routes/*` | the injected routes |
| `@gronare/stomme/virtual-aliases` | types for the `@stomme/*` aliases the integration creates; add `/// <reference types="@gronare/stomme/virtual-aliases" />` |

Render an image field with `Cover.astro` and a Markdown body with `renderMarkdown`, never as a raw `<img src={value}>`, so uploads are optimised. `Cover.astro` passes only a target width, so an upload keeps its own shape.

The package's peer dependency is `astro` 5 or later; the starter uses Astro 7.
