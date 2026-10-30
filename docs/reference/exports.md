# Package exports

Every import path `@gronare/stomme` publishes. Import by these names only, since other paths inside the package can move.

| Import | What it gives |
|---|---|
| `@gronare/stomme/integration` | the Astro integration, `stomme(options)`, and `localePages()` for the sitemap |
| `@gronare/stomme/BlockRenderer.astro` | renders a `blocks` list; props `blocks`, `registry` (your components by type), `config` (the site config) and `features` |
| `@gronare/stomme/catalog` | `defaultBlocks`, the library's catalog entries |
| `@gronare/stomme/kit` | `BlockDef`, `Field` and the field helpers, see [Field kit](field-kit.md) |
| `@gronare/stomme/collections` | `stommeCollections(listings)`, the content collections; `PRESET_SCHEMAS`, the entry schemas of the `article` and `catalog` presets; `localeAwareId()`, the entry id a language folder keeps apart |
| `@gronare/stomme/addon-collections` | `stommeAddonCollections()`, collections from `STOMME_SLOTS_DIR` |
| `@gronare/stomme/config` | the types `SiteConfig`, `StommeFeatures`, `Listing`, `DocsConfig`, `MediaConfig`, `SpecInput`, `SpecDef` and `ListingStatusKey`; `resolveSite()`, `resolveFeatures()`, `resolveListings()`, `resolveSpecs()`, `listingSpecRows()`, `listingStatusKey()`, `isUnlisted()`, `demoHost()`, `canonicalBounceHost()`; the constants `SITE_DEFAULTS`, `FEATURE_DEFAULTS` and `LISTING_STATUS_KEYS` |
| `@gronare/stomme/styles.css` | the design tokens and every component class |
| `@gronare/stomme/theme` | `themeStyle()` and `nightStyle()`, the theme's day and night colours as CSS; `ThemeColors`, the type of the theme entry; `NIGHT_COLORS`, the night colour keys |
| `@gronare/stomme/fonts` | `resolveFonts()` and `curatedWebfontUrls()`; `FONT_STACKS` and `WEBFONTS`, the fonts a theme can name, and the `Webfont` type |
| `@gronare/stomme/i18n` | `pageLang()`, `defaultLocaleEntries()`, `sitemapI18n()` and the other language helpers |
| `@gronare/stomme/pages` | `pagePath()` and the page-tree helpers |
| `@gronare/stomme/href` | `resolveLink()` and `resolveButton()`, a `{ page, url }` link or a button to an address, and `withTrailingSlash()` |
| `@gronare/stomme/markdown` | `renderMarkdown()`, Markdown with optimised, placed images |
| `@gronare/stomme/calendar` | `calendarFeed(collection, prefix)`, an `.ics` route for an article collection |
| `@gronare/stomme/contact` | the built-in contact handler, `POST` |
| `@gronare/stomme/form-samples` | `contactFormSamples()` and `formSampleChrome()`, the sample form content and its picker labels for previews, and the types `FormSample`, `FormSource`, `FormRecap` and `ContactStrings` |
| `@gronare/stomme/Head.astro` | the page's head tags |
| `@gronare/stomme/Header.astro`, `Footer.astro` | the site header and footer, from the navigation, footer and settings collections |
| `@gronare/stomme/Tracking.astro`, `ConsentBanner.astro`, `Metrics.astro` | Cloudflare analytics and marketing tags, the consent banner, first-party metrics |
| `@gronare/stomme/Cover.astro`, `Icon.astro` | an optimised image for an image field, and the icon set |
| `@gronare/stomme/DirectContact.astro`, `ContactLink.astro` | the direct-contact card and a protected phone or email link |
| `@gronare/stomme/Thanks.astro`, `TownPage.astro`, `ServicePage.astro`, `PostPage.astro`, `CatalogPage.astro` | page templates |
| `@gronare/stomme/blocks/*` | each block component, for extending one |
| `@gronare/stomme/routes/*` | the injected routes |
| `@gronare/stomme/virtual-aliases` | types for the `@stomme/*` aliases the integration creates; add `/// <reference types="@gronare/stomme/virtual-aliases" />` |

## Component props

| Component | Props |
|---|---|
| `BlockRenderer.astro` | `blocks`, `registry`, `config`, `features` |
| `Head.astro` | `title`, `description`, `image` (the share image), `manifest`, `themeColor` |
| `Header.astro` | `nav` (the navigation entry), `settings` (the settings entry) |
| `Footer.astro` | `footer`, `settings`, `contact` (the entries of those collections), `towns` (`{ id, name }` list), `townsHref` |
| `Tracking.astro`, `ConsentBanner.astro`, `Metrics.astro` | none; they read the tracking entry themselves |
| `Cover.astro` | `src`, `alt`, `placeholder` (the image when `src` is empty), `width`, `height`, `class`, `loading` (`lazy` by default) |
| `Icon.astro` | `name` (falls back to `spark`), `class` |
| `DirectContact.astro` | `label`, `tint`, `phone`, `phoneE164`, `email`, `address`, `hours`, `hoursNote`, `holiday`, `away`, `socials`, `footer`, `show` (which parts to show, each off unless `true`); what it is not given comes from the contact entry |
| `ContactLink.astro` | `kind` (`tel` or `mailto`), `target`, `display`, `label`, `protect`, `class`, `prefix`, `suffix` |
| `Thanks.astro` | `heading`, `message`, `primaryLabel` (required); `variant` (`classic` or `letter`), `eyebrow`, `primaryHref`, `secondaryLabel`, `secondaryHref`, `recapLabel`, `recap`, `showContact`, `talkLabel`, `who`, `town`, `toLabel`, `fromLabel` |
| `TownPage.astro` | `town` (the entry), `config` |
| `ServicePage.astro` | `service` (the entry), or `data` and `bodyHtml` for a draft; `config` |
| `PostPage.astro` | `post` (the entry), `config`, `listing` |
| `CatalogPage.astro` | `entry`, `config`, `listing` |

Render an image field with `Cover.astro` and a Markdown body with `renderMarkdown`, never as a raw `<img src={value}>`, so uploads are optimised. `Cover.astro` passes only a target width, so an upload keeps its own shape.

The package's peer dependency is `astro` 5 or later; the starter uses Astro 7.
