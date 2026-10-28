# Turn on a feature

Switch on a blog, services, service areas, testimonials, an FAQ or documents, each with its CMS editor, blocks and pages.

1. Set the flag in `src/site.config.ts`.

   ```ts
   export const features: StommeFeatures = {
     blog: true,
     faq: true,
   };
   ```

2. Run the generator, or restart `pnpm dev`, which runs it.

   ```bash
   pnpm cms:gen
   ```

3. Add entries in the CMS, or as Markdown files under `src/content/<collection>/`.
4. Place the feature's block on a page. Its entries show there, and for a feature with pages, each entry gets its own address.

| Flag | Collection | Blocks | Pages |
|---|---|---|---|
| `blog` | `posts` | `postList`, `postArchive`, `eventList` | `/<routes.blog>/<slug>`, `/<routes.blog>/calendar.ics` |
| `services` | `services` | `serviceGrid` | `/<routes.services>/<slug>` |
| `areas` | `towns` | `linkChips` | `/<routes.towns>/<slug>` |
| `testimonials` | `testimonials` | `testimonials` | none |
| `faq` | `faq` | `faq` | none |
| `documents` | `documents` | `documentList` | none |
| `tracking` | `tracking` | none | none; see [Measure visits](measure-visits.md) |
| `docs` | none | none | a docs section; see [Build docs from a repo](build-docs-from-a-repo.md) |

A flag left out is off, so a feature added to the engine stays off until you turn it on. Two flags are on unless you set them to `false`: `pages`, the editable pages, and `contactForm`, the contact form blocks.

The route prefixes come from `routes` in the site config, defaulting to `/blog`, `/services` and `/areas`. Every collection is defined whether its flag is on or not, so a flag never breaks a build. [Site config](../reference/site-config.md) has every key.

## Publish events from the blog

A post with an `eventDate` is also an event.

```yaml
# src/content/posts/open-day.md
title: Open day
date: 2026-10-01
eventDate: 2026-12-01
eventTime: "10:00"
excerpt: Come and see the workshop.
```

`postList` shows its event date in place of the publish date, `eventList` lists it while it is upcoming, and `/blog/calendar.ics` carries it as a `VEVENT` a reader can subscribe to from a calendar app.
