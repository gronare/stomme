# Changelog

Engine changes that affect consuming sites. Sites follow the `release` branch
(or pin a SHA); entries here mark anything a site operator should know before
taking a new release. Field policy: new fields are opt-in — absent from the
frontmatter means disabled/not shown (see `src/kit.ts`).

## Unreleased

- **Breaking:** the engine no longer loads theme directories. `site.style`,
  `STOMME_STYLE` and `STOMME_THEMES_DIR` are gone, and a site that still sets `style`
  stops the build and `stomme cms` with a message saying what to do: move the theme's
  `tokens.css` and `theme.css` into `src/styles/global.css` right after the engine
  import, which is where the build used to put them, and drop `style`. The CMS preview
  reads the same `global.css`. Colours in `theme.md` are unchanged.
- The CMS block list is labelled "Sections" once, with "build the page" as its hint,
  instead of the long label in both the field header and the list's item count. A
  site's `config.yml` takes it when it is regenerated.
- One `stomme` command runs a site: `stomme dev`, `stomme build [--target static|netlify|cloudflare|vercel|node]`
  (sets `STOMME_TARGET`), `stomme cms`, `stomme block new <name>`, `stomme lint [content|styles|comments]`
  and `stomme new <directory>`; `stomme --help` lists them. Inside a site it runs as `pnpm stomme …`.
  `stomme-gen`, `stomme-new-block`, `stomme-lint-content`, `stomme-lint-styles` and
  `stomme-lint-comments` stay as they are, so a site's existing scripts need no change. The starter's
  scripts now call `stomme`, and `scripts/dev.mjs` passes its options to `astro dev`.
- The engine is published to npmjs as `stomme` and the scaffolder as `create-stomme`, so
  `pnpm create stomme my-site` creates a site with no clone and no token. A site made that way
  depends on `"@gronare/stomme": "npm:stomme@^<version>"`, so every import keeps the
  `@gronare/stomme` name. A site that links the engine from a checkout keeps building unchanged.
  One that wants the npm package instead replaces its `link:` dependency with that range; its
  `@gronare:registry` line in `.npmrc` is then unused. The scaffolder no longer writes that
  `.npmrc`, and a scaffold from the registry keeps its `.gitignore`.
- Twelve switches now start off in the CMS: `postList` `media.showImages` and `layout.featured`,
  `catalogList` `media.showImages` and `layout.filters`, `subpages` `media.showImages`,
  `documentList` `layout.grouped`, `showPhone` and `showDirectContact` on `contactForm` and on each
  `contactSwitch` item, `contactCard` `tint` and `findUs` `showHours`. `contactCard` `show` starts
  empty. Sveltia writes a field's default into every entry that lacks the key when the entry is
  opened, so a default of on showed a page that left the key out as on in `/admin`, while the page
  rendered it off, and the next save turned it on. A default now always equals what the block
  renders with the key left out. Pages render exactly as before; a block an editor adds in `/admin`
  starts with these off, and the editor turns on what it needs.
- The settings panes follow the same rule. The header's and the footer's `showLogo` and
  `showWordmark`, the footer's `showLinks` and the thank-you page's `showContact` now start off in
  `/admin`, as a file without them renders; the footer's `showContact` stays on, as it renders.
  The theme's `secondary` starts at `#0ea5e9`, the colour the engine stylesheet renders without it. A site whose
  `public/admin/config.yml` has the `settings:generated` markers picks this up at its next
  `stomme-gen`; a site with hand-written settings panes keeps its own defaults until they are
  edited.
- A page made in `/admin` starts unpublished, as a page file without `published` is not built. The
  **Published** switch is now the first field of the page form, with a hint saying what off does:
  no page at the address, nothing in the sitemap, automatic submenus or `subpages` lists, while a
  menu link written by hand stays. The pages list marks an unpublished page after its title and
  has an **Unpublished** filter that includes pages without the key. Existing pages build as
  before; an editor turns **Published** on before a new page goes live. Regenerate with
  `stomme-gen` to get it.
- `stomme-lint-content` (`pnpm lint:content` in the starter) checks every block in `src/content/`
  against the site's catalog: each field the catalog does not declare, each older field from
  `block-migrations.json` and each unknown block type, by file and line. `--json` prints the report
  as data and `--strict` exits `1` on any finding. `stomme-gen` prints one line with the counts. A
  site's `package.json` gains the script with `"lint:content": "stomme-lint-content"`. See
  `docs/how-to/write-pages-by-hand.md`.
- A docs section also writes `llms.txt`, `llms-full.txt` and each page as Markdown at its path
  plus `.md`, per version, and links the Markdown from each page's head. A site with no
  `llms.txt` of its own gets the docs one at `/llms.txt`. `site.docs.blocks: true` publishes the
  block catalog at `<route>/blocks.json`. See `docs/how-to/use-an-ai-agent.md`.
- The home page's LocalBusiness JSON-LD is written only when the contact settings hold a
  phone number, an address or a coordinate pair. A site with a name and nothing else, or
  only an email, socials or an organisation number, writes no JSON-LD.
