# Changelog

Engine changes that affect consuming sites. Sites follow the `release` branch
(or pin a SHA); entries here mark anything a site operator should know before
taking a new release. Field policy: new fields are opt-in — absent from the
frontmatter means disabled/not shown (see `src/kit.ts`).

## Unreleased

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
