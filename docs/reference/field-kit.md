# Field kit

The types and helpers `@gronare/stomme/kit` exports for writing a block's catalog entry.

## `BlockDef`

| Key | Required | What it holds |
|---|---|---|
| `type` | yes | the block's `type` in content, and its key in the renderer's registry |
| `label` | yes | the block's name in the CMS |
| `fields` | yes | a list of `Field` |
| `group` | no | the CMS group, in this order: `Hero & headers`, `Text`, `Cards & lists`, `Media`, `Quote & highlight`, `Numbers`, `From collections`, `Calls to action`, `Automatic`. A block with another group, or none, comes after them, and the block gallery files a block with none under `Other` |
| `shape` | no | the sketch the block gallery draws for it: `hero`, `band`, `prose`, `split`, `grid`, `gallery`, `steps`, `checklist`, `pairs`, `quote`, `panel`, `chips`, `list`, `box`, `stats` or `auto`; anything else draws `prose` |
| `summary` | no | a line describing the block |
| `collection` | no | a collection the block reads; the CMS offers the block only while that collection is on |
| `feature` | no | a feature flag the block needs |
| `sample`, `samples` | no | content `/lookbook` renders; a sample's `_label` names it |

## `Field`

| Key | What it holds |
|---|---|
| `name`, `label` | the key in content and the label in the CMS |
| `widget` | `string`, `text`, `markdown`, `number`, `boolean`, `select`, `image`, `file`, `list`, `object` or `hidden` |
| `required` | `false` makes the field optional; Sveltia's default is required |
| `default`, `hint` | the value a new block starts with, and the help line |
| `options` | for `select`: `{ label, value }` items, or a source: `$pages`, `$services`, `$faq`, `$faqTags`, `$documentGroups`, `$catalogListings`, `$articleListings` (the site's listings of that preset, by label, valued by `id`) |
| `soleDefault` | for `select`: `true` preselects the only option when the source has exactly one |
| `hiddenBelow` | for `select`: with fewer options than this, the field is written as `hidden`, so the CMS keeps the value a page holds without offering a choice |
| `media_folder`, `public_folder` | leave these unset: `stomme cms` gives every collection its upload folders, and a field of its own would put uploads where the image pipeline does not look |
| `multiple` | for `select`, several values |
| `fields`, `field` | the children of an `object` or `list` |
| `summary`, `label_singular`, `collapsed` | how the CMS shows a list or object |

A new field should mean "off" when it is absent, so content written before the field existed renders as it did. Its `default` must be what the block renders with the field absent, because the CMS writes the default into every block that lacks the field when the page is opened: a `boolean` defaults to `false`, a list to nothing. Put suggested wording in `hint`, never in `default`.

## Helpers

| Export | What it gives |
|---|---|
| `headingFields` | `eyebrow`, `heading`, `intro` |
| `headingFieldsSuggesting(eyebrow, heading)` | the same, with `Suggestion: "…"` in the eyebrow and heading hints |
| `buttonField(name, label = 'Button', opts?)` | an optional, collapsed button group of `label` and `link`. `opts.hint` sets the group's hint, `opts.labelHint` the label's, and `opts.optionalLabel: true` lets the label be left empty |
| `linkField(name = 'href', label = 'Link')` | a link: `page` or `url`; the `url` wins when both are set |
| `imageField(name = 'image', label = 'Image', hint?)` | an optional image |
| `iconField(name = 'icon', label = 'Icon')` | an optional select over the icon set, `ICON_NAMES` |
| `commandField`, `anchorField` | `command` and `anchor` |
| `videoFields` | `video`, `videoWebm`, `videoUrl` |
| `cardListField`, `linkedCardListField` | `items[]` of `title` and `body`, or with `icon`, `tag` and `cta` too; a `cta` with no label reads `strings.readMore`, "Read more" by default |
| `group(name, label, hint, fields)` | a collapsed object |
| `mediaGroup(hint, fields, summary?)` | the `media` group |
| `layoutGroup(fields)` | the `layout` group, with `beside` added |
| `styleGroup(fields?)` | the `style` group, by default `surface` and `accent`; always the last field |
| `surfaceField`, `accentField`, `widthField`, `besideField` | the single fields those groups use. Their defaults: `surface` `standard` (also `tint`, `panel`, `band`, `dark`, `gradient`), `accent` `brand` (also `secondary`, `highlight`), `width` `narrow` (or `full`), `beside` `below` (also `equal`, `narrow`, `wide`) |
