# Field kit

The types and helpers `@gronare/stomme/kit` exports for writing a block's catalog entry.

## `BlockDef`

| Key | Required | What it holds |
|---|---|---|
| `type` | yes | the block's `type` in content, and its key in the renderer's registry |
| `label` | yes | the block's name in the CMS |
| `fields` | yes | a list of `Field` |
| `group` | no | the CMS group: `Hero & headers`, `Text`, `Cards & lists`, `Media`, `Quote & highlight`, `Numbers`, `From collections`, `Calls to action` |
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
| `options` | for `select`: `{ label, value }` items, or a source: `$pages`, `$services`, `$faq`, `$faqTags`, `$documentGroups` |
| `multiple` | for `select`, several values |
| `fields`, `field` | the children of an `object` or `list` |
| `summary`, `label_singular`, `collapsed` | how the CMS shows a list or object |

A new field should mean "off" when it is absent, so content written before the field existed renders as it did. Put suggested wording in `hint`, never in `default`.

## Helpers

| Export | What it gives |
|---|---|
| `headingFields` | `eyebrow`, `heading`, `intro` |
| `headingFieldsSuggesting(eyebrow, heading)` | the same, with suggested wording in the hints |
| `buttonField(name, label, opts?)` | a button group: `label` and `link` |
| `linkField(name, label)` | a link: `page` or `url` |
| `imageField(name, label, hint?)` | an optional image |
| `iconField(name, label)` | a select over the icon set, `ICON_NAMES` |
| `commandField`, `anchorField` | `command` and `anchor` |
| `videoFields` | `video`, `videoWebm`, `videoUrl` |
| `cardListField`, `linkedCardListField` | `items[]` of `title` and `body`, or with `icon`, `tag` and `cta` too |
| `group(name, label, hint, fields)` | a collapsed object |
| `mediaGroup(hint, fields, summary?)` | the `media` group |
| `layoutGroup(fields)` | the `layout` group, with `beside` added |
| `styleGroup(fields?)` | the `style` group, by default `surface` and `accent`; always the last field |
| `surfaceField`, `accentField`, `widthField`, `besideField` | the single fields those groups use |