- The CMS offers `catalogList`'s `source` as a pick of the site's catalog listings, preselected
  when there is one, and `postList`, `postArchive` and `eventList`'s when the site has two or
  more article listings. A listing block with no `base` links under the `route` of the listing
  `source` names; `catalogList` falls back to `/<source>` and the blog to `routes.blog` as before.
- `create-stomme` makes a blank site by default: a home page, a contact page with its
  form, a neutral theme, placeholder text and no photos, with services, testimonials
  and the FAQ turned off. `--demo` scaffolds the Wren & Sorrel demo from `starter/`
  and `--blank` the blank site; without either it asks in a terminal and makes the
  blank site otherwise.
- `features.docs` with `site.docs` builds a documentation section from a folder of
  Markdown in a GitHub repo, read at build time: the latest release at `/docs`, the
  default branch under `/docs/<branch>`, with a version picker, search and an
  "On this page" outline. New strings under `strings.docs`. See `docs/how-to/build-docs-from-a-repo.md`.
- A docs page can show live examples: a ```` ```yaml block ```` fence renders its block (or
  list of blocks) with the site's own renderer above the code, and ```` ```html preview ````
  renders its markup as written. An example that cannot be drawn shows its code under a
  notice, `strings.docs.previewFailed`, and the build logs it. See
  `docs/how-to/build-docs-from-a-repo.md`.
- `hero` and `ctaPanel` take a `command`, a copyable one-line shell command. `ctaPanel`
  also takes `cta2` and `anchor`; `plans` takes `anchor` and a per-plan `note`.
- `hero` and `textImage` play a looping video (`media.kind: video`, `video`,
  `videoWebm`, `videoUrl`, with `image` as the poster). The hero takes `media.ratio`
  and `layout.mediaPosition: below`; `textImage` takes an `eyebrow`, and with no text
  its media fills the row.
- `theme.md` takes `scheme: auto` with `night…` colours for dark mode, and `fontMono`
  / `fontCustomMonoFile` for the code font. Write the theme with `themeStyle()` and
  `nightStyle()` from `@gronare/stomme/theme` in `Base.astro`; the starter does. The
  settings pane only reaches existing sites when their `config.yml` is regenerated.
- A theme with `scheme: auto` gets a light/dark switch at the end of the header. The
  visitor's choice sits as `data-theme="light|dark"` on `<html>`, is remembered in the
  browser and applied before first paint; without a choice the page follows the system.
  A site stylesheet that keys its own dark rules on `prefers-color-scheme` alone does not
  follow a forced choice. New strings `controls.darkMode` and `controls.lightMode`.
- New strings under `strings.controls` (copy, copied, pause and play labels).
- The share image carries `og:image:width` and `og:image:height` when its size is known:
  a generated card, or an image uploaded to the media library.
- With no `site.cms`, `cms:gen` writes `backend: github` and a placeholder repo,
  `local/<package name>`, so `/admin` offers Work with Local Repository; it wrote
  `git-gateway`, which Sveltia rejects. `create-stomme` runs `git init` in a new site
  outside a repository.
- The built-in `/api/contact` reads its env and the `STOMME_RL` binding through
  `cloudflare:workers` on the Cloudflare adapter and `process.env` elsewhere; it no
  longer touches `locals.runtime`, which throws on Astro 7's Cloudflare adapter.
- With `TURNSTILE_SECRET_KEY` set, `/api/contact` verifies `cf-turnstile-response`
  with Cloudflare and answers `403` when the check fails or the token is missing.
- `stomme-new-block` takes its name after a `--`, as `pnpm block:new -- Name` passes it.
- The listing index page `cms:gen` seeds is `published: true`.
- `SiteConfig.cms` types `repoPath` and `siteDomain`.
- `/preview` renders on request in `astro dev` on the static target, so the CMS preview
  follows typing there.
- Starter: `pnpm preview` builds the static target and serves it; the Netlify adapter
  runs without its edge-functions emulation in dev.
- The wordmark accent over a dark first block, and the fact values in a split
  `ctaBox`, lift a dark brand colour to a readable lightness (OKLCH L 0.65); lighter
  brands render as before.
- `ctaBox` panel: the buttons and intro align left with the heading.
- `serviceGrid` with exactly three cards fills three columns from 1024px.
- `steps` flow without icons shows the number once, in the circle.
- The footer link columns sit left under the brand column when they wrap on a phone.
- On a phone, a wordmark too long for the row breaks onto two lines before the header
  button moves into the menu.
- The `beforeAfter` handle is a drawn SVG arrow pair.

- Listing `category`, FAQ `tags` and document `group` are Sveltia relation
  fields over new term collections (`<listing>-categories`, `faq-tags`,
  `document-groups`, one `title` per file). Stored values stay plain strings.
  `stomme-gen` seeds one term file per distinct existing value into
  `src/content/<terms>/` and never rewrites an existing term file; commit the
  seeded files with the regenerated config. Catalog lists open sorted by date
  added, newest first.
- First public release: AGPL-3.0-only license, public quickstart, `/api/contact`
  injected by the integration on adapter builds (a site's own physical route
  still wins; `static` builds skip it).
