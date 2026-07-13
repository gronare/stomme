// ─────────────────────────────────────────────────────────────────────────
// Block kit — the reusable, site-agnostic contract for the page builder.
//
// The ENGINE: field/block types + a few field helpers. The site supplies the
// catalog (schema.ts) and the components. Labels here are English defaults; a
// localised site can override them by passing its own field definitions.
//
// Consumed by:
//   • the site's schema.ts          — to declare its BLOCKS
//   • stomme-gen (bin)            — to emit the Decap CMS config
// ─────────────────────────────────────────────────────────────────────────

// ── FIELD POLICY (engine invariant) ─────────────────────────────────────────
// A new field must be OPT-IN: absent from the frontmatter = disabled / not shown.
// Never write an `x !== false` (absent = on) fallback for a NEW field — an engine
// update must not change what an existing site renders, and Decap displays an
// absent boolean as OFF regardless of `default:`, so absent-means-on makes the
// CMS lie. (A dozen legacy `!== false` fields predate this rule; flipping them
// requires seeding explicit values into every site's content first.)
export type Field = {
  name: string;
  label: string;
  widget: 'string' | 'text' | 'image' | 'boolean' | 'number' | 'list' | 'object' | 'select' | 'markdown';
  required?: boolean;
  default?: unknown;
  hint?: string;
  fields?: Field[]; // for object / typed list
  field?: Field; // for a simple (single-field) list
  summary?: string; // list widgets: collapsed-row label template (default: derived — eyebrow, then title/name/label/…)
  multiple?: boolean; // select: allow choosing several values
  // For select widgets: a literal option list, or a sentinel the generator
  // expands — '$pages' (all internal page routes), '$services' (service slugs),
  // '$faq' (faq question slugs) or '$faqTags' (distinct tags used on faq entries).
  options?: '$pages' | '$services' | '$faq' | '$faqTags' | { label: string; value: string }[];
  // For image widgets: override where uploads are stored. Point photos at
  // /src/assets/uploads so Astro optimises them at build (see Cover.astro).
  media_folder?: string;
  public_folder?: string;
};

export type BlockDef = {
  type: string; // discriminator stored in frontmatter + key in the renderer registry
  label: string; // shown in the CMS "add block" picker
  fields: Field[]; // editorial fields; [] = self-contained block (reads its own data)
  // Optional: the content collection this block reads its items from (e.g. `faq`,
  // `posts`). Declares the dependency so the engine can treat collections as an
  // optional "site kit" — `stomme-gen` drops the block from the CMS picker when
  // that collection isn't present (no `src/content/<name>/`). Settings-backed
  // blocks don't set this — settings always exists.
  collection?: string;
  // Picker/gallery metadata (optional): `group` clusters the block in the "add section"
  // ordering and the generated block gallery; `summary` is a one-line "what it produces";
  // `shape` keys a crude wireframe pictogram in the gallery. Purely editorial aids.
  group?: string;
  summary?: string;
  shape?: string;
  // Lookbook fixtures: representative content the /lookbook route renders so a theme can be
  // validated against EVERY block. `samples` lists variants (`_label` annotates each).
  // stomme-gen warns when a block has neither — keep them current with the fields.
  sample?: Record<string, unknown>;
  samples?: ({ _label?: string } & Record<string, unknown>)[];
};

// A link: pick a page from the dropdown OR type a custom URL (external / tel: /
// mailto: / anchor). The custom URL wins if both are set. Resolve the stored
// value with resolveLink() (stomme/href). The page dropdown options are filled
// from real routes by stomme-gen. Backward-compatible with a plain string href.
export const linkField = (name = 'href', label = 'Link', required = false): Field => ({
  name,
  label,
  widget: 'object',
  required,
  fields: [
    { name: 'page', label: 'Page', widget: 'select', options: '$pages', required: false, hint: 'Pick a page on the site.' },
    { name: 'url', label: '…or a custom URL', widget: 'string', required: false, hint: 'External link, tel: or mailto:. Used if filled.' },
  ],
});

// Common eyebrow + heading + intro trio most section blocks share.
export const headingFields: Field[] = [
  { name: 'eyebrow', label: 'Eyebrow', widget: 'string', required: false, hint: 'Small uppercase label above the heading.' },
  { name: 'heading', label: 'Heading', widget: 'string', required: false },
  { name: 'intro', label: 'Intro', widget: 'text', required: false },
];

