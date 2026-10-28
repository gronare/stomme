# Measure visits

Turn on first-party metrics, Cloudflare Web Analytics, or consent-gated marketing tags. Each layer is off until you configure it.

## Send first-party metrics to your endpoint

1. Set `metrics.endpoint` in `src/site.config.ts` to an `https:` URL you control.

   ```ts
   export const site: SiteConfig = {
     metrics: { endpoint: 'https://metrics.example.com/collect' },
   };
   ```

2. Accept `POST` requests there with a JSON body sent as `text/plain`. [Metrics beacons](../reference/metrics.md) lists every body the script sends.
3. Build and open a page. The footer carries one small inline script, and your endpoint receives a pageview.

The script sets no cookies and uses no `localStorage`, so it needs no consent banner. It stays silent under automated browsers. Left unset, or set to an address that is not `https:`, nothing is emitted and the script is not in the HTML.

## Add Cloudflare Web Analytics

1. Create a site in Cloudflare Web Analytics and copy its token.
2. Set it as `analytics.cfToken`.

   ```ts
   export const site: SiteConfig = {
     analytics: { cfToken: 'your-token' },
   };
   ```

3. Build. Every page loads Cloudflare's beacon script in its head.

The beacon reports only when the site is served through Cloudflare, so it suits `build:cloudflare` or a site proxied by Cloudflare.

## Add Google Tag Manager, GA4 or a Meta Pixel

1. Turn the flag on in `src/site.config.ts`.

   ```ts
   export const features: StommeFeatures = { tracking: true };
   ```

2. Run `pnpm cms:gen`, then fill in the tag IDs and the privacy page in the CMS's tracking settings, or in `src/content/tracking/tracking.md`.

   ```yaml
   gtmId: GTM-XXXXXXX
   ga4Id: G-XXXXXXXXXX
   metaPixelId: ""
   privacyUrl: /privacy
   ```

3. Build and open the site. The consent banner appears, and the tags load with Google's consent mode set to denied and the Meta Pixel's consent revoked. **Accept** grants both, and the choice is remembered in the visitor's browser.
