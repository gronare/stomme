---
title: "About"
seo:
  title: "About — Starter Co"
  description: "How this starter is put together — pages, blocks, and the engine underneath."
blocks:
  - type: pageHeader
    eyebrow: About
    heading: Anatomy of this starter
    intro: An owner-managed page — its filename is its slug, so this renders at /about.
    layout:
      variant: dark
  - type: definition
    eyebrow: The name
    term: stom·me
    wordClass: noun · Swedish
    senses:
      - text: the load-bearing *frame* of a building.
      - text: the structure that holds a site up while everything visible gets replaced.
        note: this starter, for example.
  - type: prose
    heading: How a page is put together
    body: |
      Every page on this site is a markdown file whose frontmatter lists blocks
      in order — the engine renders the stack. This paragraph sits in a
      **rich-text block**, so markdown does the usual work:

      - headings, lists and [links](/)
      - inline images placed under `src/assets/uploads`, optimised automatically
      - positioning with a title keyword — `![caption](photo.jpg "right")`

      Delete a block from the frontmatter and the section is gone. Add one from
      the catalog and it appears, themed like everything else.
  - type: fragment
    eyebrow: A short story
    statement: First, a *frame*.
    body: The engine ships the blocks, the routes, the CMS and the build — the parts of a site that should not be rewritten per project.
    layout:
      placement: left
  - type: fragment
    statement: Then, the content.
    body: Everything you are reading lives in markdown files under src/content — this fragment included.
    layout:
      placement: right
  - type: fragment
    statement: Finally, *your* site.
    body: Replace the copy, set the theme, switch on the collections you need and delete what you don't.
    layout:
      placement: indent
  - type: pillars
    eyebrow: Principles
    heading: What the engine promises
    items:
      - title: Content outlives the code
        body: Pages are plain files. Rebuild the site, swap the theme, upgrade the engine — the words stay put.
      - title: The catalog is the contract
        body: Editors compose from a fixed set of blocks, so every page stays consistent and nothing renders broken.
      - title: Boring on purpose
        body: Static output, no client framework, one dependency to update. The excitement belongs in your content.
    style:
      surface: tint
  - type: ctaPanel
    eyebrow: Questions?
    heading: Talk to a human
    intro: The contact page is a block too — a working form wired to a thank-you page.
    cta:
      label: Contact
      link:
        page: /contact
published: true
---
