# Blocks reference

The built-in library blocks (`@gronare/stomme/catalog`). Most section blocks accept
`surface` (`standard` / `tint` / `band` / `dark` / `gradient`) — the renderer wraps
them in a full-bleed band. Several also accept `accent` (`brand` / `secondary` /
`highlight`), which colours that block's rule/icon/number (not the eyebrow — that
follows `theme.eyebrowColor`). Both are set under the block's `style` group —
`style.surface`, `style.accent` — and the tables below name them bare. Add your own
blocks alongside these (see [customizing](customizing.md)).

**Buttons.** A block's call-to-action is a `cta` group — `cta.label` plus `cta.link`,
where the link is `{ page: '/…' }` for an internal page or `{ url: '…' }` for an
external one. A block with a second button uses `cta2`; the faq aside uses `asideCta`;
a card inside a grid (`featureGrid`) carries its own `cta`. Write the group, not the
flat pair: the legacy `ctaLabel`/`ctaHref`, `label`/`href` and `link`/`linkLabel` still
render through a back-compat shim, but `block-migrations.json` lists each rename and the
control plane's drift check reports the flat form as field drift. The tables below show
the current group.

A page that carries a `sectionNav` block also gets an `id` on every block that has a
heading — slugged from the heading, de-duplicated with `-2`, `-3` — so the chips can
link to them. A page without that block renders exactly as before, with no ids.

### Placing two blocks side by side

Every block with a Layout group carries `layout.beside`. Left at `below` (the default)
the block sits under the one before it, as always. Set to `equal`, `narrow` or `wide`
and the renderer wraps the two blocks in one `.block-pair` row: `equal` splits it down
the middle, `narrow` makes the second block the smaller half, `wide` makes it the larger
one. Below 900px the pair stacks in source order. Only the block that asks is affected,
and a row never takes a third block, so three `beside` blocks in a row make one pair and
one full-width block.

## Content & layout

| Type | What it renders | Key fields |
|---|---|---|
| `hero` | Headline + intro + CTA, with a swappable right-side media slot | `eyebrow`, `heading`, `intro`, `cta` (`label`, `link`), `media` (`none`/`image`/`highlights`/`motif`), `image`/`imageAlt`, `highlights[]` (`icon`,`title`,`body`), `height` (`normal`/`tall`), `align` (`top`/`center`/`bottom`) |
| `cover` | Full-bleed banner with overlaid text + up to two CTAs | `eyebrow`, `heading`, `intro`, `cta`, `cta2` (each `label`, `link`), `media` (`image`/`video`/`gradient`/`animated`), `image` (also the video poster), `imageAlt`, `video`/`videoUrl`, `overlay` (`light`/`medium`/`strong`), `align` (`start`/`center`), `vAlign` (`end`/`center`/`start` — moves the text block up or down independently of `align`), `height` (`tall`/`medium`) |
| `pageHeader` | Inner-page title header (light band or grey "Band") | `variant` (`light`/`dark`), `width` (`narrow`/`full`), `eyebrow`, `heading`, `intro`, `cta` (`label`, `link`) |
| `prose` | Rich text from markdown (inline images optimized + placed) | `heading`, `body` (markdown), `width` (`narrow`/`full`) |
| `featureGrid` | Grid of icon + title + text cards (cards can link) | `eyebrow`/`heading`/`intro`, `items[]` (`icon`, `title`, `body`, `cta` (`label`, `link`)), `numbered`, `columns`, `accent` |
| `pillars` | Columns of title + text (principles / values) | `eyebrow`/`heading`/`intro`, `items[]` (`title`, `body`) |
| `specialistGrid` | Compact title + text grid with a brand top-rule | `eyebrow`/`heading`/`intro`, `items[]` (`title`, `body`) |
| `team` | Grid of people cards — photo, role, contact details | `eyebrow`/`heading`/`intro`, `items[]` (`image`, `name`, `role`, `email`, `phone`, `linkUrl`, `linkLabel`, `bio`) |
| `steps` | A numbered process — bordered rows, or a connected icon flow | `eyebrow`/`heading`/`intro`, `items[]` (`title`, `body`, `icon`, `image`), `width` (`narrow`/`full`), `variant` (`rows` / `flow-soft` / `flow-filled` — the flow layouts run the steps across one row, each with its `image` icon tinted to the brand colour, or a named `icon`) |
| `checklist` | Ticked list, 1–2 columns | `eyebrow`/`heading`/`intro`, `items[]` (`text`, `note`), `columns` |
| `factList` | Rows of label + value (specs, what is included, opening hours) | `eyebrow`/`heading`/`intro`, `items[]` (`label`, `value`), `columns` (1/2/3), `accent` |
| `gallery` | Responsive image grid with captions | `eyebrow`/`heading`/`intro`, `images[]` (`image`, `alt`, `caption`), `columns` |
| `beforeAfter` | Draggable before/after image slider | `eyebrow`/`heading`/`intro`, `before`, `after` |
| `definition` | A dictionary-style entry (term, word class, senses) | `eyebrow`, `term`, `wordClass`, `senses[]` (`text`, `note`), `width` |
| `sectionNav` | A row of chip links that jump to the headings below it on the same page | `label` (accessible name), `sticky`; the chips are read from the blocks below, nothing to fill in |
| `fragment` | A placed editorial fragment — big lead line, short body, optional link; consecutive fragments drift across the page | `eyebrow`, `statement`, `body`, `cta` |
| `plans` | A row of pricing plan cards | `eyebrow`/`heading`/`intro`, `plans[]` (`name`, `pricePrefix`, `price`, `period`, `description`, `features[]`, `badge`, `highlight`), `footnote` |
| `textImage` | Text column beside an image (flippable) | `heading`, `body` (markdown), `image`, `imageAlt`, `flip` |
| `textQuote` | Body text beside a pull quote (flippable) | `body` (markdown), `quote`, `attribution`, `flip`, `accent` |
| `callout` | Single highlighted statement / quote | `eyebrow`, `quote`, `accent` |
| `statPanel` | Dark statement panel beside a giant stat number | `eyebrow`, `heading`, `body`, `badges[]`, `statValue`, `statLabel`, `accent` |

