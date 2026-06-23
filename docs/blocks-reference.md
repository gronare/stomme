# Blocks reference

The built-in library blocks (`stomme/catalog`). Most section blocks also accept
`surface` (`standard` / `tint` / `band`) — the renderer wraps them in a full-bleed
band. Add your own blocks alongside these (see [customizing](customizing.md)).

## Content & layout

| Type | What it renders | Key fields |
|---|---|---|
| `hero` | Headline + intro + dual CTA, with a swappable right slot | `eyebrow`, `heading`, `intro`, `ctaLabel`, `ctaHref`, `media` (`none`/`image`/`flow`/`ops`), `image`/`imageAlt`, `flowNote`/`flow[]`, `telemetry[]`/`stamp` (ops: a dark animated drone/telemetry scene) |
| `pageHeader` | Inner-page title header (light or dark band) | `variant` (`light`/`dark`), `width` (`narrow`/`full`), `eyebrow`, `heading`, `intro`, `ctaLabel`, `ctaHref` |
| `prose` | Rich text from markdown (inline images optimized + placed) | `heading`, `body` (markdown), `width` (`narrow`/`full`) |
| `featureGrid` | Grid of icon + title + text cards | `eyebrow`/`heading`/`intro`, `items[]` (`icon`, `title`, `body`) |
| `pillars` | Columns of title + text (principles / values) | `eyebrow`/`heading`/`intro`, `items[]` (`title`, `body`) |
| `specialistGrid` | Compact title + text grid with a brand top-rule | `eyebrow`/`heading`/`intro`, `items[]` (`title`, `body`) |
| `steps` | A numbered process (bordered rows + badges) | `eyebrow`/`heading`/`intro`, `items[]` (`title`, `body`), `width` (`narrow`/`full`) |
| `checklist` | Ticked list, 1–2 columns | `eyebrow`/`heading`/`intro`, `items[]` (`text`, `note`), `columns` |
| `gallery` | Responsive image grid with captions | `eyebrow`/`heading`/`intro`, `images[]` (`image`, `alt`, `caption`), `columns` |
| `beforeAfter` | Draggable before/after image slider | `eyebrow`/`heading`/`intro`, `before`, `after` |
| `textImage` | Text column beside an image (flippable) | `heading`, `body` (markdown), `image`, `imageAlt`, `flip` |
| `textQuote` | Body text beside a pull quote (flippable) | `body` (markdown), `quote`, `attribution`, `flip` |
| `callout` | Single highlighted statement / quote | `eyebrow`, `quote` |
| `statPanel` | Dark statement panel beside a giant stat number | `eyebrow`, `heading`, `body`, `badges[]`, `statValue`, `statLabel` |

## Calls to action

| Type | What it renders | Key fields |
|---|---|---|
| `ctaPanel` | Full-width accent band with a CTA | `eyebrow`/`heading`/`intro`, `label`, `href` |
| `ctaBox` | Compact brand-colored CTA box | `eyebrow`, `heading`, `label`, `href` |

## Collection-backed

These read a content collection (the site must define it; `cms:gen` hides the block
when it's absent). Chrome fields (`eyebrow`/`heading`/`intro`) are optional.

| Type | Collection | Detail route | Notes |
|---|---|---|---|
| `faq` | `faq` (`question`, `answer`, `order`) | — | Q&A + editable contact aside (`asideHeading`/`asideBody`/`asideCtaLabel`/`asideHref`). `variant`: `list` (default) / `accordion` (native `<details>`) / `cards` / `split` (index + reader, JS-enhanced) |
| `testimonials` | `testimonials` (`name`, `role`, `quote`, `order`) | — | Quote cards |
| `linkChips` | `towns` (`name`, `order`) | `routes.towns` | Chip links to each entry's page |
| `serviceGrid` | `services` (`navLabel`, `summary`, `order`, `image?`) | `routes.services` | Service cards (image, placeholder fallback) → detail page; `services[]` picks/orders a subset |
| `postList` | `posts` (`title`, `date`, `excerpt`) | `routes.blog` | Blog cards; date via `locale`, "read more" via `strings.readMore` |

## Settings-backed (auto)

No fields — they read the `settings` singleton.

| Type | Reads | What it renders |
|---|---|---|
| `statsBar` | `settings.facts[]` (`label`, `value`) | A facts/stats grid |
| `logoStrip` | `settings.partners[]` + `partnersLead` | A row of partner/brand names |
| `contactForm` | `settings.{phone,phoneE164,email,name,hq,orgNr}` | Netlify form + direct-contact aside (success route from `routes.formSuccess`) |

## Chrome (not blocks)

`stomme/Header.astro` and `stomme/Footer.astro` render the site header/footer
from the `navigation`/`footer`/`settings` collections; use them in your `Base`
layout. They accept optional draft props so the CMS chrome previews can render them.

## Page templates (not blocks)

For collection **detail** pages, the package ships two layouts you drop into a route:

- `stomme/TownPage.astro` — rich service-area landing from a `towns` entry (hero /
  why / problems / districts / reason cards / local case / services + JSON-LD). Chrome
  strings come from `strings.town` (`{name}` is interpolated; `heading` is the H1
  template when an entry has no `title`); CTAs link to `routes.contact`.
- `stomme/ServicePage.astro` — service detail from a `services` entry (its markdown
  body becomes the article) + bullets + a quote CTA band. Strings from `strings.service`.

Use them in `src/pages/<route>/[slug].astro`: `getStaticPaths` over the collection,
then `<Base ...><TownPage town={entry} config={kit} /></Base>`. `linkChips`/`serviceGrid`
link into these routes. `cms:gen` auto-creates the CMS editor for any collection it
finds (faq / testimonials / towns / posts / services) — no hand-authored admin sections.
