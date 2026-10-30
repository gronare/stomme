# Write pages by hand or with an agent

Write a page's blocks straight into its Markdown file, and check them against the site's catalog.

A page is a Markdown file under `src/content/` whose frontmatter holds a `blocks:` list. The CMS writes these files, and so can you, or an AI agent working in the repo. A field left out of the file renders as its default in the CMS, so a block written by hand and the same block added in `/admin` look alike. What goes wrong in a file the CMS did not write is a field the catalog does not have.

## Write the blocks

1. Look the block up in [Blocks](../reference/blocks.md), or in `/docs/blocks.json` on a site that publishes it, see [Use stomme with an AI agent](use-an-ai-agent.md).
2. Write every field you mean, by its name in the catalog. A field inside a group is nested: `media.showImages` is written as `media: { showImages: true }`.
3. Write each switch you want on as `true`. Every switch defaults to off, in the file and in the CMS.

```yaml
blocks:
  - type: postList
    heading: From the studio
    media:
      showImages: true
    layout:
      featured: true
      columns: 3
```

## Check the files

```bash
pnpm lint:content
```

It reads every `src/content/**/*.md` against the site's catalog, the one `stomme-gen` builds the CMS from, and lists by file, line and block:

- each field the catalog does not declare for that block, which the CMS does not show;
- each older field that still renders but has moved, such as a flat `ctaLabel` that belongs in `cta`;
- each block type the site does not have.

```text
src/content/pages/news.md
  line 5 · hero (block 1)
    ctaLabel: an older field that still renders; move it into cta
    colour: not a field of hero; /admin does not show it
1 unknown field, 1 legacy field.
```

A field added to a block later is checked as soon as it is in the catalog, with no list to keep up.

## Fix what it finds

The command only reports; it never writes a file. Rename or remove an unknown field, and move an older one by hand or with the migration listed in the package's `block-migrations.json`.

## Run it in a check

`--strict` exits with `1` when anything is reported, for CI or a pre-commit hook. `--json` prints the same report as JSON for a tool. `pnpm dev` and `pnpm build` print one line with the counts when there is anything to report. See [Commands](../reference/commands.md#stomme-lint-content).
