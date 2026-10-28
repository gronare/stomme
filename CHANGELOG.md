# Changelog

Engine changes that affect consuming sites. Sites follow the `release` branch
(or pin a SHA); entries here mark anything a site operator should know before
taking a new release. Field policy: new fields are opt-in — absent from the
frontmatter means disabled/not shown (see `src/kit.ts`).

## Unreleased

- `features.docs` with `site.docs` builds a documentation section from a folder of
  Markdown in a GitHub repo, read at build time: the latest release at `/docs`, the
  default branch under `/docs/<branch>`, with a version picker, search and an
  "On this page" outline. New strings under `strings.docs`. See `docs/features.md`.
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
