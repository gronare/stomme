# The block model

Why a page is a list of typed blocks with fixed fields, and what that gives editors and developers.

## Editors compose, they do not lay out

An editor picks blocks from the catalog and fills in their fields. They cannot write markup, set a margin or pick a font size, so every page stays inside the design and nothing renders broken. The trade is freedom inside a block: what a block can do is what its fields offer, and a new layout is a new block or a new field.

## Content outlives the code

A page is a Markdown file in the repository, and its blocks are plain data. Rebuild the site, swap the theme or upgrade the engine, and the words stay where they are. Git keeps every version, and the CMS commits through it like any developer.

## Fields are grouped by what they change

Content fields sit at the top of a block. `media` holds what is shown beside or behind it, `layout` its size and placement, and `style` its surface and accent. The groups keep the CMS form short, and let the renderer handle `layout.beside` and `style.surface` for every block in one place, a custom block's included.

## A new field means off when it is absent

Content written before a field existed has no value for it. So a new field is opt-in: absent means the block renders as it always did. The CMS shows an absent checkbox as off whatever its default says, and saves declared defaults into blocks the editor never touched, so suggested wording goes in a field's hint, never its default. The same rule keeps feature flags off until a site turns them on.

## Renames keep rendering

When a field is renamed, such as the flat `ctaLabel` and `ctaHref` becoming the `cta` group, the old shape still renders, and `block-migrations.json` in the package records the rename so tools can move content to the new shape. A site takes an engine update first and moves its content after.
