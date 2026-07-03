# Changelog

Engine changes that affect consuming sites. Sites follow the `release` branch
(or pin a SHA); entries here mark anything a site operator should know before
taking a new release. Field policy: new fields are opt-in — absent from the
frontmatter means disabled/not shown (see `src/kit.ts`).

## Unreleased

- First public release: AGPL-3.0-only license, public quickstart, `/api/contact`
  injected by the integration on adapter builds (a site's own physical route
  still wins; `static` builds skip it).
