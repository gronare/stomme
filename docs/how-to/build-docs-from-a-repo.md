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

- **A page** takes its title from its first `#` heading and its lede from the first paragraph that is more than an image. Every `##` gets an id and a line in "On this page". GitHub-flavoured Markdown renders: tables, fenced code with a copy button, and blockquotes.
- **Links.** A relative link to a `.md` file in the folder becomes the site route and keeps its `#anchor`. A link that leaves the folder goes to the file on GitHub at the version's ref. External links stay as they are.
- **Images** a page embeds are copied into the build and served under `route/_media/`.
- **Search** runs in the browser over a static index per version at `route/_search/<version>.json`. Press `/` to focus it.

## Read from GitHub

The build makes two GitHub API calls, for the repo and its latest release, plus one file list per version, and reads the files from `raw.githubusercontent.com`. Set `GITHUB_TOKEN` in the build's environment for a private repo, or when the build shares an address with many others and could meet GitHub's unauthenticated rate limit. When the source cannot be read, the build fails with a message that names it.

## Write docs locally

Point `STOMME_DOCS_DIR` at a docs folder on disk, or set `site.docs.dir`, and the section is built from that folder as one version, with no network call. Links that leave the folder and the edit links still point at GitHub.

```bash
STOMME_DOCS_DIR=../project/docs pnpm dev
```

The section's interface text lives under `strings.docs`, with English, Swedish and Norwegian built in.
