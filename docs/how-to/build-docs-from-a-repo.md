# Build docs from a repo

Serve a documentation section built from a folder of Markdown in a GitHub repository, with versions, search and an outline per page.

1. Turn the feature on and name the repository in `src/site.config.ts`.

   ```ts
   export const features: StommeFeatures = { docs: true };

   export const site: SiteConfig = {
     docs: { repo: 'owner/project', path: 'docs', route: '/docs' },
   };
   ```

2. Write the folder's `README.md` as the map of the section, in the shape [below](#how-the-folder-is-read).
3. Build. The log lists the docs routes and where they were read from, and the section answers at `/docs`.

The pages are read at build time and are not content collections, so the CMS does not edit them: the repository is the source.

| Field | Default | What it sets |
|---|---|---|
| `repo` | none | `owner/name` on GitHub; required unless `dir` is set |
| `path` | `docs` | the folder in the repo that holds the Markdown |
| `route` | `/docs` | where the section is served |
| `branch` | the repo's default branch | the unreleased version |
| `dir` | none | a folder on disk to build from, relative to the site, instead of GitHub |
| `blocks` | `false` | also publish the engine's block catalog at `route/blocks.json`, for docs about stomme itself |

## Versions

The repo's latest GitHub release is served at `route`, and `branch` under `route/<branch>`, for example `/docs/main`. A version picker switches between them and stays on the same page when it exists in both. A repo with no release gets one version, the branch, at `route`.

To keep the unreleased version out of search engines, add `route/<branch>` to `site.noindex`.

## How the folder is read

- **`README.md` is the nav and the docs home.** Its `#` heading is the title and its first paragraph the lede. Each `##` is a section. A plain paragraph inside a section names the group for the list under it. Each list item `[Title](path.md): one-line description` is a page, and the order of the items is the reading order that previous and next follow.

  ```md
  # Project documentation

  Start with the tutorial.

  ## How-to guides

  Everyday work

  - [Run a job](how-to/run-a-job.md): start, watch and stop a job.
  ```

  Each section gets a card on the docs home. A heading that starts with `How-to`, `Reference` or `Explanation` gets that kind's wording and a page count, and a `Tutorial` section's card leads straight to its first page.

- **Every `.md` file** in the folder and its subfolders is published as a page and indexed for search, whether `README.md` lists it or not. Only a listed page is in the nav and the previous and next order, so delete or move a file you do not want served. On a local `dir`, files and folders whose name starts with `.` and `node_modules` are left out.
- **A page** takes its title from its first `#` heading and its lede from the first paragraph that is more than an image. Every `##` gets an id and a line in "On this page". GitHub-flavoured Markdown renders: tables, fenced code with a copy button, and blockquotes. A fence can also show its result, see [Show live examples](#show-live-examples).
- **Links.** A relative link to a `.md` file in the folder becomes the site route and keeps its `#anchor`. A link that leaves the folder goes to the file on GitHub at the version's ref. External links stay as they are.
- **Images** a page embeds are copied into the build and served under `route/_media/`.
- **Search** runs in the browser over a static index per version at `route/_search/<version>.json`. Press `/` to focus it.

## Show live examples

A fenced code block can render its result above the code, the way a CSS framework's docs show each component. Mark it with a second word after the language:

- **`yaml block`** holds one block, or a list of blocks, exactly as a page's frontmatter writes them; a page-shaped `blocks:` list works too. The site's own renderer draws them in the site's theme, custom blocks included, so the example looks the way it does on a page.
- **`html preview`** holds markup that uses the engine's classes, and it is inserted as written. The repo is one you name in the site config, so its HTML is trusted like the rest of the site.

````md
```yaml block
type: callout
quote: If a plant we put in dies in its *first year*, we replace it.
```

```html preview
<a class="btn" href="/contact">Book a garden visit</a>
```
````

Each example sits in a framed box on the page's paper colour, with the code and its copy button underneath. GitHub ignores the second word, so the same file reads there as ordinary highlighted code.

- **Images and video** in a block example can be paths relative to the Markdown file, like `../assets/garden.webp`. A file inside the docs folder is copied into the build and served under `route/_media/`; one outside it is read from GitHub at the version's ref. Other values, such as `/media/…`, are left as written.
- **When an example cannot be drawn**, because its YAML does not parse or it is not a block with a `type`, the page shows its code under a short notice and the build log names the file and the reason. The build goes on. A block type the site does not have renders the renderer's own "Unknown block" line.
- **Search** indexes an example once, from its code.

Blocks that read a collection, such as `faq` or `postList`, show that site's entries, so an example of them is clearest as plain `yaml` with no preview.

## Files for AI agents

Every build also writes the section as plain text, so an AI agent can read it without the HTML:

- **`route/llms.txt`** follows [llms.txt](https://llmstxt.org): the README title, its lede as the summary, a line naming the version, then a `##` section per README section with a link to each page as Markdown and its description from the README, or the page's lede when the README gives none. A page the README does not list goes under `## Optional`. The links are absolute when the site's `site` URL is set in `astro.config.mjs`.
- **`route/llms-full.txt`** is every page's Markdown in one file, the README first and the rest in reading order, each under a `Source:` line with its path in the repo and its address.
- **`route/<page>.md`** is each page as Markdown, next to its HTML at `route/<page>/`, and `route/index.md` the home. The page's links point at the other pages' Markdown, a link out of the folder at GitHub and an image at its copy under `route/_media/`. Fences, `yaml block` examples included, stay as written. Each docs page links its Markdown with `<link rel="alternate" type="text/markdown">`.
- **`route/blocks.json`**, with `blocks: true`, is the block catalog of the engine the site builds with: each block's type, label, group, summary and samples, and each field's widget, default, options and hint.

The files describe the version at `route`; each other version has its own `llms.txt`, `llms-full.txt` and pages under its prefix, and the `llms.txt` files link each other. A site with no `src/pages/llms.txt.*` and no `public/llms.txt` also gets a copy of `route/llms.txt` at `/llms.txt`. See [Use stomme with an AI agent](use-an-ai-agent.md).

## Read from GitHub

The build makes two GitHub API calls, for the repo and its latest release, plus one file list per version, and reads the files from `raw.githubusercontent.com`. Set `GITHUB_TOKEN` in the build's environment for a private repo, or when the build shares an address with many others and could meet GitHub's unauthenticated rate limit. When the source cannot be read, the build fails with a message that names it.

## Write docs locally

Point `STOMME_DOCS_DIR` at a docs folder on disk, or set `site.docs.dir`, and the section is built from that folder as one version, with no network call. Links that leave the folder and the edit links still point at GitHub.

```bash
STOMME_DOCS_DIR=../project/docs pnpm dev
```

The section's interface text lives under `strings.docs`, with English, Swedish and Norwegian built in.