## Calls to action

| Type | What it renders | Key fields |
|---|---|---|
| `ctaPanel` | Full-width accent band with a CTA | `eyebrow`/`heading`/`intro`, `cta` (`label`, `link`) |
| `ctaBox` | Compact brand-colored CTA box | `eyebrow`, `heading`, `intro`, `cta`, `cta2` (each `label`, `link`), `facts[]`, `layout` (`classic`/`split`/`panel`) |

## Collection-backed

These read a content collection (the site must define it; `cms:gen` hides the block
when it's absent). Chrome fields (`eyebrow`/`heading`/`intro`) are optional.

| Type | Collection | Detail route | Notes |
|---|---|---|---|
| `faq` | `faq` (`question`, `answer`, `order`) | — | Q&A + editable contact aside (`asideHeading`/`asideBody`/`asideCta` (`label`, `link`)). `variant`: `list` (default) / `accordion` (native `<details>`) / `cards` / `split` (index + reader, JS-enhanced) |
| `testimonials` | `testimonials` (`name`, `role`, `quote`, `order`) | — | Quote cards |
| `documentList` | `documents` (`title`, `file`, `group`, `date`, `note`, `order`) | — | Download rows grouped under their `group` heading (`grouped`); an icon with the file extension, the title, `note` + date, and file type + size read off the built file. `group` filters to one group |
| `linkChips` | `towns` (`name`, `order`) | `routes.towns` | Chip links to each entry's page |
| `serviceGrid` | `services` (`navLabel`, `summary`, `order`, `image?`) | `routes.services` | Service cards (image, placeholder fallback) → detail page; `services[]` picks/orders a subset |
| `subpages` | `pages` (`title`, `parent`, `summary`, `cover`, `order`) | the page's own nested address | The pages sitting under the page the block is on, or the ones `pages[]` picks, in that order. `variant`: `cards` (photo card, brand title, summary, read-more) / `tiles` (no photo, brand top rule, on the surface colour) / `rows` (a reading-width list with an arrow) / `chips` (a compact chapter row, labelled `strings.subpages.inSection`) / `siblings` (a band for a subpage: the parent's title as the eyebrow, `strings.subpages.moreInSection` as the heading, the pages beside this one, and a link up to the parent). `columns` (2/3/4) applies to cards and tiles; `showImages` to cards, and a page with no `cover` keeps a card with no image area at all. Nothing to show renders nothing, and `siblings` on a page with no parent renders nothing |
| `postList` | `posts` / any `article` listing (`title`, `date`, `excerpt`, `category`, `eventDate`, `eventTime`, `cover`, `showCover`) | listing `route` | Featured lead (a "Latest" tag, `strings.latest`) + card grid; `category` renders as a chip beside the date, an `eventDate` (plus `eventTime`) replaces the publish date; per-post `showCover` shows the image or a brand-tinted default; `featured`/`showImages`/`columns`/`limit` |
| `eventList` | `posts` / any `article` listing, entries with an `eventDate` (`title`, `eventDate`, `eventTime`, `excerpt`) | listing `route` | Day/month tile + title and time, sorted ascending. The page ships every dated entry; the reader's browser hides what has passed (unless `showPast`, which dims them instead) so a static page stays current. `limit` counts upcoming events only, never the shown past ones. `emptyText` shows when nothing is upcoming, `feedLabel` links the listing's calendar feed at `<route>/calendar.ics` |
| `catalogList` | any `catalog` listing (`title`, `price`, `status`, `category`, `cover`, `gallery[]`, keyed `specs`) | listing `route` | Filterable cards with cover, status badge (themed), price + the listing's config-defined specs; `filters`/`showImages`/`columns`. `status` (`available`/`reserved`/`sold`) narrows the grid to one status before it renders; empty shows every entry |

