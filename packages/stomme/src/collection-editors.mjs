import { localeFilePath } from './cms-i18n.mjs';

export function makeCollectionEditors({ q, emitField, emitWidget, buttonField, localized = () => false }) {
const on = (name) => !!localized(name);
const line = (name, indent, text) => (on(name) ? `\n${' '.repeat(indent)}${text}` : '');
const inline = (name, value) => (on(name) ? `, i18n: ${value}` : '');
const filePath = (name, path) => (on(name) ? localeFilePath(path) : path);
// No field-level media_folder in any editor below: the CMS resolves it relative to the entry, which breaks uploads from subfolder entries — the global media_folder in config.yml is the one that works.
const COLLECTION_EDITORS = {
  home: `- name: home
  label: "Home page"${line('home', 2, 'i18n: true')}
  files:
    - name: home
      label: "Home"
      file: "${filePath('home', 'src/content/home/home.md')}"${line('home', 6, 'i18n: true')}
      fields:
        - name: seo
          label: "SEO"
          widget: object
          collapsed: true${line('home', 10, 'i18n: true')}
          fields:
            - { name: title, label: "SEO title", widget: string${inline('home', 'true')} }
            - { name: description, label: "SEO description", widget: text${inline('home', 'true')} }
${emitWidget(8, on('home'))}`,
  pages: `- name: pages
  label: "Pages"
  label_singular: "Page"
  folder: "src/content/pages"
  create: true
  slug: "{{slug}}"${line('pages', 2, 'i18n: true')}
  fields:
    - { name: title, label: "Title", widget: string${inline('pages', 'true')} }
    - { name: published, label: "Published", widget: boolean, default: true, required: false, hint: "Uncheck to hide the page — unpublished pages aren't built."${inline('pages', 'duplicate')} }
    - name: seo
      label: "SEO"
      widget: object
      collapsed: true${line('pages', 6, 'i18n: true')}
      fields:
        - { name: title, label: "SEO title", widget: string${inline('pages', 'true')} }
        - { name: description, label: "SEO description", widget: text${inline('pages', 'true')} }
${emitWidget(4, on('pages'))}`,
  faq: `- name: faq
  label: "FAQ"
  label_singular: "Question"
  folder: "src/content/faq"
  create: true
  reorder: true
  summary: "{{fields.question}}"
  slug: "{{slug}}"
  fields:
    - { name: question, label: "Question", widget: string }
    - { name: answer, label: "Answer", widget: text }
    - { name: order, widget: hidden, required: false, default: 0 }
    - name: tags
      label: "Tags"
      widget: list
      required: false
      collapsed: true
      summary: "{{fields.tag}}"
      hint: "Scope the question to pages: an FAQ block filtered on a tag (e.g. a service or town) shows every question carrying it. Click a suggested tag to add it, or type a new one."
      field: { name: tag, label: "Tag", widget: string }`,
  testimonials: `- name: testimonials
  label: "Testimonials"
  label_singular: "Testimonial"
  folder: "src/content/testimonials"
  create: true
  reorder: true
  summary: "{{fields.name}}"
  slug: "{{slug}}"
  fields:
    - { name: name, label: "Name", widget: string }
    - { name: role, label: "Role / company", widget: string, required: false }
    - { name: quote, label: "Quote", widget: text }
    - { name: order, widget: hidden, required: false, default: 0 }`,
  towns: `- name: towns
  label: "Service areas"
  label_singular: "Area"
  folder: "src/content/towns"
  create: true
  reorder: true
  summary: "{{fields.name}}"
  slug: "{{slug}}"
  fields:
    - { name: name, label: "Town name", widget: string }
    - { name: title, label: "Page heading (H1)", widget: string, required: false }
    - name: seo
      label: "SEO"
      widget: object
      collapsed: true
      required: false
      summary: "{{fields.title}}"
      fields:
        - { name: title, label: "Title", widget: string }
        - { name: description, label: "Description", widget: text }
        - { name: image, label: "Share image", widget: image, required: false, hint: "Social-share card (og:image), 1200×630. Site default used when empty." }
        - { name: ogRaw, label: "Share the image as-is", widget: boolean, required: false, default: false, hint: "Only matters when generated share cards are on (Identity settings): skip the card for this page and share the plain image instead." }
    - { name: order, widget: hidden, required: false, default: 0 }
    - { name: heroSubtitle, label: "Hero subtitle", widget: text, required: false }
    - { name: heroNote, label: "Hero note", widget: string, required: false }
    - { name: why, label: "Why us here (paragraphs)", widget: text, required: false }
    - name: problems
      label: "Problems we solve"
      widget: list
      required: false
      label_singular: "Problem"
      collapsed: true
      field: { name: item, label: "Problem", widget: string }
    - name: districts
      label: "Districts / areas"
      widget: list
      required: false
      label_singular: "District"
      collapsed: true
      field: { name: item, label: "District", widget: string }
    - { name: localCase, label: "Local case", widget: text, required: false }
    - name: services
      label: "Services offered here"
      widget: list
      required: false
      label_singular: "Service"
      collapsed: true
      field: { name: item, label: "Service", widget: string }
    - name: media
      label: "Media"
      widget: object
      collapsed: true
      hint: "The photo beside the page heading."
      fields:
        - { name: image, label: "Image", widget: image, required: false }
        - { name: imageAlt, label: "Image alt text", widget: string, required: false }`,
  services: `- name: services
  label: "Services"
  label_singular: "Service"
  folder: "src/content/services"
  create: true
  reorder: true
  summary: "{{fields.navLabel}}"
  slug: "{{slug}}"
  fields:
    - { name: title, label: "Title (H1)", widget: string }
    - name: seo
      label: "SEO"
      widget: object
      collapsed: true
      required: false
      summary: "{{fields.title}}"
      fields:
        - { name: title, label: "Title", widget: string }
        - { name: description, label: "Description", widget: text }
        - { name: image, label: "Share image", widget: image, required: false, hint: "Social-share card (og:image), 1200×630. Site default used when empty." }
        - { name: ogRaw, label: "Share the image as-is", widget: boolean, required: false, default: false, hint: "Only matters when generated share cards are on (Identity settings): skip the card for this page and share the plain image instead." }
    - { name: navLabel, label: "Short label (menus/cards)", widget: string }
    - { name: summary, label: "Summary", widget: text, required: false, hint: "The lede under the title — also the card text in service lists." }
    - { name: order, widget: hidden, required: false, default: 0 }
    - name: media
      label: "Media"
      widget: object
      collapsed: true
      hint: "Shown on the service card in lists and beside the page header."
      fields:
        - { name: image, label: "Image", widget: image, required: false }
        - { name: imageAlt, label: "Image alt text", widget: string, required: false, hint: "Leave empty for decorative art." }
    - name: hero
      label: "Page header (composed pages)"
      widget: object
      collapsed: true
      hint: "Only used when the page is built from sections below: renders a compact page header (title + summary + these extras, image beside the text) instead of the plain one."
      fields:
        - name: ticks
          label: "Ticks (checkmark lines)"
          widget: list
          required: false
          label_singular: "Line"
          collapsed: true
          hint: "Short ✓ lines under the summary — key reassurances."
          field: { name: text, label: "Line", widget: string }
${emitField({ ...buttonField('cta', 'Button'), hint: "The header always shows a button — blank label and link fall back to the site's quote button and the contact page." }, 8)}
${emitField({ ...buttonField('cta2', 'Second button'), hint: 'A quiet text link beside the button — e.g. link to #process to jump to a section with that anchor.' }, 8)}
${emitWidget(4)}
    - { name: body, label: "Long-form text (fallback)", widget: markdown, required: false, hint: "Only shown when no sections are built above. Prefer sections; this is the simple prose fallback." }`,
};

function listingEditor(l) {
  const articleFields = `    - { name: title, label: "Title", widget: string }
    - { name: date, label: "Date", widget: datetime, date_format: "YYYY-MM-DD", time_format: false }
    - { name: excerpt, label: "Excerpt", widget: text, required: false }
    - { name: cover, label: "Cover image", widget: image, required: false }
    - { name: showCover, label: "Show cover", widget: boolean, required: false, default: false, hint: "Show a cover on cards + the article — your image, or a themed default if none." }
    - { name: body, label: "Body", widget: markdown }`;
  const specs = (Array.isArray(l.specs) ? l.specs : []).map((s, i) =>
    typeof s === 'string' ? { key: `spec_${i}`, label: s } : { key: s.key || `spec_${i}`, label: s.label });
  const specsField = specs.length
    ? `\n    - name: specs
      label: "Specs"
      widget: object
      collapsed: true
      fields:
${specs.map((s) => `        - { name: ${s.key}, label: ${q(s.label)}, widget: string, required: false }`).join('\n')}`
    : '';
  const catalogFields = `    - { name: title, label: "Title", widget: string }
    - { name: price, label: "Price", widget: string, required: false }
    - name: status
      label: "Status"
      widget: select
      default: available
      options:
        - { label: "Available", value: available }
        - { label: "Reserved", value: reserved }
        - { label: "Sold", value: sold }
    - { name: category, label: "Category", widget: string, required: false }
    - { name: cover, label: "Cover image", widget: image, required: false }
    - name: gallery
      label: "Gallery"
      widget: list
      required: false
      collapsed: true
      label_singular: "Image"
      fields:
        - { name: image, label: "Image", widget: image }
        - { name: alt, label: "Alt text", widget: string, required: false }${specsField}
    - { name: date, label: "Date added", widget: datetime, date_format: "YYYY-MM-DD", time_format: false, required: false }
    - { name: body, label: "Description", widget: markdown, required: false }`;
  return `- name: ${l.id}
  label: ${q(l.label || l.id)}
  folder: "src/content/${l.id}"
  create: true
  slug: "{{slug}}"
  fields:
${l.preset === 'catalog' ? catalogFields : articleFields}`;
}
  return { COLLECTION_EDITORS, listingEditor };
}
