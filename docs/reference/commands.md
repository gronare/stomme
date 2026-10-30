# Commands

The `stomme` command a site runs, the scripts in a site's `package.json`, the scaffolder that creates a site, and the tools behind them.

## `stomme`

Inside a site, run it through pnpm as `pnpm stomme <command>`. After `npm i -g @gronare/stomme` it runs as `stomme <command>` anywhere, which is how `stomme new` creates a site outside one. With no command, or with `--help`, it lists every command; `stomme help <command>` and `<command> --help` print one.

| Command | What it does |
|---|---|
| `stomme new <directory> [--blank \| --demo]` | creates a site, the same as `pnpm create stomme`; see [`create-stomme`](#create-stomme-directory) |
| `stomme dev` | runs the site's `scripts/dev.mjs` with the options given: the site on `http://localhost:4321`, the CMS at `/admin`, the live preview at `/preview` and every block at `/lookbook`. A site without that script gets `stomme cms`, then `astro dev` |
| `stomme build [--target <target>]` | `stomme cms`, then `astro build`. `--target` (also `--target=<target>` or `-t <target>`) sets `STOMME_TARGET` to `netlify`, `static`, `cloudflare`, `vercel` or `node`; without it the site's own default applies, `netlify` in a new site. Other options go to `astro build` |
| `stomme cms` | regenerates the CMS from the catalog and the site config; see [`stomme-gen`](#stomme-gen) |
| `stomme block new <name>` | scaffolds `src/blocks/<Name>.astro`; see [`stomme-new-block`](#stomme-new-block-name) |
| `stomme lint [content]` | checks the blocks in `src/content/` against the catalog; see [`stomme-lint-content`](#stomme-lint-content) |
| `stomme lint styles` | runs `stomme-lint-styles` on the engine's own stylesheet |
| `stomme lint comments [dir]` | runs `stomme-lint-comments` |
| `stomme --version` | prints the engine version |

An unknown command, target or option of `stomme` itself exits with `2` and the usage; otherwise the exit code is that of the step that failed.

Each command runs a tool that also ships under its own name, so a script or a site that calls the older names keeps working:

| Older name | Same as |
|---|---|
| `stomme-gen` | `stomme cms` |
| `stomme-new-block <Name>` | `stomme block new <Name>` |
| `stomme-lint-content` | `stomme lint content` |
| `stomme-lint-styles` | `stomme lint styles` |
| `stomme-lint-comments` | `stomme lint comments` |
| `create-stomme <directory>` | `stomme new <directory>` |

## Site scripts

| Script | What it runs |
|---|---|
| `pnpm dev` | `node scripts/dev.mjs`: `stomme-gen`, clears Astro's content cache, then `astro dev` with the options given |
| `pnpm dev:web` | `astro dev` alone, without regenerating the CMS |
| `pnpm build` | `stomme build`, for Netlify |
| `pnpm build:cloudflare` | `stomme build --target cloudflare`, for Cloudflare Workers |
| `pnpm build:vercel` | `stomme build --target vercel`; needs `@astrojs/vercel` |
| `pnpm build:node` | `stomme build --target node`, a standalone Node server; needs `@astrojs/node` |
| `pnpm build:static` | `stomme build --target static`, a fully static build with no adapter |
| `pnpm preview` | `pnpm build:static`, then `astro preview` of that build on `http://localhost:4321`: every page, without the server routes such as `/api/contact` |
| `pnpm cms:gen` | `stomme cms` |
| `pnpm block:new <Name>` | `stomme block new <Name>` |
| `pnpm lint:content` | `stomme lint content` |

A host builds with `pnpm build`, or the `build:*` script for its target. See [Deploy a site](../how-to/deploy.md).

## `create-stomme <directory>`

Scaffolds a new site into `<directory>`, which must not exist yet. Run it as `pnpm create stomme <directory>`, `pnpm dlx create-stomme <directory>` or `stomme new <directory>`.

A site made this way depends on the engine from the npm registry, `"@gronare/stomme": "^<version>"`, so no token or registry setting is needed. From a clone of stomme it runs as `node stomme/packages/create-stomme/bin/create.mjs <directory>` and links the site to the engine in the clone instead, for working on the engine.

| Option | What it makes |
|---|---|
| `--blank` | a blank site: a home page with a hero and a text block, a contact page with its form, a thanks page, a neutral theme and placeholder text such as "My site" and `hello@example.com`. Services, testimonials and the FAQ are off, and it carries no photos |
| `--demo` | the Wren & Sorrel demo, a finished site for a fictional garden studio with pages, photos, services, testimonials and FAQs |

It refuses both options at once, and any other option. With neither option it asks in the terminal, blank by default, and with no terminal it makes the blank site. It runs `git init` in a site outside any repository, then prints the commands to install and start it.

## `stomme-gen`

`stomme cms`. Rewrites the regions of `public/admin/config.yml` between its `# >>> <name>:generated` and `# <<< <name>:generated` markers. The names it fills are `blocks` (every block the site offers), `collections` (the collection editors), `settings`, `cms` (the backend), `navlinks`, `footerlinks`, `thanksbuttons` and `tracking`. Outside the markers it also sets `media_folder` and `public_folder` and each collection's media folders, adds `media_libraries`, `output.omit_empty_optional_fields` and the rich-text `editor_components` when they are missing, and translates the field labels into `cmsLocale`.

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

`stomme block new <Name>`. Creates `src/blocks/<Name>.astro` with a heading prop and prints the two registrations it needs. The file name is the name in PascalCase and the type the same in camelCase, with anything other than letters and digits taken as a word break: `PromoBanner`, `promo banner` and `promo-banner` all make `PromoBanner.astro` with the type `promoBanner`. The name must start with a letter, and a `--` before it is ignored. It refuses to overwrite a file.

## `stomme-lint-content`

`stomme lint content`. Reads the `blocks:` list of every `src/content/**/*.md` against the site's catalog, `src/blocks/schema.ts` plus the blocks of `STOMME_SLOTS_DIR`, and prints by file, line and block:

| Finding | When |
|---|---|
| an unknown field | the block, one of its groups or a list item holds a key the catalog does not declare; `type` and `anchor` are allowed on every block |
| an older field | the key is a renamed field from the package's `block-migrations.json`, which still renders through a back-compat shim |
| an unknown block | the block's `type` is not in the catalog |

| Option | What it does |
|---|---|
| `--json` | prints `{ files, counts }`: each file with its blocks, each block with its line and findings |
| `--strict` | exits with `1` when anything is reported; without it the exit code is `0` |

It never writes a file. A site without `src/blocks/schema.ts` is checked against the engine's catalog. `stomme-gen` runs the same check and prints one line with the counts when there is anything to report. See [Write pages by hand or with an agent](../how-to/write-pages-by-hand.md).

## Engine tools

These work on the engine package itself, reading and writing files inside it. They, and the scripts in the engine's own `package.json`, are for people working on stomme, not for a site.

| Command | What it does |
|---|---|
| `stomme-gen-schema` | writes the package's `schema-manifest.json`, the fields of every collection |
| `stomme-gen-blocks` | writes the package's `blocks-manifest.json`, the fields of every library block |
| `stomme-lint-styles` | fails on a hardcoded colour outside the `:root` token block of the package's `styles.css`; `--update` rewrites its baseline |
| `stomme-lint-comments [dir]` | fails on a `//` comment wrapped over several lines, or one in Swedish, under the directory |
