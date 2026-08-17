# Customizing

## Theming (recolor)

The library ships `@gronare/stomme/styles.css` — design tokens (CSS variables) plus all
component classes. A site imports it once and overrides the variables.

```css
/* src/styles/global.css */
@import "@gronare/stomme/styles.css";

:root {
  --color-brand: #533563;
  --color-ink: #2e2e34;
  --color-surface: #c3a7c8;
  --color-line: #dbdbdb;
  --color-highlight: #ec880f;
  /* --color-brand-press, --color-on-dark, --color-paper, --color-muted … */
}
```

Two ways to set the palette:

- **Static** — the `:root` block above (compile-time defaults).
- **Editor-managed** — the `theme` content collection. `Base.astro` reads it and
  injects the tokens onto `<html>` at runtime, so a client can recolor from `/admin`.

To restyle a component, just write your own rule after the import — the library
classes are plain and overridable (no `!important`, no scoped-style fights).

## Per-site config (routes / locale / strings)

Collection-backed blocks build links, format dates and take their fixed wording from
a config object you pass to the renderer. Define it once:

```ts
// src/site.config.ts
import type { SiteConfig } from '@gronare/stomme/config';
export const site: SiteConfig = {
  routes: { towns: '/orter', blog: '/blogg', formSuccess: '/tack' },
  locale: 'sv-SE',
  cmsLocale: 'sv',
  strings: { readMore: 'Läs mer' },
};
```

Pass it through your `BlockRenderer` wrapper (see below). Defaults are neutral
English, so a site only sets what differs. **A route prefix must match the actual
route folder** under `src/pages/` (e.g. `routes.blog: '/blogg'` ⇒
`src/pages/blogg/[slug].astro`).

### The two locale fields

- **`locale`** — the site's language + region (BCP47). Drives date and number formatting
  *and* the language of the engine's built-in public strings (`sv` and `en` shipped, any
  other language falls back to English). Your own `strings` override individual phrases.
  It is the site-language switch, not formatting-only.
- **`cmsLocale`** — the language of the `/admin` **field labels**, and nothing on the public
  site. Baked into `public/admin/config.yml` by `stomme-gen`, so re-run `pnpm cms:gen` after
  changing it. Sveltia's own chrome follows the browser.

## Adding a custom block

1. Scaffold the component: `pnpm block:new -- PromoBanner` → `src/blocks/PromoBanner.astro`.
   Build its markup with the library classes (`.section`, `.display`, `.card`, …)
   or its own scoped `<style>`; theme via the CSS variables.
2. Register it + your config in a thin site renderer that wraps the engine's:

   ```astro
   ---
   // src/blocks/BlockRenderer.astro
   import Engine from '@gronare/stomme/BlockRenderer.astro';
   import PromoBanner from './PromoBanner.astro';
   import { kit } from '../site.config';
   const { blocks = [] } = Astro.props;
   ---
   <Engine blocks={blocks} registry={{ promoBanner: PromoBanner }} config={kit} />
   ```

   Pages import this wrapper. Custom types win over library types on key clash.
3. Add its fields to the catalog and regenerate the CMS:

   ```ts
   // src/blocks/schema.ts
   import { defaultBlocks } from '@gronare/stomme/catalog';
   import { headingFields, type BlockDef } from '@gronare/stomme/kit';
   export const BLOCKS: BlockDef[] = [
     ...defaultBlocks,
     { type: 'promoBanner', label: 'Promo banner', fields: [...headingFields] },
   ];
   ```
   Then `pnpm cms:gen`.

## Overriding a default block

Registering a component under a built-in key (e.g. `hero`) replaces the engine's
version for that type — custom keys win on clash. Use this for site-specific
functionality the core shouldn't carry (a domain hero media, a bespoke card, …).

To extend rather than replace, delegate the cases you don't handle back to the
engine block. A branded site typically does exactly this — it adds a
hero media (an energy-flow diagram / a drone scene) and pass everything else through:

```astro
---
// src/blocks/Hero.astro
import EngineHero from '@gronare/stomme/blocks/Hero.astro';
import { resolveLink } from '@gronare/stomme/href';
import Icon from '@gronare/stomme/Icon.astro';
const props = Astro.props;
---
{props.media === 'flow'
  ? (/* render the hero shell (.hero-grid) + your custom media */)
  : <EngineHero {...props} />}
```

```astro
---
// src/blocks/BlockRenderer.astro — register it over the engine hero
import Engine from '@gronare/stomme/BlockRenderer.astro';
import Hero from './Hero.astro';
import { site, listings } from '../site.config';
const { blocks = [] } = Astro.props;
---
<Engine blocks={blocks} registry={{ hero: Hero }} config={{ ...site, listings }} />
```

