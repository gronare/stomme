# Commands

Every script in a site's `package.json`, the scaffolder that creates a site, and the command-line tools the engine package ships.

## Site scripts

| Script | What it runs |
|---|---|
| `pnpm dev` | `stomme-gen`, clears Astro's content cache, then `astro dev`: the site on `http://localhost:4321`, the CMS at `/admin`, the live preview at `/preview` and every block at `/lookbook` |
| `pnpm dev:web` | `astro dev` alone, without regenerating the CMS |
| `pnpm build` | `stomme-gen` then `astro build`, for Netlify |
| `pnpm build:cloudflare` | the build for Cloudflare Workers |
| `pnpm build:vercel` | the build for Vercel; needs `@astrojs/vercel` |
| `pnpm build:node` | the build for a standalone Node server; needs `@astrojs/node` |
| `pnpm build:static` | a fully static build with no adapter |
| `pnpm preview` | `pnpm build:static`, then `astro preview` of that build on `http://localhost:4321`: every page, without the server routes such as `/api/contact` |
| `pnpm cms:gen` | `stomme-gen`, regenerates the CMS from the catalog and the site config |
| `pnpm block:new <Name>` | `stomme-new-block`, scaffolds `src/blocks/<Name>.astro` |

Each `build:*` script sets `STOMME_TARGET` and runs `pnpm build`. See [Deploy a site](../how-to/deploy.md).

## `create-stomme <directory>`

Scaffolds a new site into `<directory>`, which must not exist yet. From a clone of stomme it runs as `node stomme/packages/create-stomme/bin/create.mjs <directory>` and links the site to the engine in the clone.

| Option | What it makes |
|---|---|
| `--blank` | a blank site: a home page with a hero and a text block, a contact page with its form, a thanks page, a neutral theme and placeholder text such as "My site" and `hello@example.com`. Services, testimonials and the FAQ are off, and it carries no photos |
| `--demo` | the Wren & Sorrel demo, a finished site for a fictional garden studio with pages, photos, services, testimonials and FAQs |

It refuses both options at once, and any other option. With neither option it asks in the terminal, blank by default, and with no terminal it makes the blank site. It runs `git init` in a site outside any repository, then prints the commands to install and start it.

## `stomme-gen`

Rewrites the regions of `public/admin/config.yml` between its `# >>> <name>:generated` and `# <<< <name>:generated` markers. The names it fills are `blocks` (every block the site offers), `collections` (the collection editors), `settings`, `cms` (the backend), `navlinks`, `footerlinks`, `thanksbuttons` and `tracking`. Outside the markers it also sets `media_folder` and `public_folder` and each collection's media folders, adds `media_libraries`, `output.omit_empty_optional_fields` and the rich-text `editor_components` when they are missing, and translates the field labels into `cmsLocale`.

It writes these files, each one replaced on every run:

| File | What it holds |
|---|---|
| `public/admin/index.html` | the pinned Sveltia script tag, the editor script, the `stomme-auth:generated` and `stomme-theme:generated` regions, and the addon previews tag when there are addon previews |
| `public/admin/stomme-previews.js` | the live previews of every block and listing |
| `public/admin/stomme-editor.js` | the editor additions to the CMS |
| `public/admin/stomme-addon-previews.js` | the addon previews, copied from `STOMME_SLOTS_DIR`, and removed when there are none |
| `public/admin/stomme-site.css` | the site's `global.css` with the engine styles and the `theme.md` colours, for the previews |
| `public/admin/stomme-theme.css` | the look of the CMS itself |
| `public/admin/blocks.html` | the block gallery |
| `public/admin/blocks-manifest.json` | the fields of the site's own blocks and of library blocks it changed |
| `public/images/` | the engine's default images |

It only creates these, and never overwrites them: an index page under `src/content/pages/` for each listing, an entry for each term collection value, and `public/favicon.ico` from `public/favicon.svg`.

Text outside the markers is yours and stays. Run with no `public/admin/config.yml`, it does nothing; a config with no markers at all stops it with an error.

| Variable | What it changes |
|---|---|
| `STOMME_SCHEMA` | the catalog file, default `src/blocks/schema.ts` |
| `STOMME_CONFIG` | the CMS config, default `public/admin/config.yml` |
| `STOMME_SVELTIA_SRC` | the Sveltia CMS script `/admin` loads, default the pinned version on unpkg |
| `STOMME_SLOTS_DIR` | an [outside directory](../how-to/extend-from-an-outside-directory.md) whose blocks, CMS editors and previews it adds |

## `stomme-new-block <Name>`

Creates `src/blocks/<Name>.astro` with a heading prop and prints the two registrations it needs. The file name is the name in PascalCase and the type the same in camelCase, with anything other than letters and digits taken as a word break: `PromoBanner`, `promo banner` and `promo-banner` all make `PromoBanner.astro` with the type `promoBanner`. The name must start with a letter, and a `--` before it is ignored. It refuses to overwrite a file.

## Engine tools

These work on the engine package itself, reading and writing files inside it. They, and the scripts in the engine's own `package.json`, are for people working on stomme, not for a site.

| Command | What it does |
|---|---|
| `stomme-gen-schema` | writes the package's `schema-manifest.json`, the fields of every collection |
| `stomme-gen-blocks` | writes the package's `blocks-manifest.json`, the fields of every library block |
| `stomme-lint-styles` | fails on a hardcoded colour outside the `:root` token block of the package's `styles.css`; `--update` rewrites its baseline |
| `stomme-lint-comments [dir]` | fails on a `//` comment wrapped over several lines, or one in Swedish, under the directory |
