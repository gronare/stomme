# Generate share images

Give every page a share image, and have the build draw a 1200 × 630 card for detail pages from their own fields.

Without cards, a page's `og:image` is its own `seo.image`, or else the site's `ogImage` from the site settings.

## Draw cards for detail pages

1. In the CMS's site settings, turn on share cards, or set `og.enabled` in `src/content/settings/site.md`.

   ```yaml
   og:
     enabled: true
     types:
       boats:
         enabled: true
         style: bold
         headlineField: title
         sublineField: price
   ```

2. Turn on a type for each collection that should get cards: `towns`, `services`, or a listing's `id` (the blog is `posts`).
3. Build. Each entry of an enabled type gets `/og/<path>.png`, and its page's `og:image`, `og:image:width` and `og:image:height` point at it.

With cards on, a page without a card or its own `seo.image` falls back to the site's `ogImage`, then the home page's first hero image, then `/og/default.png`, a card the build draws with the site's name.

| Key | Default | What it sets |
|---|---|---|
| `og.enabled` | `false` | draws cards at all |
| `og.types.<type>.enabled` | `false` | cards for that collection |
| `og.types.<type>.style` | `editorial` | `editorial`, `bold` or `ops` |
| `og.types.<type>.headlineField` | the title, or the name for `towns` | the field shown large, or `business` for the site's name |
| `og.types.<type>.sublineField` | none, or `price` for a catalog | the field shown under it, or `none` |
| `og.types.<type>.scrim` | `55` | how much the entry's image is darkened behind the text, 0 to 100 |
| `og.types.<type>.showLogo` | `true` | the site's wordmark on the card |
| `og.types.<type>.accent` | the brand colour | the card's accent colour |

The card's background is the entry's cover, its first gallery image, or its hero or media image, and the brand colour when it has none. An entry's own `seo.image` replaces its card, and `seo.ogRaw: true` uses the entry's image as it is, without drawing on it.

The fields a type offers: `title`, `date` and `excerpt` for articles; `title`, `price`, `status`, `category` and `date` for catalogs; `name`, `title` and `heroSubtitle` for towns; `title`, `navLabel` and `summary` for services.
