# Content collections

Every content collection the engine defines, its folder under `src/content/` and its fields.

The schemas come from `stommeCollections(listings)` in `@gronare/stomme/collections`, which `src/content.config.ts` spreads. It also spreads `stommeAddonCollections()` from `@gronare/stomme/addon-collections`, the collections an [outside directory](../how-to/extend-from-an-outside-directory.md) declares in `collections.mjs`, or none.

```ts
export const collections = { ...stommeCollections(listings), ...stommeAddonCollections() };
```

Every collection is defined whether its feature is on or not, and an empty folder is fine. The CMS edits each one; the settings collections hold a single file.

## Pages

| Collection | Folder | Fields |
|---|---|---|
| `home` | `home/home.md` | `seo`, `blocks` |
| `pages` | `pages/<slug>.md` | `title`, `published` (`false` when absent, and a page made in the CMS starts with it off), `parent`, `url`, `summary`, `cover`, `order`, `seo`, `blocks` |

A page without `published: true` is not built: its address shows the 404 page, and it is left out of the sitemap, of a menu item's automatic submenu and of `subpages` lists, and none of its translations is built. A breadcrumb names it without a link, and the CMS preview still renders it. A menu link written by hand stays and leads to the 404 page. In `/admin` the **Published** switch is the first field of the page form, the pages list marks an unpublished page after its title, and the **Unpublished** filter lists them, pages without the key included.

A page's address is its file name, nested under its `parent`: a page with `parent: /services` answers at `/services/<its slug>`, and gets breadcrumbs. `url` gives a translation its own slug. `summary` and `cover` show on `subpages` cards, and `order` sorts pages that share a parent.

`seo` is `title` and `description` (both required), `image` (the share image), and `ogRaw` on collection entries. `blocks` is the list of blocks, see [Blocks](blocks.md).

## Site settings

### `settings`

`settings/site.md`.

| Field | What it holds |
|---|---|
| `name` | the site's name: the default title, `og:site_name`, the JSON-LD name |
| `logo` | `image`, `imageDark`, `plate`, `alt`, and a text wordmark `textPre` plus `textAccent` |
| `favicon` | defaults to `/favicon.svg` |
| `appleIcon` | the touch icon |
| `languageSwitcher` | `globe` (default) or `flags` |
| `ogImage` | the site's default share image |
| `og` | share cards, see [Generate share images](../how-to/generate-share-images.md) |

### `contact`

`contact/contact.md`. The contact blocks, the footer, the thank-you page and the home page's JSON-LD read it.

| Field | What it holds |
|---|---|
| `phone`, `phoneE164` | the phone as shown, and as dialled |
| `email` | also the built-in handler's recipient when `CONTACT_TO` is unset |
| `protectContact` | `true` keeps the phone and email in the direct-contact card out of the plain HTML until JavaScript reveals them |
| `address` | `street`, `postcode`, `city`, `country`, `lat`, `lng` |
| `hours`, `hoursNote` | `{ days, hours }` rows and a note |
| `holidayHours` | `{ when, note }` rows |
| `away` | `enabled`, `message`, `until` |
| `socials` | `{ platform, url }` rows |
| `orgNr`, `founded` | the company number and founding year |

### `theme`

`theme/theme.md`. `themeStyle()` writes each colour as a CSS variable on `<html>`.

