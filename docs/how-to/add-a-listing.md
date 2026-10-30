# Add a listing

Add a collection shaped to its purpose, such as a news feed, a for-sale catalog or a case-study index, with an editable index page and a page per entry.

1. Declare the listing in `src/site.config.ts`.

   ```ts
   export const listings: Listing[] = [
     { id: 'news', route: '/news', label: 'News', preset: 'article' },
     {
       id: 'boats', route: '/for-sale', label: 'For sale', preset: 'catalog',
       specs: [{ key: 'length', label: 'Length' }, { key: 'year', label: 'Year' }],
       options: { columns: 3, showImages: true, filters: true },
     },
   ];
   ```

2. Run the generator.

   ```bash
   pnpm stomme cms
   ```

   It prints `seeded editable listing index: src/content/pages/for-sale.md (boats)` for each listing whose index page does not exist yet.

3. Open the index page in the CMS, under **Pages**. The seeded page is published, has a page header and the listing's block, and is yours to compose like any other page.
4. Add entries in the listing's own collection in the CMS, or as Markdown files under `src/content/<id>/`.
5. Build. The index answers at `route`, and each entry at `route/<slug>`.

| Field | What it sets |
|---|---|
| `id` | the collection name and its folder, `src/content/<id>/` |
| `route` | the address of the index page and the base of the entry pages |
| `label` | what the collection is called in the CMS |
| `preset` | `article`: date, excerpt, category, cover, `showCover`, event date and time, body. `catalog`: price, status, category, cover, gallery, specs, body |
| `specs` | catalog only: the fact rows an entry carries, besides the preset's fields |
| `options` | `columns`, `showImages`, `featured`, `filters` |

A listing without an `id` or a `route`, or with a `preset` other than `article` or `catalog`, is dropped without a warning: it gets no collection, no CMS editor and no pages. A `route` without a leading `/` gets one.

An `article` listing also gets a calendar feed at `route/calendar.ics`, and works with `postList`, `postArchive` and `eventList`. A `catalog` listing works with `catalogList`. A listing's `category` is picked from a term collection, `<id>-categories`, with one `title` per file.

## Keep specs stable

A spec's `label` is display text only. Its value is stored under `key`, so renaming or translating a label never orphans the entries already written. A spec given as a bare string is keyed by its position (`spec_0`, `spec_1`, …), so reordering bare strings moves the data between rows. Give every spec a `key`.
