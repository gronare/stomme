# Blocks

Every block in the library catalog (`@gronare/stomme/catalog`), with its fields as they are written in a page's frontmatter.

A field path with a dot is a field inside a group: `media.kind` is written as `media: { kind: … }`. Defaults are what the CMS fills in. Run `pnpm dev` and open `/lookbook` to see every block with sample content, or `/admin/blocks.html` for the block gallery `cms:gen` writes. [Add a custom block](../how-to/add-a-custom-block.md) adds your own.

## Fields many blocks share

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | the small label, the heading and the line under it |
| `style.surface` | `standard` (default), `tint`, `panel`, `band`, `dark`, `gradient` | the background; the renderer wraps the block in a full-width band, and a block never paints its own |
| `style.accent` | `brand` (default), `secondary`, `highlight` | the colour of the block's rule, icon or number; the eyebrow follows `eyebrowColor` in the theme instead |
| `layout.beside` | `below` (default), `equal`, `narrow`, `wide` | places the block beside the one before it, see [Two blocks side by side](#two-blocks-side-by-side) |
| `anchor` | text | an id, so `#anchor` links scroll to the block |

### Buttons

A call to action is a `cta` group: `cta.label` plus `cta.link`, where the link is `{ page: '/about' }` for a page on the site or `{ url: 'https://…' }` for anything else, `tel:` and `mailto:` included. A second button is `cta2`, the FAQ aside's button is `asideCta`, and a `featureGrid` card carries its own `cta`.

```yaml
cta:
  label: Get in touch
  link:
    page: /contact
```

The older flat pairs (`ctaLabel`/`ctaHref`, `label`/`href`, `link`/`linkLabel`, `asideCtaLabel`) still render, and `block-migrations.json` in the package lists each rename to the group form.

### Commands, video and headings

- **Command.** `hero` and `ctaPanel` take `command`, one line of shell in the code font with a copy button. It scrolls sideways in its own box, so a long command never widens the page, and where the clipboard is unavailable the button selects the text.
- **Video.** `hero` and `textImage` play a looping video when `media.kind` is `video`. It plays muted and inline, `media.image` is its poster, and `media.videoWebm` is offered before the MP4 when both are set. A visitor who asks for reduced motion sees the poster, and a button on the video pauses and resumes it.
- **Section links.** On a page with a `sectionNav` block, every block with a heading gets an `id` slugged from the heading, made unique with `-2`, `-3`, so the chips can link to it. A page without `sectionNav` gets no ids.
- **Underlines.** In `callout`, `definition`, `fragment` and `statPanel`, words wrapped in `*asterisks*` are underlined.

### Two blocks side by side

Set `layout.beside` on the second block to `equal`, `narrow` or `wide` and the renderer puts the two in one row: `equal` splits it down the middle, `narrow` makes the second block the smaller half, `wide` the larger. Below 900px wide the pair stacks in source order. A row never takes a third block, so three `beside` blocks in a row make one pair and one full-width block.

## Hero and headers

### `hero`

Full-width intro with a heading, text and buttons, and an optional image, video, highlights panel or animated motif.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | `heading` is the page's H1 |
| `ticks[]` | text | short checkmark lines under the intro |
| `cta`, `cta2` | button | the button, and a quiet text link beside it |
| `command` | text | a copyable command |
| `media.kind` | `none` (default), `image`, `video`, `highlights`, `motif` | what shows beside the text |
| `media.image`, `media.imageAlt` | image, text | the picture, also the video's poster |
| `media.video`, `media.videoWebm`, `media.videoUrl` | file, file, URL | the video; the URL is used instead of a file when set |
| `media.ratio` | `standard` 4:3 (default), `wide` 16:9, `square` | the media's shape |
| `media.highlights[]` | `icon`, `title`, `body` | the highlights panel |
| `layout.height` | `normal` (default), `tall` | tall fills the screen |
| `layout.align` | `top`, `center` (default), `bottom` | where the text sits in a tall hero |
| `layout.width` | `full` (default), `narrow` | narrow centres the hero in a reading column |
| `layout.mediaPosition` | `beside` (default), `below` | below puts the media under the text at full width |
| `style.surface`, `style.accent` | see above | |

### `cover`

Full-bleed banner with text over a photo, a looping video, a gradient or an animated pattern.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | `heading` is the H1 and keeps line breaks |
| `cta`, `cta2` | button | two buttons |
| `media.kind` | `image` (default), `video`, `gradient`, `animated` | the background; gradient and animated follow the brand colour |
| `media.image`, `media.imageAlt` | image, text | the photo, also the video's poster |
| `media.video`, `media.videoUrl` | file, URL | the video |
| `media.overlay` | `light`, `medium` (default), `strong` | how much the background is darkened |
| `layout.align` | `start` (default, bottom left), `center` | where the text sits |
| `layout.vAlign` | empty, `end`, `center`, `start` | moves the text up or down, keeping its side |
| `layout.height` | `tall` (default), `medium` | |

### `pageHeader`

Title band for an inner page.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | `heading` is the H1 |
| `cta` | button | |
| `layout.variant` | `light` (default), `dark` | dark puts the title on a dark full-width band |
| `layout.width` | `narrow` (default), `full` | |
| `style.surface` | see above | |

## Text

### `prose`

Rich text from Markdown. Inline images are optimised and placed by a title keyword, see [Images in Markdown](#images-in-markdown).

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading` | text | |
| `body` | Markdown | |
| `statValue`, `statLabel` | text | one headline figure under the text |
| `layout.width` | `narrow` (default), `full` | |
| `style.surface` | see above | |

### `textImage`

Text beside an image or a looping video. With no heading and no text, the media fills the row.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading` | text | |
| `body` | Markdown | |
| `media.kind` | `image` (default), `video` | |
| `media.image`, `media.imageAlt` | image, text | also the video's poster |
| `media.fit` | `frame` (default), `cutout` | cutout drops the frame and caps the picture at 20rem, for a picture with a transparent background |
| `media.video`, `media.videoWebm`, `media.videoUrl` | file, file, URL | |
| `layout.flip` | `false` (default) | `true` puts the media on the left |
| `style.surface` | see above | |

### `textQuote`

Body text beside a pulled-out quote.

| Field | Values | What it does |
|---|---|---|
| `body` | Markdown | |
| `quote`, `attribution` | text | |
| `layout.flip` | `false` (default) | `true` puts the quote on the left |
| `style.surface`, `style.accent` | see above | |

### `fragment`

An editorial fragment: a large lead line, a short text and an optional link. Fragments in a row drift across the page.

| Field | Values | What it does |
|---|---|---|
| `eyebrow` | text | usually on the first fragment only |
| `statement` | text | the large line |
| `body` | text | |
| `cta` | button | a link |
| `layout.placement` | `left` (default), `right`, `indent` | alternate them to break the grid |
| `style.surface` | see above | |

### `sectionNav`

A row of chips that jump to the headings below it on the same page. The chips are read from the blocks below, so there is nothing to fill in.

| Field | Values | What it does |
|---|---|---|
| `label` | text | the row's accessible name; default from `strings.sectionNav.label` |
| `layout.sticky` | `false` (default) | `true` keeps the row at the top of the window while scrolling |
| `style.surface` | see above | |

## Cards and lists

### `featureGrid`

Grid of cards with an icon or a number, a title and text. A card can link.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `items[]` | `icon`, `title`, `body`, `tag`, `cta` | `tag` is a small label at the card's foot; `cta` makes the card a link, with `Read more` when its label is blank |
| `layout.numbered` | `false` (default) | `true` shows 01, 02, 03 instead of icons |
| `style.surface`, `style.accent` | see above | |

### `pillars`, `specialistGrid`

`pillars` is a row of airy columns with a large brand numeral and a top rule, for principles or values. `specialistGrid` is a denser grid with a brand top rule, for a longer list of capabilities.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `items[]` | `title`, `body` | |
| `style.surface` | see above | |

### `plans`

A row of pricing plan cards.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `plans[]` | `name`, `pricePrefix`, `price`, `period`, `description`, `features[]` (`text`), `badge`, `highlight`, `note` (`label`, `text`), `cta` | one card per plan; `price` is shown as written; `highlight: true` marks the plan; `note` is set apart under the features |
| `footnote` | text | a small note under the cards |
| `anchor` | text | |
| `style.surface` | see above | |

### `team`

Grid of people with a photo and their own contact details.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `items[]` | `image`, `name`, `role`, `email`, `phone`, `linkUrl`, `linkLabel`, `bio` | with no `image`, a neutral silhouette is drawn; a blank `linkLabel` shows the address |
| `style.surface` | see above | |

### `steps`

A numbered process, as bordered rows or as a connected row of icons.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `items[]` | `title`, `kicker`, `body`, `icon`, `image` | `kicker` is a short word beside the number, rows only; `image` is an icon image tinted to the brand colour, used before `icon` in the flow layouts |
| `anchor` | text | |
| `layout.width` | `narrow` (default), `full` | |
| `layout.variant` | `rows` (default), `flow-soft`, `flow-filled` | |
| `style.surface` | see above | |

### `checklist`

Ticked items in one or two columns.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `items[]` | `text`, `note` | `note` is a line under the item |
| `layout.columns` | `2` (default), `1` | |
| `style.surface` | see above | |

### `factList`

Rows of label and value: specifications, what is included, opening hours.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `items[]` | `label`, `value` | `value` is plain text and may hold a Markdown link |
| `layout.columns` | `1` (default), `2`, `3` | rows side by side on wide screens |
| `style.surface`, `style.accent` | see above | |

## Media

### `gallery`

Responsive image grid with captions.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `images[]` | `image`, `alt`, `caption` | |
| `layout.columns` | `3` (default), `2` | |
| `style.surface` | see above | |

### `collage`

A collage of fixed height, one leading picture and a few tiles, with a chip that opens every image in a viewer.

| Field | Values | What it does |
|---|---|---|
| `images[]` | `image`, `alt` | the first five build the collage; all of them open in the viewer |
| `caption` | text | one line under the collage |
| `style.surface` | see above | |

### `beforeAfter`

A draggable before and after slider.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `media.before`, `media.after` | image | the two photos |
| `beforeAlt`, `afterAlt` | text | |
| `style.surface` | see above | |

## Quote and highlight

### `callout`

A single highlighted statement or quote.

| Field | Values | What it does |
|---|---|---|
| `eyebrow` | text | |
| `quote` | text | |
| `layout.width` | `narrow` (default), `xnarrow`, `full` | |
| `layout.align` | `left` (default), `center`, `right` | where the column sits; the text stays left-aligned |
| `style.surface`, `style.accent` | see above | |

### `definition`

A dictionary entry: a term, its word class and numbered senses.

| Field | Values | What it does |
|---|---|---|
| `eyebrow` | text | |
| `term` | text | use `·` between syllables |
| `wordClass` | text | the italic line under the term |
| `senses[]` | `text`, `note` | `note` is a muted addendum |
| `layout.width` | `xnarrow` (default), `narrow`, `full` | |
| `layout.align` | `left` (default), `center`, `right` | |
| `style.surface` | see above | |

### `statPanel`

A dark statement panel beside a giant number, or two or three figures side by side.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading` | text | |
| `body` | text | a blank line starts a new paragraph |
| `badges[]` | text | |
| `statValue`, `statLabel` | text | the big number |
| `stats[]` | `label`, `value`, `note` | replaces the single number when filled |
| `style.accent` | see above | |

## Numbers

### `statsBar`

A row of label and value figures.

| Field | Values | What it does |
|---|---|---|
| `items[]` | `label`, `value` | |
| `style.surface` | see above | |

### `timeline`

A line of years with a dot per milestone, the last one highlighted.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `items[]` | `year`, `title`, `detail` | oldest first; `year` can be wording such as `00s`; `detail` shows on narrow screens |
| `planned` | text | a dashed note at the end of the line |
| `style.surface` | see above | |

### `logoStrip`

A centred row of partner or client names.

| Field | Values | What it does |
|---|---|---|
| `lead` | text | a lead-in such as `Trusted by` |
| `logos[]` | text | the names |
| `style.surface` | see above | |

## From collections

These blocks read entries from a collection. `cms:gen` offers a block only while its source is on: the feature flag, or for `postList`, `postArchive` and `eventList` the blog or an `article` listing, and for `catalogList` a `catalog` listing. [Content collections](content.md) lists the entries' fields.

| Type | Reads | Fields besides `eyebrow`, `heading`, `intro`, `style.surface` |
|---|---|---|
| `faq` | `faq` | `entries` (pick questions, in order), `tag` (every question with that tag, ignored when `entries` is set), `asideHeading`, `asideBody`, `asideCta` (a contact aside, hidden when `asideHeading` is blank), `layout.variant`: `list` (default), `accordion` (native `<details>`), `cards`, `split` (an index and a reader) |
| `testimonials` | `testimonials` | none; quote cards |
| `documentList` | `documents` | `group` (show one group), `layout.grouped` (`true` by default, a heading per group). Each row has an icon with the file extension, the title, the note and date, and the file type and size read off the built file |
| `linkChips` | `towns` | none; a chip link to each area's page |
| `serviceGrid` | `services` | `services` (pick and order a subset); cards with an image or a placeholder, linking to each service's page |
| `subpages` | `pages` | `pages` (pick pages, in order; empty shows the pages under this one), `layout.variant`: `cards` (default), `tiles`, `rows`, `chips` (labelled `strings.subpages.inSection`), `siblings` (for a subpage: the parent's title, `strings.subpages.moreInSection`, the pages beside this one and a link up); `layout.columns` `2` (default), `3`, `4` for cards and tiles; `media.showImages` (`true` by default, cards only). Nothing to show renders nothing |
| `postList` | the blog or an `article` listing | `text`: `excerpt` (default) or `full`; `media.showImages` (`true`), `media.style`: `top` (default) or `corner`; `layout.featured` (`true`, the newest post as a lead card tagged `strings.latest`), `layout.columns` (`3`), `layout.limit` (newest first), `layout.archive` (a path linked when the limit cuts the list). A post's `category` shows as a chip, and an `eventDate` replaces the publish date |
| `postArchive` | the blog or an `article` listing | none; every post, grouped by year, newest first |
| `eventList` | the blog or an `article` listing, entries with an `eventDate` | `layout.limit` (`6`, upcoming events only), `layout.showPast` (`false`; `true` dims past events instead of hiding them), `emptyText` (shown when nothing is upcoming), `feedLabel` (the text of a link to `<route>/calendar.ics`; empty hides it). The page ships every dated entry and the browser hides what has passed, so a static page stays current |
| `catalogList` | a `catalog` listing | `status`: empty (every entry), `available`, `reserved` or `sold`; `media.showImages` (`true`); `layout.filters` (`true`, category chips above the grid); `layout.columns` (`3`). Cards show the cover, a status badge, the price and the listing's specs |

## Calls to action

### `ctaPanel`

A full-width call-to-action band.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `command` | text | a copyable command |
| `cta`, `cta2` | button | the second is a quieter outlined button |
| `anchor` | text | |

### `ctaBox`

A boxed call to action in three layouts.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `cta`, `cta2` | button | the second shows as a quiet text link |
| `facts[]` | `label`, `value` | chips in `split`, a readout in `panel`, ignored in `classic` |
| `layout.variant` | `classic` (default), `split`, `panel` | |
| `style.surface` | see above | |

### `contactForm`

A contact form beside a direct-contact card. It posts to the contact handler and opens `routes.formSuccess`, see [Connect the contact form](../how-to/connect-the-contact-form.md).

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | a blank heading uses the page title |
| `labelName`, `labelEmail`, `labelMessage`, `submitLabel` | text | blank uses `strings.contact` |
| `showPhone` | `true` (default) | |
| `requirePhone` | `false` (default) | |
| `showCategory`, `categories[]`, `labelCategory` | `false`, text | a dropdown; needs at least one category |
| `showUnit`, `labelUnit`, `placeholderUnit` | `false`, text | a short free-text field |
| `showDirectContact` | `true` (default) | `false` lets the form fill the width |
| `inbox` | text | sent with the message as `inbox`, for a handler that routes by it |
| `style.surface` | see above | |

### `contactSwitch`

Two or more contact forms on one surface, shown one at a time, switched without a page load.

| Field | Values | What it does |
|---|---|---|
| `eyebrow`, `heading`, `intro` | text | |
| `items[]` | `label`, `description`, `intro`, and every `contactForm` field from `labelName` to `inbox` | one form per errand; the first is open when the page loads; `description` shows in the `cards` layout only |
| `layout.variant` | `segmented` (default), `cards`, `tabs` | how the visitor switches |
| `style.surface` | see above | |

### `contactCard`

The direct-contact card on its own, filled from the contact settings.

| Field | Values | What it does |
|---|---|---|
| `show` | any of `phone`, `email`, `hours`, `address`, `map`, `socials`; default `phone`, `email` | a part with no data is skipped, and `map` needs `lat` and `lng` on the address |
| `label` | text | blank uses `strings.contact.direct` |
| `tint` | `true` (default) | a tinted background |
| `style.surface` | see above | |

### `findUs`

A map beside the address, contact details and hours, filled from the contact settings. The map shows when the address has `lat` and `lng` and the site config sets `maps.provider: 'osm'`, or a Google `maps.key`. It loads from the provider only when the visitor clicks.

| Field | Values | What it does |
|---|---|---|
| `heading` | text | blank uses `strings.contact.findUs` |
| `showHours` | `true` (default) | |
| `style.surface` | see above | |

### `map`

A map picture with the address and two buttons that hand the route to Google Maps or Apple Maps. No third-party script runs on the page.

| Field | Values | What it does |
|---|---|---|
| `address` | text | shown in bold, and used for the route when there are no coordinates |
| `note` | text | a quiet line beside the address |
| `media.image`, `media.imageAlt` | image, text | a static map you exported; a site with a Google map key shows Google's still instead |
| `media.credit` | text | printed over the picture; a map from OpenStreetMap must credit `© OpenStreetMap contributors` |
| `media.pinX`, `media.pinY` | 0 to 100 | where the pin sits, in percent; leave both blank for no pin |
| `coords.lat`, `coords.lng` | numbers | land the map app on the door instead of the street |
| `style.surface` | see above | |

## Choosing between similar blocks

| Block | What sets it apart |
|---|---|
| `pillars` | airy columns with a large brand numeral and a top rule, unlike `featureGrid` (boxed, small numeral) or `specialistGrid` (top rule, denser) |
| `specialistGrid` | denser than `pillars`, with no large numeral, and flatter than `featureGrid`, with no box or icon: a longer list of capabilities under one service |
| `team` | named people with a photo and their own phone, email and profile link; `specialistGrid` lists roles with no photo and nobody to contact |
| `ctaBox` | three layouts, with `facts` feeding the split card's chips and the panel's readout; `ctaPanel` is the full-width band |
| `prose` | its pull-stat is for the one headline figure a text section earns; `statsBar` is the row for several |
| `factList` | one row per fact, label beside value; `statsBar` is a row of big numbers, `definition` a single word being defined |
| `contactSwitch` | one surface, one form at a time; two `contactForm` blocks one under the other ask the visitor to read both |
| `map` | a picture and two route buttons, with nothing loaded from a map provider; `findUs` shows an interactive map from the contact settings |

## Images in Markdown

Markdown fields, such as the bodies of `prose`, `textImage` and `textQuote` and of blog posts, go through `renderMarkdown` from `@gronare/stomme/markdown`. Inline images are optimised, and a title keyword lays them out: `left`, `right` or `wide`, plus `small` or `large`.

```md
![A workbench](/media/pages/about/bench.jpg "right small")
```

The CMS's **Image** button writes that Markdown for editors.
