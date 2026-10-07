---
name: block-field-convention
description: Field layout for stomme CMS blocks. Use when adding a block to packages/stomme/catalog.ts, adding or moving a block field, writing a field hint, label or list summary, or changing how the Sveltia editor renders objects, lists and switches (src/kit.ts, src/emit-fields.mjs, src/admin-theme.mjs, admin/editor.js).
---

# Block field convention

A copywriter opens a block and sees the words first, open. Everything else sits in collapsed groups with the same names, in the same order, in every block. Apply every rule below to every field you add, then run the tests in **Done**.

## Where things live

- `packages/stomme/src/kit.ts`: the `Field` type and the helpers (`group`, `mediaGroup`, `layoutGroup`, `styleGroup`, `buttonField`, `linkField`, `headingFields`, `cardListField`, the `surface`/`accent`/`width` selects).
- `packages/stomme/catalog.ts`: every engine block as a `BlockDef`.
- `packages/stomme/src/emit-fields.mjs`: turns a `Field` into Sveltia `config.yml`; called by `bin/gen-admin-blocks.mjs`.
- `packages/stomme/src/admin-theme.mjs` (`THEME_CSS`, written to `public/admin/stomme-theme.css`) and `packages/stomme/admin/editor.js` (copied to `public/admin/stomme-editor.js`): the editor's look and click behaviour.
- `packages/stomme/src/BlockRenderer.astro` and `packages/stomme/blocks/*.astro`: read the stored shape.
- `packages/stomme/admin/labels.sv.js`: Swedish translations, keyed by field path.

## Sveltia mechanics

- Field order on screen is declaration order. Position is the only way to order.
- There are no tabs or sections: a group is a nested `object` with `collapsed: true`.
- There is no conditional visibility. A field that only applies in one case still shows; its hint says when it applies.
- Every declared `default:` is written into existing blocks on save. Suggested copy goes in the hint (`headingFieldsSuggesting`), never in `default:`.
- `output.omit_empty_optional_fields: true` is upserted by the generator, so an optional field left empty is absent from the saved file. Absent means off (the field policy at the top of `kit.ts`).

## The zones

A block's top level, in this order:

1. **Content**: flat fields, open, in the page's reading order. Anything that changes the message: eyebrow, heading, intro, ticks, buttons (`cta`, `cta2`), item lists. Content is never wrapped in a group.
2. **`media`** (`mediaGroup(hint, fields, summary?)`, label "Media"): the accompanying asset. Image + alt, video, highlights. A block with several media modes puts the picker first as `kind` and passes `'{{fields.kind}}'` as the summary (hero and cover do).
3. **`layout`** (`layoutGroup(fields)`, label "Layout"): size, placement, count. Height, align, width, columns, variant, sticky. `layoutGroup` appends `beside` to every layout group; BlockRenderer reads `layout.beside` on the second block of a pair.
4. **`style`** (`styleGroup(fields?)`, label "Appearance"): colour and mood, set once. Defaults to `[surfaceField, accentField]`; pass the subset the block actually renders. Always the last field.

Sorting test per field: changes the message → Content; changes the asset → `media`; changes size, position or count → `layout`; changes colour → `style`. A site's own fields slot into a zone, never after `style`.

The stored shape is nested: `media.image`, `layout.height`, `style.surface`. BlockRenderer paints the surface band from `style.surface` only, and each block component reads `Astro.props.media?.…`, `layout?.…`, `style?.…`. Content fields stay top-level.

Shipped state of `catalog.ts` (42 blocks): 40 end in `style`; `cover` and `ctaPanel` have no `style` group. One block, `subpages`, orders `layout` before `media`. `map` carries a fourth group, `coords`, built with `group()`. No block uses an `advanced` group. Keep new blocks to the zone order even where an old block strays.

## Groups the editor renders specially