## Numbers & proof

| Type | What it renders | Key fields |
|---|---|---|
| `statsBar` | A label/value facts grid | `items[]` (`label`, `value`) |
| `logoStrip` | A centred row of partner/client names | `lead`, `logos[]` (`name`) |
| `statPanel` | A single figure on a dark panel | `eyebrow`/`heading`/`body`, `statValue`, `statLabel`, `badges[]` |

Each carries its own data, so different pages can show different numbers.

## Contact

| Type | What it renders | Key fields |
|---|---|---|
| `contactForm` | Form + direct-contact aside; posts to the engine's contact route and redirects to `routes.formSuccess` | `eyebrow`/`heading`/`intro`, `labelName`, `labelEmail`, `labelMessage`, `submitLabel`, `showPhone`, `showDirectContact`, `showCategory` + `categories[]`/`labelCategory`, `showUnit`/`labelUnit`/`placeholderUnit` |
| `contactSwitch` | Two or more contact forms on one surface, one at a time, switched without a page load | `eyebrow`/`heading`/`intro`, `items[]` (`label`, `description` + every `contactForm` field), `layout.variant` (segmented/cards/tabs) |
| `contactCard` | The direct-contact card on its own | `show` (which parts), `tint` |
| `findUs` | Map + address block | reads the `contact` settings |

The contact blocks read the `contact` settings for the actual phone/email/address; their
fields control wording and which parts appear. `contactForm`, `contactCard` and `findUs`
(and `logoStrip`) take `style.surface` like the section blocks above, so a form can sit on
a `tint` or `band` ground.

## Choosing between similar blocks

Six pairs are easy to mix up. Each row says what makes the block different, not what it is:

| Block | What sets it apart |
|---|---|
| `pillars` | airy columns with a large brand numeral and a top rule — unlike `featureGrid` (boxed, small numeral) or `specialistGrid` (border-top, denser) |
| `specialistGrid` | denser than `pillars` (no large numeral), flatter than `featureGrid` (no box or icon) — a longer list of capabilities under one service |
| `team` | named people with a photo and their own phone, email and profile link — `specialistGrid` lists roles and capabilities, with no photo and nobody to contact |
| `ctaBox` | three layouts (classic / split / panel); `facts` feeds the split card's chips and the panel's readout and is ignored by classic. `ctaPanel` is the one that sits on a surface band |
| `prose` | its pull-stat (`statValue` + `statLabel`) is for the one headline figure a text section earns — `statsBar` is the row for several |
| `definition` | a dictionary entry (term, word class, numbered senses); `width` and `align` behave as they do in `callout` |
| `factList` | one row per fact, label beside value — `statsBar` is the row of big headline numbers, `definition` is a single word being defined |
| `contactSwitch` | one surface, one form at a time — two `contactForm` blocks under each other is the alternative, and it asks the visitor to read both |

## Chrome (not blocks)

`@gronare/stomme/Header.astro` and `@gronare/stomme/Footer.astro` render the site header/footer
from the `navigation`/`footer`/`settings` collections; use them in your `Base`
layout. They accept optional draft props so the CMS chrome previews can render them.

The footer's first column can also carry the address, the opening hours and the social
links from the `contact` settings — `showAddress`, `showHours`, `showSocials`, each off
until it is turned on. With `showAddress` on, the tagline drops the town it would
otherwise repeat.

## Page templates (not blocks)

For collection **detail** pages, the package ships two layouts you drop into a route:

- `@gronare/stomme/TownPage.astro` — rich service-area landing from a `towns` entry (hero /
  why / problems / districts / reason cards / local case / services + JSON-LD). Chrome
  strings come from `strings.town` (`{name}` is interpolated; `heading` is the H1
  template when an entry has no `title`); CTAs link to `routes.contact`.
- `@gronare/stomme/ServicePage.astro` — service detail from a `services` entry (its markdown
  body becomes the article) + bullets + a quote CTA band. Strings from `strings.service`.

Use them in `src/pages/<route>/[slug].astro`: `getStaticPaths` over the collection,
then `<Base ...><TownPage town={entry} config={kit} /></Base>`. `linkChips`/`serviceGrid`
link into these routes. `cms:gen` auto-creates the CMS editor for any collection it
finds (faq / testimonials / documents / towns / posts / services) — no hand-authored admin sections.
