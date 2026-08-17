---
seo:
  title: Starter — a stomme site
  description: A block-built starter on the stomme engine. Every section of this page is a block — rearrange, retheme, replace.
blocks:
  - type: hero
    eyebrow: Starter template
    heading: Every section on this page is a block.
    intro: This starter ships with a catalog of composable sections. Stack them in the CMS, swap the copy for your own, and delete the rest — the page below doubles as the tour.
    ticks:
      - Edited in the browser at /admin — or straight in markdown
      - Themed with tokens, not a CSS rewrite
      - Engine updates arrive as a version bump
    cta:
      label: See how it works
      link:
        url: "#how"
    cta2:
      label: About this starter
      link:
        page: /about
    media:
      kind: highlights
      highlights:
        - icon: bolt
          title: Static and fast
          body: Plain HTML out of the box — no client framework to ship.
        - icon: gear
          title: Composable
          body: Pages are stacks of typed blocks from a fixed catalog.
        - icon: shield
          title: Hard to break
          body: Content is validated on every build.
  - type: logoStrip
    lead: Built on
    logos:
      - Astro
      - Sveltia CMS
      - Markdown
      - TypeScript
  - type: featureGrid
    eyebrow: The idea
    heading: Compose, don't code
    intro: Three cards from the feature grid — each can carry an icon or a number, a footer tag, and a link.
    items:
      - icon: document
        title: Content is just files
        body: Every page is a markdown file with a list of blocks in its frontmatter, versioned in git next to the code.
        tag: markdown
      - icon: users
        title: Editors get a real CMS
        body: Non-developers compose pages at /admin from the same catalog — no stray HTML, no broken layouts.
        tag: sveltia
      - icon: refresh
        title: Updates without merge pain
        body: The engine is a dependency, not a copy-paste. New blocks and fixes arrive when you bump the version.
        tag: semver
        cta:
          link:
            page: /about
  - type: steps
    anchor: how
    eyebrow: Workflow
    heading: From scaffold to shipped
    items:
      - kicker: scaffold
        title: Generate the site
        body: One command scaffolds this starter — content, CMS and build wired together, running locally in a minute.
      - kicker: compose
        title: Stack your blocks
        body: Build each page from the catalog — heroes, grids, pricing, galleries, FAQs, forms — and reorder with drag and drop.
      - kicker: ship
        title: Build and deploy
        body: The build emits a static site. Host it anywhere that serves files.
    style:
      surface: tint
  - type: textImage
    heading: Text beside an image
    body: |
      This is the text-and-image split. The illustration here is a shipped
      placeholder — swap it from the media library and the build optimises the
      upload automatically.

      Body copy is **markdown**, so lists, emphasis and [links](/about) all
      work. Flip the layout switch and the image moves to the other side.
    media:
      image: /images/placeholders/hero.svg
      imageAlt: Placeholder illustration shipped with the starter
    layout:
      flip: true
  - type: callout
    quote: Owners edit the content. Developers upgrade the engine. *Neither can break the other's work.*
    layout:
      width: xnarrow
      align: center
    style:
      surface: dark
  - type: checklist
    eyebrow: What's in the box
    heading: The scaffold ships ready
    items:
      - text: A catalog of 30+ section blocks
        note: Heroes, grids, pricing, galleries, FAQs, forms — browse them all at /lookbook while developing.
      - text: Sveltia CMS wired at /admin
        note: Generated from the block catalog, never edited by hand.
      - text: Contact form with a thank-you page
      - text: SEO, share cards and sitemap
        note: Open Graph images can be generated per page.
      - text: Optional collections behind flags
        note: Blog, services, areas, testimonials — switched on in site.config.ts.
      - text: Theme tokens, not a CSS framework
    layout:
      columns: 2
  - type: faq
    eyebrow: FAQ
    heading: Questions, answered from a collection
    intro: These entries live in the FAQ collection — each FAQ block picks what to show, by hand or by tag.
    asideHeading: Still wondering?
    asideBody: The aside is part of the block — point it wherever questions should land.
    asideCta:
      label: Contact
      link:
        page: /contact
    layout:
      variant: accordion
    style:
      surface: tint
  - type: ctaBox
    eyebrow: Next step
    heading: Make it yours.
    intro: Swap the wordmark, retheme the tokens, replace this copy — the structure is already standing.
    cta:
      label: Get in touch
      link:
        page: /contact
    cta2:
      label: more about the starter
      link:
        page: /about
    facts:
      - label: Scaffold
        value: One command
      - label: Engine updates
        value: Version bump
      - label: Lock-in
        value: None
    layout:
      variant: split
---
