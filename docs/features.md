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
