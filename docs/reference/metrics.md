# Metrics beacons

Every body the first-party metrics script sends to `metrics.endpoint`, and the page markers it reads.

The script sends with `navigator.sendBeacon` and falls back to `fetch` with `keepalive`. Bodies are JSON with the content type `text/plain`, so a cross-origin request needs no preflight. [Measure visits](../how-to/measure-visits.md) turns it on.

## Fields on every body

| Field | What it holds |
|---|---|
| `p` | the page path, `location.pathname` |
| `k` | the page kind from `data-stomme-page`, or `page` |
| `t` | the body type: `pv`, `ev`, `blk` or `vit` |

## Body types

| `t` | When | Other fields |
|---|---|---|
| `pv` | on load | `e`: the entry from `data-stomme-entry`; `r`: the referrer; `u`: `{ s, m }`, the `utm_source` and `utm_medium` |
| `ev` | on a contact intent | `d`: `{ type, detail }`, see below |
| `blk` | when the page is hidden or left | `d.items`: up to 40 `{ block, pos, act }`, where `act` is `seen` (half the block in view) or `click` |
| `vit` | when the page is hidden or left | `d`: `{ lcp, cls, inp }`, Largest Contentful Paint and Interaction to Next Paint in milliseconds, Cumulative Layout Shift to three decimals |

## Contact intents

| `d.type` | Sent when | `d.detail` |
|---|---|---|
| `tel` | a `tel:` link is clicked | the link |
| `mailto` | a `mailto:` link is clicked | the link |
| `outbound` | a link to another host is clicked | that host |
| `form` | a contact form is submitted | the page path |

## Page markers

| Attribute | Where | Values |
|---|---|---|
| `data-stomme-block` | every block's root element | the block's `type` |
| `data-stomme-page` | page templates | `town`, `service`, `news`, `listing`, `docs`, `404` |
| `data-stomme-entry` | detail pages | the entry's id |