A custom media *value* (like `flow`) renders from content immediately. To expose it
as a choice in the CMS, add it to the hero's `media` options in `src/blocks/schema.ts`
and re-run `pnpm cms:gen`. Put any styles in `src/styles/global.css` (it loads after
the library, so it wins).

## Features (optional collections)

Optional capabilities are **feature flags** in `src/site.config.ts` — flip one to
`true` and its content collection, CMS editor, block(s), and detail route all switch
on. A flag that's missing (or the whole `features` object) is **false**, so new engine
features never appear until you opt in.

```ts
// src/site.config.ts
export const features: StommeFeatures = {
  blog: true,          // posts collection + /<routes.blog>/[slug] + postList block
  areas: true,         // towns collection + /<routes.towns>/[slug] + linkChips + TownPage
  services: false,     // services collection + /<routes.services>/[slug] + serviceGrid + ServicePage
  testimonials: true,  // testimonials collection + testimonials block (no route)
  faq: true,           // faq collection + faq block (no route)
};
```

| Feature | Collection | Block | Detail route |
|---|---|---|---|
| `blog` | `posts` | `postList` | `/<routes.blog>/[slug]` |
| `areas` | `towns` | `linkChips` | `/<routes.towns>/[slug]` |
| `services` | `services` | `serviceGrid` | `/<routes.services>/[slug]` |
| `testimonials` | `testimonials` | `testimonials` | — |
| `faq` | `faq` | `faq` | — |

How it works (set up once by the scaffold; you only edit the flags afterwards):

1. **Collections** — `src/content.config.ts` is `export const collections = { ...stommeCollections() }`. All collections are always defined (empty until you add content), so nothing errors when a feature is off.
2. **Routes** — `astro.config.mjs` runs `stomme({ features, routes: kit.routes })`, which **injects** the detail route for each enabled, route-backed feature (rendered inside your own `Base` layout). No per-site route files.
3. **Admin + blocks** — `cms:gen` reads `features` and emits the CMS editor + un-gates the block only for enabled features.

So to add a blog: set `blog: true`, run `pnpm dev` (or `cms:gen`), and add posts in the CMS — no code. (Detail-route prefixes come from `kit.routes`.)

## Images

CMS images go through Astro's pipeline: uploads land in `src/assets/uploads` and
render optimized. Use `@gronare/stomme/Cover.astro` for structured image fields, and
`@gronare/stomme/markdown` (`renderMarkdown`) for markdown bodies — it optimizes inline
`![]()` images and lays them out from a title keyword (`"left"`/`"right"`/`"wide"`
+ `"small"`/`"large"`). The CMS "Image" button (registered by the engine previews)
writes that markdown for editors. Never write a raw `<img src={cmsValue}>`.

## Admin previews

`stomme-gen` copies the engine's `stomme-previews.js` into `public/admin/` —
a live page preview (real components via `/preview`) plus rich mockups for
testimonials/faq/posts/theme/nav/footer/settings. Add or override per-site previews
in `public/admin/previews.js` (loaded after the engine's): re-register a name to
override, or add bespoke previews for your own collections (e.g. a `towns` mockup).

## The contact form's handler

The form is a plain `<form method="POST">` that also submits over `fetch` when JavaScript
runs. Where it posts is a seam — you can use the built-in handler, host your own, or replace
the engine's route entirely.

**1. Use the built-in handler.** On an adapter build the engine injects `/api/contact` and
sends mail through Resend. Set `RESEND_API_KEY`, `CONTACT_FROM` (on a Resend-verified
domain) and `CONTACT_TO` in the site's environment. Nothing else to configure.

**2. Point the form somewhere else.** Set `contact.endpoint` in `site.config.ts` and the
form posts to `<endpoint>/contact` instead. Any host works — a Worker, a Lambda, a form
service — as long as it satisfies the contract below.

```ts
export const site: SiteConfig = {
  contact: { endpoint: 'https://forms.example.com' },
};
```

**3. Ship your own route.** Create `src/pages/api/contact.ts` and the engine detects it and
does not inject its own, so there is no duplicate route. You get the same URL with your code
behind it.

### The contract a handler must satisfy

The form POSTs `multipart/form-data` with these fields:

| Field | |
|---|---|
| `name`, `email`, `phone`, `message` | the visitor's input; `phone` only when the block enables it |
| `bot-field` | honeypot — if it is non-empty, respond 200 and discard silently, do not tell the bot |
| `_success` | the path to redirect a no-JavaScript submit to, taken from `routes.formSuccess` |

Respond one of two ways, chosen by the request:

- **JSON** when `Accept` includes `application/json` or `X-Requested-With: fetch` — the
  JavaScript path reads `{ ok: true }` and renders the confirmation inline.
- **303 to `_success`** otherwise — the no-JavaScript path. Honour `_success`; a hardcoded
  `/thanks` breaks every site that renamed its success page.

A static build (`build:static`) has no server, so `/api/contact` is not injected there — a
static site needs `contact.endpoint`.
