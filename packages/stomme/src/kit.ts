import { ICON_NAMES } from './icons.ts';

// FIELD POLICY (engine invariant): a new field is OPT-IN — absent from the frontmatter means off — and it must never get an `x !== false` fallback, because the CMS shows an absent boolean as OFF whatever `default:` says, so absent-means-on both changes what existing sites render and makes the editor lie. The dozen legacy `!== false` fields predate the rule and can only flip once every site's content carries an explicit value.
export type Field = {
  name: string;
  label: string;
  widget: 'string' | 'text' | 'image' | 'boolean' | 'number' | 'list' | 'object' | 'select' | 'markdown' | 'hidden' | 'file';
  required?: boolean;
  default?: unknown;
  hint?: string;
  fields?: Field[];
  field?: Field;
  summary?: string;
  label_singular?: string;
  collapsed?: boolean;
  multiple?: boolean;
  options?: '$pages' | '$services' | '$faq' | '$faqTags' | { label: string; value: string }[];
  media_folder?: string;
  public_folder?: string;
};

export type BlockDef = {
  type: string;
  label: string;
  fields: Field[];
  collection?: string;
  feature?: string;
  group?: string;
  summary?: string;
  shape?: string;
  sample?: Record<string, unknown>;
  samples?: ({ _label?: string } & Record<string, unknown>)[];
};

// A REQUIRED object with collapsed:false, both load-bearing: the editor theme renders it chrome-less inline (page + url side by side) rather than behind an "Add …" step, and that flat rendering needs the children mounted. Children stay optional so nothing-filled leaves the key absent; the custom url wins over the page, and resolveLink() (stomme/href) still accepts a legacy plain-string href.
export const linkField = (name = 'href', label = 'Link'): Field => ({
  name,
  label,
  widget: 'object',
  collapsed: false,
  fields: [
    { name: 'page', label: 'Page', widget: 'select', options: '$pages', required: false, hint: 'Pick a page on the site.' },
    { name: 'url', label: '…or a custom URL', widget: 'string', required: false, hint: 'External link, tel: or mailto:. Used if filled.' },
  ],
});

export const buttonField = (name: string, label = 'Button', opts: { hint?: string; labelHint?: string; optionalLabel?: boolean } = {}): Field => ({
  name,
  label,
  widget: 'object',
  required: false,
  collapsed: true,
  summary: '{{fields.label}}',
  ...(opts.hint ? { hint: opts.hint } : {}),
  fields: [
    { name: 'label', label: 'Label', widget: 'string', ...(opts.optionalLabel ? { required: false } : {}), ...(opts.labelHint ? { hint: opts.labelHint } : {}) },
    linkField('link', 'Link'),
  ],
});

export const headingFields: Field[] = [
  { name: 'eyebrow', label: 'Eyebrow', widget: 'string', required: false, hint: 'Small uppercase label above the heading.' },
  { name: 'heading', label: 'Heading', widget: 'string', required: false },
  { name: 'intro', label: 'Intro', widget: 'text', required: false },
];

export const headingFieldsWith = (eyebrow?: string, heading?: string): Field[] => [
  { name: 'eyebrow', label: 'Eyebrow', widget: 'string', required: false, hint: 'Small uppercase label above the heading.', ...(eyebrow ? { default: eyebrow } : {}) },
  { name: 'heading', label: 'Heading', widget: 'string', required: false, ...(heading ? { default: heading } : {}) },
  { name: 'intro', label: 'Intro', widget: 'text', required: false },
];

export { ICON_NAMES };

export const iconField = (name = 'icon', label = 'Icon'): Field => ({
  name,
  label,
  widget: 'select',
  required: false,
  options: ICON_NAMES.map((v) => ({ label: v, value: v })),
  hint: 'Optional icon.',
});

// BlockRenderer applies this centrally by wrapping the block in a full-bleed band — a block never paints its own surface.
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

export const group = (name: string, label: string, hint: string, fields: Field[]): Field => ({
  name,
  label,
  widget: 'object',
  collapsed: true,
  hint,
  fields,
});

export const mediaGroup = (hint: string, fields: Field[], summary?: string): Field => ({
  ...group('media', 'Media', hint, fields),
  ...(summary ? { summary } : {}),
});

export const layoutGroup = (fields: Field[]): Field =>
  group('layout', 'Layout', 'Size and placement — rarely needs changing.', fields);

// ALWAYS the last field of a block; defaults to the surface + accent pair, and a block that renders only one passes the subset it uses.
export const styleGroup = (fields?: Field[]): Field =>
  group('style', 'Appearance', 'Background and accent colour — set once when the page is designed.', fields ?? [surfaceField, accentField]);

// No field-level media_folder on purpose: uploads must go through the generator's absolute collection-level folders that organize the whole public/media library, which the build-bridge mirrors to src/assets/media so Astro's image pipeline (via Cover.astro) optimises them.
export const imageField = (name = 'image', label = 'Image', hint?: string): Field => ({
  name,
  label,
  widget: 'image',
  required: false,
  ...(hint ? { hint } : {}),
});

export const cardListField: Field = {
  name: 'items',
  label: 'Cards',
  widget: 'list',
  required: false,
  collapsed: true,
  label_singular: 'Card',
  summary: '{{fields.title}}',
  fields: [
    { name: 'title', label: 'Title', widget: 'string' },
    { name: 'body', label: 'Text', widget: 'text' },
  ],
};

export const linkedCardListField: Field = {
  name: 'items',
  label: 'Cards',
  widget: 'list',
  required: false,
  collapsed: true,
  label_singular: 'Card',
  summary: '{{fields.title}}',
  fields: [
    iconField(),
    { name: 'title', label: 'Title', widget: 'string' },
    { name: 'body', label: 'Text', widget: 'text' },
    { name: 'tag', label: 'Tag (footer label)', widget: 'string', required: false, hint: 'Small uppercase label at the card foot, e.g. a method term.' },
    buttonField('cta', 'Link', { optionalLabel: true, labelHint: 'Blank shows "Read more".', hint: 'Make the card clickable.' }),
  ],
};
