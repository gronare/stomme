// The settings pane and the collections/backend regions: everything the generator splices outside the block picker.
export function makeSettingsPane({ q, pad, emitWidget, emitNavLinks, emitFooterLinks, emitThanksButtons, COLLECTION_EDITORS, listingEditor, collectionEnabled, FEATURES, LISTINGS, CMS, ADDON_PANES, ADDON_PANEL_FILES, getStaticCollections }) {
// A hand-authored collection of the same name OUTSIDE the generated regions wins: STATIC_COLLECTIONS suppresses its generated counterpart, so a site keeping (or customizing) a static pane never gets a duplicate.
const generatedEditors = () => Object.keys(COLLECTION_EDITORS).filter(collectionEnabled).filter((n) => !getStaticCollections().has(n));
function emitCollections(indent) {
  const p = pad(indent);
  const ind = (s) => s.split('\n').map((l) => (l ? p + l : l)).join('\n');
  const fixed = generatedEditors().map((name) => ind(COLLECTION_EDITORS[name]));
  const listing = LISTINGS.map((l) => ind(listingEditor(l)));
  // Addon panes last, so an out-of-tree extension can never displace a site's own editors.
  const addon = ADDON_PANES.map((e) => ind(e.yaml.replace(/\n+$/, '')));
  return [...fixed, ...listing, ...addon].join('\n');
}

// Only the fields the site's `cms` config sets are written; the defaults are git-gateway on main. No `cms:generated` markers in a site's config.yml ⇒ nothing emitted and a hand-authored backend survives.
function emitCms(indent) {
  const p = ' '.repeat(indent);
  const c = CMS || {};
  const L = [`${p}backend:`, `${p}  name: ${c.backend || 'git-gateway'}`];
  if (c.repo) L.push(`${p}  repo: ${c.repo}`);
  L.push(`${p}  branch: ${c.branch || 'main'}`);
  if (c.baseUrl) L.push(`${p}  base_url: ${c.baseUrl}`);
  if (c.authEndpoint) L.push(`${p}  auth_endpoint: ${c.authEndpoint}`);
  if (c.apiRoot) L.push(`${p}  api_root: ${c.apiRoot}`);
  // Gated on baseUrl: only a site with gateway OAuth loses Sveltia's built-in PAT sign-in — solo/local sites with no auth server keep the token fallback.
  if (c.baseUrl) L.push(`${p}  auth_methods: [oauth]`);
  // Sveltia sends the OAuth `site_id` from `site_domain`, and the gateway's same-window (Arc/mobile) fallback keys off it to find the site in KV; it defaults to the deploy host.
  if (c.siteDomain) L.push(`${p}  site_domain: ${c.siteDomain}`);
  if (c.gatewayUrl) L.push(`${p}  gateway_url: ${c.gatewayUrl}`);
  if (c.identityUrl) L.push(`${p}  identity_url: ${c.identityUrl}`);
  return L.join('\n');
}

// A SECOND file pane on site.md — Sveltia preserves each pane's other frontmatter on save. The data lands at settings.ogImage and settings.og.{enabled,types}, read by Head.astro / routes/og.ts / src/og-pages.ts.
function shareTypeList() {
  const out = [];
  if (collectionEnabled('towns')) out.push({ key: 'towns', label: 'Service areas', kind: 'towns' });
  if (collectionEnabled('services')) out.push({ key: 'services', label: 'Services', kind: 'services' });
  for (const l of LISTINGS) out.push({ key: l.id, label: l.label || l.id, kind: l.preset });
  return out;
}
// Per type kind: that type's known text fields — the keys must exist in src/og-pages.ts TYPE_FIELDS — plus "Business name" (the site name).
const SHARE_FIELDS = {
  towns: [['name', 'Town name'], ['title', 'Title'], ['heroSubtitle', 'Hero subtitle']],
  services: [['title', 'Title'], ['navLabel', 'Nav label'], ['summary', 'Summary']],
  article: [['title', 'Title'], ['date', 'Date'], ['excerpt', 'Excerpt']],
  catalog: [['title', 'Title'], ['price', 'Price'], ['status', 'Status'], ['category', 'Category'], ['date', 'Date added']],
};
// Select defaults (mirrored by the renderer fallbacks in src/og-pages.ts).
const SHARE_DEFAULTS = { towns: { headline: 'name', subline: 'none' }, catalog: { headline: 'title', subline: 'price' } };
function emitShareType(t, indent) {
  const p = pad(indent);
  const fields = SHARE_FIELDS[t.kind] || SHARE_FIELDS.article;
  const dflt = SHARE_DEFAULTS[t.kind] || { headline: 'title', subline: 'none' };
  const labelOf = (v) => (v === 'none' ? 'None' : (fields.find(([k]) => k === v) || [])[1] || v);
  const opts = fields.map(([v, l]) => `${p}        - { label: ${q(l)}, value: ${v} }`);
  const business = `${p}        - { label: "Business name", value: business }`;
  return [
    `${p}- name: ${t.key}`,
    `${p}  label: ${q(t.label)}`,
    `${p}  widget: object`,
    // Gate convention: collapsed:false is load-bearing — the enabled switch must stay mounted in both UI states, since open/closed is the custom .stomme-open class and never Sveltia's disclosure (THEME_CSS GATED + editor.js).
    `${p}  collapsed: false`,
    `${p}  fields:`,
    `${p}    - { name: enabled, label: "Generate cards for these", widget: boolean, required: false, default: false }`,
    `${p}    - name: style`,
    `${p}      label: "Card style"`,
    `${p}      widget: select`,
    `${p}      required: false`,
    `${p}      default: editorial`,
    `${p}      options:`,
    `${p}        - { label: "Editorial — text over a gradient at the bottom", value: editorial }`,
    `${p}        - { label: "Bold — big centred statement", value: bold }`,
    `${p}        - { label: "Ops — text panel on the left", value: ops }`,
    `${p}    - name: headlineField`,
    `${p}      label: "Headline"`,
    `${p}      widget: select`,
    `${p}      required: false`,
    `${p}      default: ${dflt.headline}`,
    `${p}      hint: ${q("The card's big line — filled from each item. Empty = " + labelOf(dflt.headline) + '.')}`,
    `${p}      options:`,
    ...opts,
    business,
    `${p}    - name: sublineField`,
    `${p}      label: "Second line"`,
    `${p}      widget: select`,
    `${p}      required: false`,
    `${p}      default: ${dflt.subline}`,
    `${p}      hint: ${q('A smaller line under the headline. Empty = ' + labelOf(dflt.subline) + '.')}`,
    `${p}      options:`,
    `${p}        - { label: "None", value: none }`,
    ...opts,
    business,
    `${p}    - { name: scrim, label: "Scrim strength", widget: number, value_type: int, min: 0, max: 100, default: 55, required: false, hint: "How dark the gradient over the photo is (0–100). More = better text contrast, less photo." }`,
    `${p}    - { name: showLogo, label: "Show the wordmark", widget: boolean, required: false, default: true }`,
    `${p}    - { name: accent, label: "Accent colour", widget: color, required: false, hint: "The accent rule and wordmark accent. Empty uses your brand colour." }`,
  ].join('\n');
}
function emitShareCards(indent) {
  const p = pad(indent);
  const types = shareTypeList();
  // The og + og.types wrappers exist only for the data path (og.enabled, og.types.<key>): the editor renders them CHROME-LESS by data-key-path in THEME_CSS so the pane reads flat, and collapsed:false is load-bearing — their content must always be visible.
  const typeFields = types.length
    ? [`${p}        - name: types`, `${p}          label: "Per content type"`, `${p}          widget: object`,
       `${p}          collapsed: false`,
       `${p}          hint: "Turn a type on and open it to pick its card style and text lines."`,
       `${p}          fields:`,
       ...types.map((t) => emitShareType(t, indent + 12))].join('\n')
    : `${p}        - { name: _notypes, label: "Per content type", widget: hidden, required: false }`;
  return [
    `${p}- name: sharecards`,
    `${p}  label: "Share cards"`,
    `${p}  file: "src/content/settings/site.md"`,
    `${p}  fields:`,
    `${p}    - { name: ogImage, label: "Site default share image", widget: image, required: false, media_folder: "/public/media/share", public_folder: "/media/share", hint: "Shown when a page is shared (iMessage, Slack, social) and it has no card of its own. Use ~1200×630px." }`,
    // Always-rendered object (no `required: false`): Sveltia wraps an optional object behind an "Add …" button, which would hide the master toggle and the per-type sections.
    `${p}    - name: og`,
    `${p}      label: "Generated share cards"`,
    `${p}      widget: object`,
    `${p}      collapsed: false`,
    `${p}      fields:`,
    `${p}        - { name: enabled, label: "Generate a card per item", widget: boolean, required: false, default: false, hint: "Each item's photo becomes a 1200×630 card with your wordmark and a headline. Off = everything shares the site default image above." }`,
    typeFields,
  ].join('\n');
}

// emitSettings takes no indent, unlike every other emitter: its panes are written at absolute indentation, with the `settings` collection itself at indent 2.
function emitSettings() {
  const tp = emitTrackingPane(6);
  return `  - name: settings
    label: "Settings"
    files:
      - name: site
        label: "Identity"
        file: "src/content/settings/site.md"
        fields:
          - { name: name, label: "Business name", widget: string, hint: "Company name — used in the footer ©, the contact card, and search structured data. Not a page title." }
          - name: logo
            label: "Logo"
            widget: object
            collapsed: true
            hint: "Shown in the header and footer (each chooses what to display)."
            fields:
              - { name: image, label: "Logo mark (shown beside the text)", widget: image, required: false, media_folder: "/public/media/identity", public_folder: "/media/identity", hint: "An icon/mark. The wordmark is the text below, set in your display font." }
              - { name: alt, label: "Logo alt text", widget: string, required: false }
              - { name: textPre, label: "Wordmark text", widget: string, required: false }
              - { name: textAccent, label: "Wordmark accent (in brand colour)", widget: string, required: false }
          - { name: favicon, label: "Favicon", widget: image, required: false, media_folder: "/public/media/icons", public_folder: "/", hint: "Browser-tab icon — SVG recommended (scales to any size). Defaults to the shipped mark when empty." }
          - { name: appleIcon, label: "Home-screen icon", widget: image, required: false, media_folder: "/public/media/icons", public_folder: "/", hint: "iOS home-screen icon — a 180×180 PNG. Optional." }
${emitShareCards(6)}
      - name: contact
        label: "Contact"
        file: "src/content/contact/contact.md"
        fields:
          - { name: phone, label: "Phone", widget: string, required: false }
          - { name: phoneE164, label: "Phone (tel: link)", widget: string, required: false, hint: "Digits with country code, e.g. +46701234567 — used for the click-to-call link." }
          - { name: email, label: "Email", widget: string, required: false }
          - { name: protectContact, label: "Hide phone & email from scrapers", widget: boolean, required: false, default: false, hint: "Reveals them in the browser instead of putting them in the page source. Visitors still see and tap them; harvesters that don't run JavaScript get nothing." }
          - name: address
            label: "Address"
            widget: object
            collapsed: true
            hint: "Shown on the card + Find-us block, powers the map, and feeds local-search data."
            fields:
              - { name: street, label: "Street", widget: string, required: false }
              - { name: postcode, label: "Postcode", widget: string, required: false }
              - { name: city, label: "City", widget: string, required: false }
              - { name: country, label: "Country", widget: string, required: false }
              - { name: lat, label: "Latitude (map)", widget: number, required: false, value_type: float, hint: "From Google Maps: right-click the spot → the coordinates. e.g. 57.7089" }
              - { name: lng, label: "Longitude (map)", widget: number, required: false, value_type: float }
          - name: hours
            label: "Opening hours"
            widget: list
            required: false
            collapsed: true
            label_singular: "hours line"
            summary: "{{fields.days}} · {{fields.hours}}"
            fields:
              - { name: days, label: "Days", widget: string, hint: "e.g. Mon–Fri" }
              - { name: hours, label: "Hours", widget: string, hint: "e.g. 08:00–17:00, or Closed" }
          - { name: hoursNote, label: "Note under the hours", widget: string, required: false, hint: "Small print under the list — e.g. Closed 12:00–13:00 for lunch." }
          - name: holidayHours
            label: "Holiday / special hours"
            widget: list
            required: false
            collapsed: true
            label_singular: "holiday line"
            summary: "{{fields.when}} · {{fields.note}}"
            fields:
              - { name: when, label: "When", widget: string, hint: "e.g. Dec 24–26" }
              - { name: note, label: "Note", widget: string, hint: "e.g. Closed for the holidays" }
          - name: away
            label: "Away banner"
            widget: object
            collapsed: false
            hint: "Shows a notice on every contact card. Auto-hides after the date."
            fields:
              - { name: enabled, label: "Show the away banner", widget: boolean, required: false, default: false }
              - { name: message, label: "Message", widget: string, required: false, hint: "e.g. Away until Jan 8 — leave a message and we'll reply then." }
              - { name: until, label: "Auto-hide after", widget: datetime, date_format: "YYYY-MM-DD", time_format: false, required: false }
          - name: socials
            label: "Social profiles"
            widget: list
            required: false
            collapsed: true
            label_singular: "profile"
            summary: "{{fields.platform}}"
            fields:
              - { name: platform, label: "Platform", widget: string, hint: "Instagram, LinkedIn, Facebook…" }
              - { name: url, label: "URL", widget: string }
          - { name: orgNr, label: "Org. number", widget: string, required: false }
          - { name: founded, label: "Founded (year)", widget: string, required: false }
      - name: theme
        label: "Theme colours"
        file: "src/content/theme/theme.md"
        fields:
          - { name: brand, label: "Primary", widget: color, default: "#4338ca", hint: "Buttons, links and key accents." }
          - { name: ink, label: "Text", widget: color, default: "#1f2937", hint: "Default body-text colour." }
          - { name: onDark, label: "Text on primary", widget: color, default: "#ffffff", hint: "Button labels and text on dark/brand bands." }
          - { name: surface, label: "Tinted surface", widget: color, default: "#e0e7ff", hint: "Soft background for highlighted sections." }
          - { name: paper, label: "Page background", widget: color, default: "#ffffff", hint: "The main page background." }
          - { name: line, label: "Borders & lines", widget: color, default: "#e5e7eb", hint: "Card borders, dividers, rules." }
          - { name: secondary, label: "Secondary", widget: color, required: false, default: "#3b82f6", hint: "A second accent you deploy by choice (eyebrow, callout)." }
          - { name: highlight, label: "Highlight", widget: color, default: "#f59e0b", hint: "Attention accent — tags, badges, status. Used in isolation." }
          - name: eyebrow
            label: "Eyebrow style"
            widget: select
            required: false
            default: dash
            hint: "The small label above headings (e.g. “OUR SERVICES”) — site-wide."
            options:
              - { label: "Dash", value: dash }
              - { label: "Bullet", value: bullet }
              - { label: "Bold (no marker)", value: bold }
          - name: eyebrowColor
            label: "Eyebrow colour"
            widget: select
            required: false
            default: brand
            hint: "Which accent the eyebrow marker uses."
            options:
              - { label: "Brand", value: brand }
              - { label: "Secondary", value: secondary }
              - { label: "Highlight", value: highlight }
          - { name: dark, label: "Dark section background", widget: color, required: false, hint: "Background for blocks set to the Dark surface. Empty = derived from Primary." }
          - { name: darkInk, label: "Dark section text", widget: color, required: false, hint: "Text colour on dark sections. Empty = a light off-white." }
          - { name: darkLine, label: "Dark section borders", widget: color, required: false, hint: "Card borders / dividers on dark sections. Empty = a faint light rule." }
          - name: fontDisplay
            label: "Heading font"
            widget: select
            required: false
            hint: "Font for headings. Empty = system default."
            options:
              - { label: "System (default)", value: "system" }
              - { label: "Serif (elegant headlines)", value: "serif" }
              - { label: "Grotesk (clean sans)", value: "grotesk" }
              - { label: "Inter", value: "inter" }
              - { label: "Inter Tight", value: "inter-tight" }
              - { label: "Geometric (Futura-style)", value: "geometric" }
              - { label: "Rounded", value: "rounded" }
              - { label: "Slab serif", value: "slab" }
              - { label: "Condensed (narrow headlines)", value: "condensed" }
              - { label: "Humanist (open, legible)", value: "humanist" }
              - { label: "Script (handwritten)", value: "script" }
              - { label: "Monospace", value: "mono" }
              - { label: "Custom (uploaded below)", value: "custom" }
          - name: fontBody
            label: "Body font"
            widget: select
            required: false
            hint: "Font for body text. Empty = system default."
            options:
              - { label: "System (default)", value: "system" }
              - { label: "Serif (elegant headlines)", value: "serif" }
              - { label: "Grotesk (clean sans)", value: "grotesk" }
              - { label: "Inter", value: "inter" }
              - { label: "Inter Tight", value: "inter-tight" }
              - { label: "Geometric (Futura-style)", value: "geometric" }
              - { label: "Rounded", value: "rounded" }
              - { label: "Slab serif", value: "slab" }
              - { label: "Condensed (narrow headlines)", value: "condensed" }
              - { label: "Humanist (open, legible)", value: "humanist" }
              - { label: "Script (handwritten)", value: "script" }
              - { label: "Monospace", value: "mono" }
              - { label: "Custom (uploaded below)", value: "custom" }
          - { name: fontCustomFile, label: "Custom heading font file", widget: file, required: false, media_folder: "/public/media/fonts", public_folder: "/media/fonts", hint: "Used when Heading font = Custom. A .woff2 / .woff / .ttf / .otf file (a font file, not an SVG)." }
          - { name: fontCustomBodyFile, label: "Custom body font file", widget: file, required: false, media_folder: "/public/media/fonts", public_folder: "/media/fonts", hint: "Used when Body font = Custom. Leave empty to reuse the heading font for body." }
      - name: nav
        label: "Header"
        file: "src/content/navigation/nav.md"
        fields:
          - { name: sticky, label: "Sticky header", widget: boolean, required: false, default: false, hint: "Header stays fixed at the top while scrolling. Default: it scrolls away with the page." }
          - { name: showLogo, label: "Show logo mark", widget: boolean, required: false, default: true, hint: "Show the logo image (set under Identity) in the header." }
          - { name: showWordmark, label: "Show wordmark text", widget: boolean, required: false, default: true, hint: "Show the wordmark text (set under Identity) in the header." }
${emitNavLinks(10)}
      - name: footer
        label: "Footer"
        file: "src/content/footer/footer.md"
        fields:
          - { name: dark, label: "Dark footer", widget: boolean, required: false, default: false, hint: "Use the dark surface for the footer." }
          - { name: showLogo, label: "Show logo mark", widget: boolean, required: false, default: true, hint: "Show the logo image (set under Identity) in the footer." }
          - { name: showWordmark, label: "Show wordmark text", widget: boolean, required: false, default: true, hint: "Show the wordmark text (set under Identity) in the footer." }
          - { name: tagline, label: "Tagline", widget: string, required: false, hint: "A line under the logo." }
          - { name: showLinks, label: "Show quick links", widget: boolean, required: false, default: true }
${emitFooterLinks(10)}
          - { name: showTowns, label: "Show service areas", widget: boolean, required: false, default: false, hint: "Adds a column linking every entry in the Areas collection." }
          - { name: townsHeading, label: "Service areas · heading", widget: string, required: false, default: "Areas" }
          - { name: note, label: "Note", widget: string, required: false, hint: "Appended to the © line." }
      - label: "Form confirmation"
        name: thanks
        file: "src/content/thanks/thanks.md"
        fields:
          - name: variant
            label: "Layout"
            widget: select
            required: false
            default: classic
            hint: "Letter renders the visitor's message as a postmarked letter."
            options:
              - { label: "Classic", value: "classic" }
              - { label: "Letter (postmarked)", value: "letter" }
          - { name: heading, label: "Heading", widget: string, required: false, hint: "Big confirmation headline. Blank = localized default." }
          - { name: message, label: "Message", widget: text, required: false, hint: "Reassurance line under the heading. Blank = default." }
${emitThanksButtons(10)}
          - { name: showContact, label: "Show the direct-contact card", widget: boolean, required: false, default: true, hint: "Phone / email / hours from Site & contact." }${tp ? '\n' + tp : ''}${addonPanelFiles('settings', 6)}`;
}

// Files an out-of-tree extension contributes to a collection the engine emits. Appended last, so a site's own settings can never be displaced by one.
function addonPanelFiles(collection, indent) {
  const entries = ADDON_PANEL_FILES[collection] || [];
  if (!entries.length) return '';

  const p = pad(indent);
  return '\n' + entries
    .map((e) => e.yaml.replace(/\n+$/, '').split('\n').map((l) => (l ? p + l : l)).join('\n'))
    .join('\n');
}

// Only emitted when the `tracking` feature is on: into a `tracking:generated` region on static-pane sites, folded into emitSettings on generated-settings ones. The feature flag is the master switch; this pane only holds the IDs.
function trackingPaneYaml(indent) {
  const p = ' '.repeat(indent);
  return [
    `${p}- label: "Tracking & cookies"`,
    `${p}  name: tracking`,
    `${p}  file: "src/content/tracking/tracking.md"`,
    `${p}  fields:`,
    `${p}    - { name: gtmId, label: "Google Tag Manager ID", widget: string, required: false, hint: "GTM-XXXXXX. Covers GA4 and most pixels via your container." }`,
    `${p}    - { name: ga4Id, label: "Google Analytics 4 ID", widget: string, required: false, hint: "G-XXXXXXX. Only if you load GA4 directly (not via GTM)." }`,
    `${p}    - { name: metaPixelId, label: "Meta (Facebook) Pixel ID", widget: string, required: false }`,
    `${p}    - { name: privacyUrl, label: "Privacy policy URL", widget: string, required: false, hint: "Linked from the cookie banner, e.g. /integritetspolicy." }`,
  ].join('\n');
}
function emitTrackingPane(indent) {
  return FEATURES && FEATURES.tracking ? trackingPaneYaml(indent) : '';
}
  return { generatedEditors, emitCollections, emitCms, emitSettings, emitTrackingPane };
}
