# How stomme fits together

How the catalog, the renderer, the CMS generator and the live preview share one description of every block.

## One catalog describes every block

The catalog in `src/blocks/schema.ts` lists each block's type and its fields. By default it is the library's `defaultBlocks`, and a site adds its own entries beside them. Everything else is generated from it, so a field exists in exactly one place: the CMS form, the block gallery, the lookbook and the manifests all read the catalog.

## The renderer maps a type to a component

A page is data: an ordered list of blocks, each with a `type`. The renderer, `@gronare/stomme/BlockRenderer.astro`, looks the type up in its registry and renders that component with the block's fields as props. A site's own `registry` wins over the library on a clash, which is how a site replaces or extends a block.

The renderer also does the work no block should repeat: it wraps each block in its surface band, pairs blocks placed side by side, adds heading anchors for `sectionNav`, adds breadcrumbs on subpages, rewrites links for the current language, and leaves the contact form out when `contactForm` is off.

## The CMS is generated, not written

`stomme cms` reads the catalog, the site config and the content folders, and writes the Sveltia CMS config between markers in `public/admin/config.yml`. It offers a block only while its collection or feature is on, fills link pickers from the pages that exist, and translates field labels for `cmsLocale`. Text outside the markers stays yours. Because it runs on every `pnpm dev` and `pnpm build`, the CMS never drifts from the catalog.

## The preview renders the real components

The CMS shows each page in an iframe on `/preview`, a route the integration injects. The editor sends the draft into the iframe as a message, and `/preview` renders it through the same renderer and layout as the built site. There is no second set of preview templates to keep in step, so what an editor sees is what the build produces.

## The integration wires it into Astro

`stomme()` in `astro.config.mjs` injects the routes a site's features need, aliases `@stomme/config`, `@stomme/catalog` and `@stomme/renderer` to the site's own files, and mirrors uploads into `src/assets/` for image optimisation. A site carries no route files for the engine's pages, so an engine update reaches them by bumping a version. [Routes](../reference/routes.md) lists what it injects.