- **Link** (`linkField(name, label)`): a required object `{ page, url }` with `collapsed: false`. The theme draws it chrome-less inline, page select beside the URL field, and editor.js refuses to collapse it, because the flat CSS needs both children mounted. Both children are optional, so an empty link is absent from the file. The URL wins over the page.
- **Button** (`buttonField(name, label, opts)`): an optional object `{ label, link }`, `collapsed: true`, summary `{{fields.label}}`. The canonical names are `cta`, `cta2`, the faq aside `asideCta`, and a featureGrid card's own `cta`.
- **Optional object** (`required: false`): one header row `[switch] Label`. Sveltia's add-checkbox is restyled as the switch and pinned in the same spot in every state. Two gestures: the switch adds or removes the object; a click on the card toggles expand and collapse. Added objects start collapsed. Use `required: false` only when the whole group is optional or its data is all-or-nothing.
- **Gated object**: an object whose first child is the boolean named `enabled` renders as a switch-card. The emitter forces `collapsed: false` on it, since the switch must stay mounted in both states. The switch writes `enabled`; a card click toggles the `.stomme-open` class (closed by default), independent of `enabled`, so a disabled card can still be opened. A leading boolean with any other name is a plain field; put a boolean first only when it is `enabled`.
- **Lists**: every item collapses on its own (`collapsed: true`), with a `label_singular` naming one item for the Add button. The theme hides the list's own collapse chevron; Expand all / Collapse all handle bulk.
- **Booleans** render as one row `[switch] label` with the hint under the label.

## Hints

- Every non-obvious field gets a hint; a self-explaining one (Heading) gets none.
- One sentence in sentence case, ending with a period, in the editor's words and naming the visible effect ("Small uppercase label above the heading."). Implementation words (surface, block, frontmatter, prop) stay out.
- A field that applies only in one case states the case in the hint ("Used when Show = Image."), never in the label.
- A group's hint says when to open it. The helpers ship these: Layout "Size and placement — rarely needs changing.", Appearance "Background and accent colour — set once when the page is designed."

Shipped state: 154 distinct hints, 17 longer than 90 characters, 5 without a closing period. Nine select/boolean fields carry no hint: `featureGrid.numbered`, `plans.highlight`, `textImage.flip`, `textQuote.flip`, `ctaBox.variant`, `contactForm.showPhone`, `contactSwitch.showPhone`, `contactCard.tint`, `findUs.showHours`.

## Summaries

- The block list uses one fixed summary for every block type: `{{fields.eyebrow}} {{fields.heading}}{{fields.quote}}` (emit-fields.mjs). Keep a heading-like field flat at the top level, named `heading` (or `quote`), or the collapsed row shows only the type pill. Eight catalog blocks have neither: collage, definition, fragment, sectionNav, statsBar, logoStrip, contactCard, map.
- A list of objects without an explicit `summary` gets one derived by `listSummary`: `{{fields.eyebrow}}` when present, then the first of title, name, label, question, quote, heading, statement, term, caption, text, alt, value. Set `summary` on the `Field` only when that pick is wrong.
- An object emits a summary only when its `Field` declares one. Layout and Appearance declare none; their hint carries the meaning.
- `seo` on a collection entry is a collapsed object with no summary. The generator adds `collapsed: true` to any `seo` object that lacks it.

## Labels and language

Labels and hints in `kit.ts` and `catalog.ts` are English. A site with `cmsLocale: 'sv'` gets the translations in `admin/labels.sv.js`, an `[English, Swedish]` pair per field path ("Appearance" → "Utseende", "Card" → "Kort"); the generator rewrites labels by path, falling back to the English text. Swedish is the only translation the engine ships. A new or reworded English label needs its pair in `labels.sv.js`.

## Editor theme

Theme changes go in `THEME_CSS` in `src/admin-theme.mjs`. It sets the `--sui-*` custom properties (base hue, font, radii, light and dark ramps) with `!important`, because Sveltia injects its own `:root` variables after the stylesheet loads. Sveltia renders in the light DOM, so the theme also targets its internal classes and `data-field-type` / `data-key-path` attributes; those are not a public API and are re-checked on every Sveltia bump (`SVELTIA_CMS_SRC` in `bin/gen-admin-blocks.mjs` pins the version). Behaviour that CSS cannot express (card clicks, gate visibility) goes in `admin/editor.js`, and its selectors mirror the theme's.

## Done

A field change is done when, from `packages/stomme`:

- `pnpm test:kit` passes. It checks that `style` is the last field in every block that has one, that every `media`, `layout` and `style` group is an object labelled Media, Layout or Appearance with `collapsed: true`, that the style selects' defaults are among their options, and that no new `x !== false` fallback appears in the renderers.
- `pnpm test:contracts` passes. It checks that no string, text or markdown field declares a default, and that `admin/labels.sv.js` has no orphaned, malformed or stale pair and leaves no more paths untranslated than its ceiling.
- `pnpm test:emit-fields` passes when the emitter changed.

The generator itself emits what the `Field` says and lints nothing; the zone order, the flat heading and the hint standard beyond those tests are held by review against this skill.
