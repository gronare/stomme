# Static first

Why a stomme site prerenders every page, and which few routes run on a server.

## A page is built once

Every page, detail page, feed, share card and sitemap is rendered at build time to a file. A host only serves files, so pages load fast, cost little to host and have no server to keep patched. Content changes reach the site through a new build: the CMS commits, and a host that builds on every commit publishes the change.

## Only two things need a server

The CMS preview has to render drafts that do not exist yet, and the contact form has to receive a message. On an adapter build, `/preview` and `/api/contact` run on demand, plus `/map/<point>.png` when a Google map key is set. Everything else stays static. On `build:static` there is no server at all: the preview is prerendered and the form posts to an endpoint you name.

## Pages stay current without a rebuild

Some content changes with time, not with edits. `eventList` ships every dated event, and the visitor's browser hides the ones that have passed, so a page built months ago still shows only what is upcoming. The calendar feed lets readers follow events in their own calendar app.

## Scripts are small and inline

There is no client framework. Blocks that need behaviour, such as the before-and-after slider, the collage viewer or the contact form's submit, carry a small script of their own, and a page without those blocks does not load them. Every page also gets one tiny script that reveals protected phone numbers and email addresses. The metrics script is inline and is only in the HTML when an endpoint is set.
