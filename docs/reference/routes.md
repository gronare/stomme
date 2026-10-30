# Routes

Every route the integration injects, when it is there and how it renders.

The build log lists the routes it injected on a line starting `routes:`. A route marked "skipped when yours exists" is left out when the site has its own file at that path.

| Route | When | Renders | Skipped when yours exists |
|---|---|---|---|
| `/preview` | always | on demand; prerendered on `build:static`, so it does not follow typing there, and on demand in `pnpm dev` on every target | `src/pages/preview.astro` (`.ts`, `.js`, `.mdx`) |
| `/api/contact` | adapter builds | on demand, see [Connect the contact form](../how-to/connect-the-contact-form.md) | `src/pages/api/contact.ts` |
| `/map/[point].png` | adapter builds with a Google `maps.key` | on demand, a map still fetched from Google; in `pnpm dev`, a grey placeholder tile, since Google refuses the referrer-locked key there | no |
| `/404` | always | prerendered | `src/pages/404.astro` (`.md`, `.mdx`, `.html`) |
| `/robots.txt` | always | prerendered: allow all, plus the sitemap when `site` is set | `src/pages/robots.txt.ts` (`.js`, `.mjs`) or `public/robots.txt` |
| `/og/[...slug]` | always; builds pages only with share cards on | prerendered PNG cards, see [Generate share images](../how-to/generate-share-images.md) | no |
| `/lookbook`, `/lookbook/[slug]` | `pnpm dev`, or a build with `STOMME_LOOKBOOK` set | every block sample, the surfaces and the page templates on one page, and each section on its own page | no |
| `/<routes.towns>/[slug]` | `features.areas` | prerendered `TownPage` | no |
| `/<routes.services>/[slug]` | `features.services` | prerendered `ServicePage` | no |
| `<listing route>/[slug]` | each listing, and the blog | prerendered `PostPage` or `CatalogPage` | no |
| `<listing route>/calendar.ics` | each `article` listing, and the blog | prerendered calendar feed | no |
| `<docs route>/[...slug]`, `<docs route>/_search/[version].json` | `features.docs` | prerendered docs pages and search index | no |
| `<docs route>/_media/` | `features.docs` | the images the docs pages use, served from disk in `pnpm dev` and copied into the build output | no |
| `/<locale>`, `/<locale>/[...slug]` | each language after the first in `locales` | the home page and the editable pages in that language, prerendered | no |
| addon routes | from `routes.mjs` in `STOMME_SLOTS_DIR`, each when its `feature` flag is on, and again under each `/<locale>` prefix | as the entrypoint says | no |

Only the home page, the editable pages and addon routes get a copy per language. Service, area, listing and docs pages exist once, at their unprefixed address.

An addon route with no `feature`, a `pattern` that does not start with `/`, or an `entrypoint` file that does not exist is skipped, and the build log warns about it.

The site's own pages, `/`, `/<slug>` for each published page, and `/thanks`, come from the starter's `src/pages/`. `/admin/` and `/admin/blocks.html` are static files under `public/admin/`: `pnpm cms:gen` keeps `index.html` up to date and writes `blocks.html`, the gallery of the blocks the CMS offers.

## Built into every page

- **Head.** `@gronare/stomme/Head.astro` writes the title, description, canonical URL, Open Graph and Twitter tags, hreflang links, favicons, and on the home page local-business JSON-LD from the site settings and contact settings when the contact settings hold a phone number, an address or a coordinate pair.
- **noindex.** A page under `site.noindex`, the thank-you page, and any page built for a `*.pages.dev` or `*.workers.dev` address get `noindex, nofollow`.
- **Demo-address redirect.** When `site` names a real host, a page opened on a `*.pages.dev` or `*.workers.dev` address redirects to the same path on that host.
- **Media.** Files under `public/media/` are mirrored into `src/assets/media/` at build start, so Astro optimises CMS uploads. Files in `public/media/icons/` are also copied to the site's root.
