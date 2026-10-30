# stomme documentation

Start with the tutorial. Use the how-to guides to get something done, the reference for an exact name, and the explanations for why.

## Tutorial

- [Your first site](tutorial.md): scaffold a site, add a page in the CMS with the live preview, and build it.

## How-to guides

Pages and content

- [Connect the CMS](how-to/connect-the-cms.md): work on the files locally, or sign in on the deployed site.
- [Turn on a feature](how-to/turn-on-a-feature.md): a blog, services, areas, testimonials, an FAQ or documents.
- [Add a listing](how-to/add-a-listing.md): a news feed, a for-sale catalog or a case-study index.
- [Translate a site](how-to/translate-a-site.md): pages in more than one language, with hreflang and a switcher.
- [Build docs from a repo](how-to/build-docs-from-a-repo.md): a documentation section from Markdown on GitHub.
- [Store uploads in R2](how-to/store-uploads-in-r2.md): CMS uploads straight to a Cloudflare R2 bucket.
- [Write pages by hand or with an agent](how-to/write-pages-by-hand.md): blocks written straight into the files, checked against the site's catalog.

Design and blocks

- [Theme a site](how-to/theme-a-site.md): colours, dark mode, fonts and your own CSS.
- [Add a custom block](how-to/add-a-custom-block.md): your own block in the renderer, the CMS and the lookbook.
- [Extend from an outside directory](how-to/extend-from-an-outside-directory.md): slots, blocks, collections and routes shared between sites.

Going live

- [Deploy a site](how-to/deploy.md): Netlify, Cloudflare Workers, Vercel, a Node server or a static host.
- [Connect the contact form](how-to/connect-the-contact-form.md): the built-in handler, your own endpoint and the handler contract.
- [Generate share images](how-to/generate-share-images.md): Open Graph cards drawn from each entry's fields.
- [Measure visits](how-to/measure-visits.md): first-party metrics, Cloudflare Web Analytics and consent-gated tags.

## Reference

- [Blocks](reference/blocks.md): every block and its fields.
- [Styles](reference/styles.md): the classes and CSS variables a custom block builds with.
- [Site config](reference/site-config.md): every key of `site`, `features` and `listings`.
- [Content collections](reference/content.md): every collection, its folder and its fields.
- [Commands](reference/commands.md): the site's scripts and the engine's tools.
- [Routes](reference/routes.md): every route the integration injects, and what every page carries.
- [Environment variables](reference/environment.md): what the server, the build and the CMS generator read.
- [Metrics beacons](reference/metrics.md): every body the metrics script sends.
- [Field kit](reference/field-kit.md): the types and helpers for a block's catalog entry.
- [Package exports](reference/exports.md): every import path the engine publishes.

## Explanation

- [How stomme fits together](explanation/how-it-fits-together.md): the catalog, the renderer, the CMS generator and the preview.
- [The block model](explanation/the-block-model.md): why pages are typed blocks with fixed fields.
- [Static first](explanation/static-first.md): what prerenders, and the few routes that run on a server.
