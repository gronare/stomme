# Site config

Every key `src/site.config.ts` exports: `site` (a `SiteConfig`), `features` (a `StommeFeatures`) and `listings` (a `Listing[]`), all typed by `@gronare/stomme/config`.

`astro.config.mjs` passes them to the integration, `cms:gen` reads the file for the CMS, and the pages pass `site` and `features` to the block renderer. A key left out takes its default, so a site sets only what differs.

## `site`

| Key | Default | What it does |
|---|---|---|
| `url` | none | the site's address, such as `https://example.com`; the calendar feed builds its event links from it ahead of `site` in `astro.config.mjs`, and breadcrumb JSON-LD uses it when `site` is unset |
| `routes.services` | `/services` | where service pages are served |
| `routes.towns` | `/areas` | where area pages are served |
| `routes.blog` | `/blog` | where blog posts and the calendar feed are served |
| `routes.contact` | `/contact` | where area, service and catalog entry pages send their buttons |
| `routes.formSuccess` | `/thanks` | the thank-you page the contact form opens; it is always marked `noindex` |
| `routes.<name>` | none | a route of your own, such as `routes.shop`; every key under `routes` is passed to the routes manifest and CMS editors of an [outside directory](../how-to/extend-from-an-outside-directory.md) |
| `locale` | `en-US` | the site's language and region; formats dates and picks the built-in interface text (English, Swedish or Norwegian); left unset, the interface text follows `cmsLocale` and dates format as `en-US` |
| `locales` | none | the content languages, default first; fewer than two turns translation off, see [Translate a site](../how-to/translate-a-site.md) |
| `localeTags` | none | the `lang` and hreflang tag per language, for example `{ sv: 'sv-SE' }` |
| `cmsLocale` | `en` | the CMS's field labels, `en` or `sv`; rerun `pnpm cms:gen` after changing it |
| `strings` | the built-in text for `locale` | your own wording for any interface text, see [Strings](#strings) |
| `noindex` | none | path prefixes marked `noindex, nofollow`, such as `['/drafts']` |
| `style` | none | a theme directory under `STOMME_THEMES_DIR`, see [Theme a site](../how-to/theme-a-site.md#use-a-theme-directory) |
| `metrics.endpoint` | none | an `https:` URL for first-party metrics, see [Measure visits](../how-to/measure-visits.md) |
| `analytics.cfToken` | none | a Cloudflare Web Analytics token; the beacon loads on every page, whether or not `tracking` is on, and without waiting for the consent banner |
| `maps.provider` | `google` when `maps.key` is set | `osm` or `google`, for the `findUs` map and `contactCard`'s mini-map |
| `maps.key` | none | a Google Maps key; on an adapter build, map stills are served through `/map/<point>.png`, so the visitor's browser does not call Google until they click |
| `contact.endpoint` | none | where the contact form posts, as `<endpoint>/contact` |
| `media` | `{ storage: 'git' }` | where CMS uploads go, see [Store uploads in R2](../how-to/store-uploads-in-r2.md) |
| `docs` | none | the docs section, see [Build docs from a repo](../how-to/build-docs-from-a-repo.md) |
| `cms` | none | the CMS backend, see [`cms`](#cms) |

### `cms`

Written into the `backend` of `public/admin/config.yml` by `cms:gen`.

| Key | Default | What it does |
|---|---|---|
| `backend` | `github` | the Sveltia backend: `github`, `gitlab`, `gitea` or `forgejo` |
| `repo` | `local/<package name>` when `backend` is unset | `owner/name` of the site's repository; the placeholder only serves **Work with Local Repository** |
| `branch` | `main` | the branch the CMS commits to |
| `baseUrl` | none | an OAuth server for signing in; also where the contact form posts when `contact.endpoint` is unset |
| `authEndpoint`, `apiRoot`, `gatewayUrl`, `identityUrl`, `siteDomain` | none | passed to Sveltia as `auth_endpoint`, `api_root`, `gateway_url`, `identity_url` and `site_domain` |
| `repoPath` | none | the site's folder inside its repository, when the site is not at the repository's root |

Locally, Sveltia's **Work with Local Repository** reads and writes the folder on disk in Chrome or Edge, and needs the folder you pick to be the repository's root.

### Strings

`strings` overrides the interface text one phrase at a time. The groups are `readMore`, `latest`, `changeLanguage`, `breadcrumbHome`, `breadcrumbLabel`, `listingCta`, and the objects `contact`, `beforeAfter`, `controls`, `collage`, `map`, `footer`, `documents`, `sectionNav`, `subpages`, `post`, `town`, `service`, `listingStatus`, `thanks`, `notFound`, `consent` and `docs`. Most strings are plain text. These fill in a placeholder:

| Placeholder | Strings |
|---|---|
| `{name}` | every `town` string, with the area's name |
| `{address}` | `map.embedTitle`, `map.embedTitleOsm` |
| `{n}` | `collage.more`, `collage.counter`, `post.yearCount`, `post.showingLatest` |
| `{i}` | `collage.counter` |
| `{count}` | `docs.pages` and the `docs.cards` bodies |
| `{file}`, `{ref}` | `docs.sourceAt` |

`town.reasons` is a list, not a phrase: `{ title, body }` items shown as a row of cards on every area page, empty by default.

The full English set is `SITE_DEFAULTS.strings` in `@gronare/stomme/config`.

```ts
export const site: SiteConfig = {
  strings: {
    readMore: 'Continue reading',
    contact: { submit: 'Send', message: 'How can we help?' },
  },
};
```

On a translated site, `strings` applies to the default language, and the other languages use their built-in text.

## `features`

| Flag | Default | What it turns on |
|---|---|---|
| `blog` | `false` | the `posts` collection, its post pages and calendar feed, `postList`, `postArchive`, `eventList`; the CMS also offers those three blocks when an `article` listing exists |
| `services` | `false` | the `services` collection, service pages, `serviceGrid` |
| `areas` | `false` | the `towns` collection, area pages, `linkChips`, and the areas in the home page's local-business JSON-LD |
| `testimonials` | `false` | the `testimonials` collection and block |
| `faq` | `false` | the `faq` collection and block |
| `documents` | `false` | the `documents` collection and `documentList` |
| `tracking` | `false` | the tracking settings, marketing tags and the consent banner; the tags and the banner load only once an ID is set in the tracking settings |
| `docs` | `false` | the docs section from `site.docs` |
| `pages` | `true` | the editable pages; `false` hides them in the CMS and drops `subpages` from its block menu |
| `contactForm` | `true` | `contactForm` and `contactSwitch`; `false` leaves them out of every rendered page, while the CMS still offers both blocks |

A site with no `features` export at all is read two ways. The CMS turns each collection's editor on when its folder exists under `src/content/`, and the blog's when `src/content/posts/` holds a post, while the integration injects no feature routes.

See [Turn on a feature](../how-to/turn-on-a-feature.md). A flag from an [outside directory](../how-to/extend-from-an-outside-directory.md) is read the same way.

## `listings`

| Key | Required | What it does |
|---|---|---|
| `id` | yes | the collection name and its folder `src/content/<id>/` |
| `route` | yes | the index page and the base of entry pages |
| `label` | yes | the collection's name in the CMS |
| `preset` | yes | `article` or `catalog` |
| `specs` | no | catalog only: `{ key, label }` fact rows, or bare strings keyed by position |
| `options` | no | `columns`, `showImages`, `featured`, `filters` |

See [Add a listing](../how-to/add-a-listing.md).

## Integration options

`astro.config.mjs` calls `stomme({ features, routes: site.routes, listings, style: site.style })`.

| Option | Default | What it does |
|---|---|---|
| `features` | none | the feature flags |
| `routes` | none | the route prefixes |
| `listings` | none | the listings |
| `style` | `STOMME_STYLE` | the theme directory |
| `layout` | `src/layouts/Base.astro` | the layout injected pages render in |
| `config` | `src/site.config.ts` | the site config file |
| `locales` | `site.locales` | overrides the languages |
