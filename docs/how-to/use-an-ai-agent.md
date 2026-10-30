# Use stomme with an AI agent

Give an AI coding agent what it needs to set up a stomme site and write its pages: the docs as plain text, the block catalog as data, and a check it can run.

## Point the agent at the docs

A docs section built by stomme, see [Build docs from a repo](build-docs-from-a-repo.md), publishes itself in forms an agent reads without parsing HTML:

| Address | What it holds |
|---|---|
| `/docs/llms.txt` | the [llms.txt](https://llmstxt.org) index: the docs title and summary, then each section with a link to every page as Markdown and a one-line description |
| `/docs/llms-full.txt` | every page's Markdown in one file, in reading order, each under its source path |
| `/docs/<page>.md` | one page as Markdown, next to its HTML at `/docs/<page>/`; each docs page links it in its head |
| `/docs/blocks.json` | every block with its label, group, summary, samples and fields, each field with its type, default and options, when the site sets `site.docs.blocks` |

Hand the agent `llms.txt` first and let it fetch the pages it needs, or `llms-full.txt` when it can read the whole set at once. The files describe the version served at the route; an unreleased version has its own under `/docs/<branch>/`. A site with no `llms.txt` of its own also serves the docs one at `/llms.txt`.

A prompt as short as this one is enough to start:

```text
Read https://example.com/docs/llms.txt, then set up a stomme site in this folder.
Write pages as blocks in src/content/pages/*.md and run pnpm lint:content before you finish.
```

## Tell it the field rule

A field left out of a page renders as its default in the CMS, so a block an agent writes by hand and the same block added in `/admin` look alike. Every switch defaults to off: an agent that wants images on a `postList` writes `media: { showImages: true }`. `blocks.json` lists each field's default.

So the agent writes out each switch it wants on and uses only the fields the catalog declares. The rule is in [The block model](../explanation/the-block-model.md).

## Let it check its own work

```bash
pnpm lint:content --strict
```

It exits with `1` while any page uses a field the block does not have, an older field that has moved, or a block type the site does not have. The report names the file, the line, the block and the field, which is enough for an agent to correct the page and run it again. `--json` gives the same report as data. See [Write pages by hand or with an agent](write-pages-by-hand.md).