| Field | Default | Variable |
|---|---|---|
| `brand` | `#4338ca` | `--color-brand` |
| `ink` | `#1f2937` | `--color-ink` |
| `muted` | from the stylesheet | `--color-muted` |
| `onDark` | `#ffffff` | `--color-on-dark` |
| `surface` | `#e0e7ff` | `--color-surface` |
| `paper` | `#ffffff` | `--color-paper` |
| `line` | `#e5e7eb` | `--color-line` |
| `secondary` | from the stylesheet | `--color-secondary` |
| `highlight` | `#f59e0b` | `--color-highlight` |
| `dark`, `darkInk`, `darkLine` | derived | `--color-dark`, `--color-dark-ink`, `--color-dark-line`, for the `dark` surface |
| `eyebrow` | `dash` | the eyebrow marker: `dash`, `bullet` or `bold` |
| `eyebrowColor` | `brand` | `brand`, `secondary` or `highlight` |
| `scheme` | `light` | `auto` follows the visitor's dark mode and adds a light/dark switch to the header |
| `nightBrand` … `nightDarkLine` | the day colour | a night twin of each colour, used with `scheme: auto` |
| `fontDisplay`, `fontBody`, `fontMono` | the system fonts | `--font-display`, `--font-sans`, `--font-mono`, see [Theme a site](../how-to/theme-a-site.md#pick-the-fonts) |
| `fontCustomFile`, `fontCustomBodyFile`, `fontCustomMonoFile` | none | uploaded font files under `/media/fonts/` |

### `navigation`

`navigation/nav.md`, read by `@gronare/stomme/Header.astro`.

| Field | What it holds |
|---|---|
| `items[]` | `label`, `link`, and `children[]` (`label`, `link`) for a submenu; `menu` fills the submenu from a collection, and `autoChildren: true` from the page's subpages |
| `cta` | a button at the end: `label`, `link` |
| `sticky` | `false` (default); `true` keeps the header at the top while scrolling, `phone` does so on small screens only |
| `showLogo`, `showWordmark` | the logo image and the text wordmark, off unless set |

### `footer`

`footer/footer.md`, read by `@gronare/stomme/Footer.astro`.

| Field | What it holds |
|---|---|
| `dark` | a dark footer |
| `tagline` | a line under the logo |
| `showLinks`, `linksHeading`, `links[]`, `links2Heading`, `links2[]` | two link columns, `label` and `link` each; the first shows only with `showLinks: true` |
| `showTowns`, `townsHeading` | a column of areas |
| `showContact` | the phone and email, on by default |
| `showAddress`, `showHours`, `showSocials` | the address, opening hours and social links from the contact settings; with the address on, the tagline drops the town it would repeat |
| `legal[]` | links on the bottom line |
| `note` | a line of small print |
| `showLogo`, `showWordmark` | the logo image and the text wordmark, off unless set |

### `thanks` and `tracking`

`thanks/thanks.md` sets the thank-you page: `variant`, `heading` (with `{name}`), `message`, `button`, `button2` and `showContact` (the direct-contact card, off unless set). `tracking/tracking.md` holds `gtmId`, `ga4Id`, `metaPixelId` and `privacyUrl`, used when the `tracking` flag is on.

## Feature collections

| Collection | Fields |
|---|---|
| `faq` | `question`, `answer`, `order`, `tags[]` (from `faq-tags`) |
| `testimonials` | `name`, `role`, `quote`, `order` |
| `documents` | `title`, `file`, `group` (from `document-groups`), `date`, `note`, `order` |
| `towns` | `name`, `title`, `order`, `heroSubtitle`, `heroNote`, `why`, `problems[]`, `districts[]`, `localCase`, `services[]`, `media` (`image`, `imageAlt`), `seo` |
| `services` | `title`, `navLabel`, `summary`, `order`, `bullets[]`, `media`, `seo`, `hero` (`image`, `imageAlt`, `ticks[]`, `cta`, `cta2`), `blocks` |
| `posts`, and each `article` listing | `title`, `date`, `excerpt`, `category`, `eventDate`, `eventTime`, `cover`, `showCover`, and the Markdown body |
| each `catalog` listing | `title`, `price`, `status` (`available` by default, `reserved`, `sold`), `category`, `cover`, `gallery[]` (`image`, `alt`), `specs` (by key), `date`, and the body |

Term collections hold one `title` per file: `faq-tags`, `document-groups`, `posts-categories` and `<id>-categories` for each listing. The CMS picks a value from them, and the entry stores the plain string.

An entry's id is its file name, or its `slug` field when set. A file such as `about.sv.md` keeps its language suffix in the id.
