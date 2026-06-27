# Blocks reference

The built-in library blocks (`stomme/catalog`). Most section blocks accept
`surface` (`standard` / `tint` / `band` / `dark` / `gradient`) — the renderer wraps
them in a full-bleed band. Several also accept `accent` (`brand` / `secondary` /
`highlight`), which colours that block's rule/icon/number (not the eyebrow — that
follows `theme.eyebrowColor`). Add your own blocks alongside these (see
[customizing](customizing.md)).

## Content & layout

| Type | What it renders | Key fields |
|---|---|---|
| `hero` | Headline + intro + CTA, with a swappable right-side media slot | `eyebrow`, `heading`, `intro`, `ctaLabel`, `ctaHref`, `media` (`none`/`image`/`highlights`/`motif`), `image`/`imageAlt`, `highlights[]` (`icon`,`title`,`body`), `height` (`normal`/`tall`), `align` (`top`/`center`/`bottom`) |
| `cover` | Full-bleed banner with overlaid text + up to two CTAs | `eyebrow`, `heading`, `intro`, `ctaLabel`/`ctaHref`, `cta2Label`/`cta2Href`, `media` (`image`/`video`/`gradient`/`animated`), `image` (also the video poster), `imageAlt`, `video`/`videoUrl`, `overlay` (`light`/`medium`/`strong`), `align` (`start`/`center`), `height` (`tall`/`medium`) |
| `pageHeader` | Inner-page title header (light band or grey "Band") | `variant` (`light`/`dark`), `width` (`narrow`/`full`), `eyebrow`, `heading`, `intro`, `ctaLabel`, `ctaHref` |
| `prose` | Rich text from markdown (inline images optimized + placed) | `heading`, `body` (markdown), `width` (`narrow`/`full`) |
| `featureGrid` | Grid of icon + title + text cards (cards can link) | `eyebrow`/`heading`/`intro`, `items[]` (`icon`, `title`, `body`, `link`, `linkLabel`), `numbered`, `accent` |
| `pillars` | Columns of title + text (principles / values) | `eyebrow`/`heading`/`intro`, `items[]` (`title`, `body`) |
| `specialistGrid` | Compact title + text grid with a brand top-rule | `eyebrow`/`heading`/`intro`, `items[]` (`title`, `body`) |
| `steps` | A numbered process (bordered rows + badges) | `eyebrow`/`heading`/`intro`, `items[]` (`title`, `body`), `width` (`narrow`/`full`) |
| `checklist` | Ticked list, 1–2 columns | `eyebrow`/`heading`/`intro`, `items[]` (`text`, `note`), `columns` |
| `gallery` | Responsive image grid with captions | `eyebrow`/`heading`/`intro`, `images[]` (`image`, `alt`, `caption`), `columns` |
| `beforeAfter` | Draggable before/after image slider | `eyebrow`/`heading`/`intro`, `before`, `after` |
| `textImage` | Text column beside an image (flippable) | `heading`, `body` (markdown), `image`, `imageAlt`, `flip` |
| `textQuote` | Body text beside a pull quote (flippable) | `body` (markdown), `quote`, `attribution`, `flip`, `accent` |
| `callout` | Single highlighted statement / quote | `eyebrow`, `quote`, `accent` |
| `statPanel` | Dark statement panel beside a giant stat number | `eyebrow`, `heading`, `body`, `badges[]`, `statValue`, `statLabel`, `accent` |

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
| `postList` | `posts` / any `article` listing (`title`, `date`, `excerpt`, `cover`, `showCover`) | listing `route` | Featured lead (a "Latest" tag, `strings.latest`) + card grid; per-post `showCover` shows the image or a brand-tinted default; `featured`/`showImages`/`columns` |
| `catalogList` | any `catalog` listing (`title`, `price`, `status`, `category`, `cover`, `gallery[]`, keyed `specs`) | listing `route` | Filterable cards with cover, status badge (themed), price + the listing's config-defined specs; `filters`/`showImages`/`columns` |

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