// Same trio, but with the eyebrow/heading pre-filled via CMS `default:`. Use for a
// collection-backed block that shipped with fixed chrome you want to keep as the
// editable starting point — the editor sees real text (not a blank field whose
// content comes from a hidden fallback) and can change or clear it. Prefer this
// over component-side default copy. `intro` stays optional/off by default.
export const headingFieldsWith = (eyebrow?: string, heading?: string): Field[] => [
  { name: 'eyebrow', label: 'Eyebrow', widget: 'string', required: false, hint: 'Small uppercase label above the heading.', ...(eyebrow ? { default: eyebrow } : {}) },
  { name: 'heading', label: 'Heading', widget: 'string', required: false, ...(heading ? { default: heading } : {}) },
  { name: 'intro', label: 'Intro', widget: 'text', required: false },
];

// Curated icon set — must match the names in the site's Icon component.
export const ICON_NAMES = ['sun', 'panel', 'battery', 'home', 'roof', 'leaf', 'bolt', 'shield', 'wrench', 'headset', 'link', 'phone', 'mail'];

// An optional icon picker (used by cards).
export const iconField = (name = 'icon', label = 'Icon'): Field => ({
  name,
  label,
  widget: 'select',
  required: false,
  options: ICON_NAMES.map((v) => ({ label: v, value: v })),
  hint: 'Optional icon.',
});

// Section background — lets a block opt into the rhythm surfaces. Handled
// centrally by BlockRenderer (wraps the block in a full-bleed band).
export const surfaceField: Field = {
  name: 'surface',
  label: 'Background',
  widget: 'select',
  required: false,
  default: 'standard',
  options: [
    { label: 'Standard (white)', value: 'standard' },
    { label: 'Tinted', value: 'tint' },
    { label: 'Accent band', value: 'band' },
    { label: 'Dark', value: 'dark' },
    { label: 'Gradient', value: 'gradient' },
  ],
  hint: 'The surface behind the section — for rhythm between blocks.',
};

// Accent choice for a block's decorative accent (a rule, icon, or number). Sets
// `--block-accent`; the eyebrow marker is unaffected (it follows theme.eyebrowColor).
export const accentField: Field = {
  name: 'accent',
  label: 'Accent',
  widget: 'select',
  required: false,
  default: 'brand',
  options: [
    { label: 'Brand', value: 'brand' },
    { label: 'Secondary', value: 'secondary' },
    { label: 'Highlight', value: 'highlight' },
  ],
  hint: "This block's accent colour (rule, icon or number) — not the eyebrow.",
};

// Width toggle for text-led blocks (pageHeader / prose / steps): a narrow reading
// column (default) or the full section width. Grids ignore this — they're always full.
export const widthField: Field = {
  name: 'width',
  label: 'Width',
  widget: 'select',
  required: false,
  default: 'narrow',
  options: [
    { label: 'Narrow (reading column)', value: 'narrow' },
    { label: 'Full width', value: 'full' },
  ],
  hint: 'Narrow keeps text legible; full uses the whole section width.',
};

// An image field. Uploads use the CMS's GLOBAL media_folder/public_folder
// (`src/assets/uploads` + `/src/assets/uploads` in config.yml) so Astro's image
// pipeline (via Cover.astro) optimises them at build. We intentionally do NOT set a
// field-level media_folder: Decap resolves that relative to the entry, which breaks
// uploads for entries in subfolders (e.g. a blog post in src/content/posts/ would
// upload to src/content/posts/src/assets/uploads and show an empty picker). The
// global setting is repo-root-relative and shows the whole media library.
export const imageField = (name = 'image', label = 'Image', hint?: string): Field => ({
  name,
  label,
  widget: 'image',
  required: false,
  ...(hint ? { hint } : {}),
});

// A reorderable list of title/body cards.
export const cardListField: Field = {
  name: 'items',
  label: 'Cards',
  widget: 'list',
  required: false,
  fields: [
    { name: 'title', label: 'Title', widget: 'string' },
    { name: 'body', label: 'Text', widget: 'text' },
  ],
};

// Like cardListField, but each card may optionally link somewhere — rendered as a
// clickable card with a "read more" affordance by blocks that support it (e.g.
// featureGrid). The link uses the standard linkField shape; resolve via resolveLink.
export const linkedCardListField: Field = {
  name: 'items',
  label: 'Cards',
  widget: 'list',
  required: false,
  fields: [
    iconField(),
    { name: 'title', label: 'Title', widget: 'string' },
    { name: 'body', label: 'Text', widget: 'text' },
    { name: 'tag', label: 'Tag (footer label)', widget: 'string', required: false, hint: 'Small uppercase label at the card foot, e.g. a method term.' },
    linkField('link', 'Link (optional)'),
    { name: 'linkLabel', label: 'Link label', widget: 'string', required: false, hint: 'E.g. "Read more". Shown only if the card has a link.' },
  ],
};
