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

With neither option it asks in the terminal, blank by default, and with no terminal it makes the blank site. It runs `git init` in a site outside any repository, then prints the commands to install and start it.

## `stomme-gen`

Writes the parts of `public/admin/config.yml` between its `# >>> …:generated` markers: the backend, the collection editors, the settings and every block the site offers. It also writes `public/admin/stomme-previews.js`, `stomme-editor.js`, `stomme-site.css`, `stomme-theme.css`, the block gallery `blocks.html` and `blocks-manifest.json`, seeds an index page for each new listing and the term collections, and generates `favicon.ico` from `favicon.svg` when it is missing.

Text outside the markers is yours and stays. Run with no `public/admin/config.yml`, it does nothing.

| Variable | What it changes |
|---|---|
| `STOMME_SCHEMA` | the catalog file, default `src/blocks/schema.ts` |
| `STOMME_CONFIG` | the CMS config, default `public/admin/config.yml` |
| `STOMME_SVELTIA_SRC` | the Sveltia CMS script `/admin` loads, default the pinned version on unpkg |

## `stomme-new-block <Name>`

Creates `src/blocks/<Name>.astro` with a heading prop and prints the two registrations it needs. The type is the name in camelCase: `PromoBanner` becomes `promoBanner`. It refuses to overwrite a file. Pass the name straight after the script, `pnpm block:new PromoBanner`, without `--`.

## Engine tools

These work on the engine package itself, reading and writing files inside it.

| Command | What it does |
|---|---|
| `stomme-gen-schema` | writes the package's `schema-manifest.json`, the fields of every collection |
| `stomme-gen-blocks` | writes the package's `blocks-manifest.json`, the fields of every library block |
| `stomme-lint-styles` | fails on a hardcoded colour outside the `:root` token block of the package's `styles.css`; `--update` rewrites its baseline |
| `stomme-lint-comments [dir]` | fails on a `//` comment wrapped over several lines, or one in Swedish, under the directory |
