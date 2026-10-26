# Features

## Optional collections

Optional capabilities are **feature flags** in `src/site.config.ts` — flip one to
`true` and its content collection, CMS editor, block(s), and detail route all switch
on. A flag that's missing (or the whole `features` object) is **false**, so new engine
features never appear until you opt in.

```ts
// src/site.config.ts
export const features: StommeFeatures = {
  blog: true,          // posts collection + /<routes.blog>/[slug] + postList + eventList blocks + /<routes.blog>/calendar.ics
  areas: true,         // towns collection + /<routes.towns>/[slug] + linkChips + TownPage
  services: false,     // services collection + /<routes.services>/[slug] + serviceGrid + ServicePage
  testimonials: true,  // testimonials collection + testimonials block (no route)
  faq: true,           // faq collection + faq block (no route)
  documents: true,     // documents collection + documentList block (no route)
};
```

| Feature | Collection | Block | Detail route |
|---|---|---|---|
| `blog` | `posts` | `postList`, `eventList` | `/<routes.blog>/[slug]`, `/<routes.blog>/calendar.ics` |
| `areas` | `towns` | `linkChips` | `/<routes.towns>/[slug]` |
| `services` | `services` | `serviceGrid` | `/<routes.services>/[slug]` |
| `testimonials` | `testimonials` | `testimonials` | — |
| `faq` | `faq` | `faq` | — |
| `documents` | `documents` | `documentList` | — |

How it works (set up once by the scaffold; you only edit the flags afterwards):

1. **Collections** — `src/content.config.ts` is `export const collections = { ...stommeCollections(listings), ...stommeAddonCollections() }`. All collections are always defined (empty until you add content), so nothing errors when a feature is off.
2. **Routes** — `astro.config.mjs` runs `stomme({ features, routes: kit.routes })`, which **injects** the detail route for each enabled, route-backed feature (rendered inside your own `Base` layout). No per-site route files.
3. **Admin + blocks** — `cms:gen` reads `features` and emits the CMS editor + un-gates the block only for enabled features.

So to add a blog: set `blog: true`, run `pnpm dev` (or `cms:gen`), and add posts in the CMS — no code. (Detail-route prefixes come from `kit.routes`.)

A post that carries an `eventDate` is also an event: it shows that date instead of
its publish date in `postList`, lists itself in `eventList`, and gets a `VEVENT` in
that listing's calendar feed, which a reader can subscribe to from their own calendar
app. Every `article` listing gets one at `<listing route>/calendar.ics` — the blog's
is at `/<routes.blog>/calendar.ics`.

## Listings — a blog you shape to its purpose

A listing is the blog pattern with the wording, fields and layout set by you: a
news feed, a for-sale catalog, a case-study index. Same machinery as `blog` — a
collection, a CMS editor, an index page and detail pages — but you declare how
many, what they are called and what an entry holds.

```ts
// src/site.config.ts
export const listings: Listing[] = [
  { id: 'news', route: '/news', label: 'News', preset: 'article' },
  { id: 'boats', route: '/for-sale', label: 'For sale', preset: 'catalog',
    specs: [{ key: 'length', label: 'Length' }, { key: 'year', label: 'Year' }],
    options: { columns: 3, showImages: true, filters: true } },
];
```

Each entry gives you:

- a CMS collection at `src/content/<id>/`, with its own editor
- an **editable index page** at `route` — seeded once as an ordinary page in
  `src/content/pages/`, so it opens in the CMS like any other and is yours to compose
- detail pages at `route/<slug>`

| Field | |
|---|---|
| `id` | collection name and content folder |
| `route` | URL base for the index and the detail pages |
| `label` | what the collection is called in the CMS |
| `preset` | `article` — date, excerpt, cover, `showCover`, body · `catalog` — price, status, category, cover, gallery, body |
| `specs` | catalog only: the fact rows an entry carries, on top of the preset's fields |
| `options` | `columns`, `showImages`, `featured`, `filters` |

**A spec label is display text only.** The value is stored under a stable key, so
renaming a label — or translating it — never orphans the entries already written.
Give each spec an explicit `key` and you can reorder and relabel freely; a bare
string spec keys off its position instead, and reordering those does move data.

Listings are wired the same way features are: `stommeCollections(listings)` in
`src/content.config.ts` defines the collections, and the integration injects the
index and detail routes. Nothing to create under `src/pages/`.

## Docs — a documentation section from a repo

`docs` builds a documentation section from a folder of Markdown in a GitHub repo,
read when the site is built. The pages are not content collections, so nothing about
them is editable in the CMS: the repo is the source.

```ts
// src/site.config.ts
export const features: StommeFeatures = { docs: true };

export const site: SiteConfig = {
  // …
  docs: { repo: 'owner/project', path: 'docs', route: '/docs' },
};
```

| Field | Default | |
|---|---|---|
| `repo` | — | `owner/name` on GitHub. Required unless `dir` is set. |
| `path` | `docs` | the folder in the repo that holds the Markdown |
| `route` | `/docs` | where the section is served |
| `branch` | the repo's default branch | the unreleased version |
| `dir` | — | a folder on disk to build from instead of GitHub |

Two versions are built. The repo's latest GitHub release is served at `route`, and
`branch` under `route/<branch>` (`/docs/main`). A version picker switches between
them and stays on the same page when that page exists in both. A repo with no release
gets one version, the branch, at `route`.

### How the folder is read

- **`README.md` is the nav and the docs home.** Its `#` heading is the title and its
  first paragraph the lede. Each `##` is a section. A plain paragraph inside a section
  names the group the list under it belongs to. Each list item
  `[Title](path.md): one-line description` is a page, and the order of the items is
  the reading order that previous and next follow.

  ```md
  # Project documentation

  Start with the tutorial.

  ## How-to guides

  Everyday work

  - [Run a job](how-to/run-a-job.md): start, watch and stop a job.
  ```

- **A page** takes its title from its first `#` heading and its lede from the first
  paragraph that is more than an image. Every `##` gets an id and a line in
  "On this page". GitHub-flavoured Markdown renders: tables, fenced code (with a copy
  button), blockquotes.
- **Links.** A relative link to a `.md` file in the folder becomes the site route,
  keeping its `#anchor`. A link that leaves the folder goes to the file on GitHub at
  the version's ref. External links are left as they are.
- **Images** a page embeds are copied into the build and served from the site under
  `route/_media/`.
- **Search** runs in the browser over a static index built per version at
  `route/_search/<version>.json`. `/` focuses it.

### Reading from GitHub

The build makes two GitHub API calls (the repo and its latest release) plus one file
list per version, and reads the files themselves from `raw.githubusercontent.com`.
Set `GITHUB_TOKEN` in the build's environment for a private repo, or when the build
shares an address with many others and could meet GitHub's unauthenticated rate limit.
When the source cannot be read, the build fails with a message that names it.

### Writing docs locally

Point `STOMME_DOCS_DIR` at a docs folder on disk (or set `site.docs.dir`, relative to
the site) and the section is built from that folder as one version, without a network
call. Links that leave the folder and the edit links still point at GitHub.

```sh
STOMME_DOCS_DIR=../project/docs pnpm dev
```

The UI strings live under `strings.docs` (English, Swedish and Norwegian ship). Add
`route/<branch>` to `site.noindex` to keep the unreleased version out of search engines.
