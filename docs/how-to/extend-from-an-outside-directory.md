# Extend from an outside directory

Add header and footer content, blocks, collections, CMS editors and routes to one or many sites from a directory that lives outside their repositories.

1. Create the directory and add the files you need from the table below.
2. Point `STOMME_SLOTS_DIR` at it when you run the site.

   ```bash
   STOMME_SLOTS_DIR=../extensions pnpm dev
   ```

3. Read the log. The routes line names each slot that was found as `slot:<name>`, plus every route the directory added, and `cms:gen` lists the blocks it added as `addon blocks`.

A file that is not there changes nothing, and without `STOMME_SLOTS_DIR` the site builds exactly as it would with none of them.

| File | What it adds |
|---|---|
| `header-start.astro`, `header-nav-end.astro`, `header-end.astro` | markup at that place in the header |
| `footer-end.astro`, `footer-legal-end.astro` | markup at that place in the footer |
| `blocks.mjs` | `export const blocks = { type: Component }`, components the renderer dispatches by type |
| `block-catalog.mjs` | `export const BLOCKS = [...]`, catalog entries for those blocks; a type the site's own catalog already has is skipped |
| `collections.mjs` | `export const collections = { … }`, content collections added beside the engine's |
| `cms.mjs` | `export const collections`, a list or a function returning `{ feature, yaml }` entries: CMS editors added when that feature flag is on. `panelFiles` adds files to an existing collection the same way |
| `routes.mjs` | `export const routes`, a list or a function of `{ routes, features }` returning `{ feature, pattern, entrypoint }`: a route injected when that feature flag is on, and under every language prefix on a translated site |
| `preview.astro` | what `/preview?kind=<kind>` renders for a kind the engine does not know, so your CMS editors can preview their own entries |
| `previews.js` | CMS preview templates, copied to `public/admin/stomme-addon-previews.js` and loaded by `/admin` |

An entry in `cms.mjs` or `routes.mjs` without a `feature`, a `pattern` starting with `/` or an existing `entrypoint` is skipped with a warning. A module that fails to load stops the build with its path.
