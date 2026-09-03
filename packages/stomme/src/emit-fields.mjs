import { i18nFlagFor } from './cms-i18n.mjs';

export function makeEmitters({ q, pad, AVAILABLE_BLOCKS, OPTION_SOURCES }) {
  // The CMS labels a collapsed row with the FIRST field's value (an empty icon picker reads "No icon"), so derive a summary instead — eyebrow when present, then the identifying field; empty placeholders render as nothing. An explicit `summary` on the Field def wins.
  const SUMMARY_PRIORITY = ['title', 'name', 'label', 'question', 'quote', 'heading', 'statement', 'term', 'caption', 'text', 'alt', 'value'];
  function listSummary(fields) {
    const names = fields.map((f) => f.name);
    const parts = [];
    if (names.includes('eyebrow')) parts.push('{{fields.eyebrow}}');
    const main = SUMMARY_PRIORITY.find((n) => names.includes(n));
    if (main) parts.push(`{{fields.${main}}}`);
    return parts.length ? parts.join(' ') : null;
  }

  function emitField(f, indent, i18n = false) {
    const p = pad(indent);
    const flag = i18n ? i18nFlagFor(f) : null;
    const i18nLine = flag ? [`${p}  i18n: ${flag}`] : [];
    const parts = [`name: ${f.name}`, `label: ${q(f.label)}`, `widget: ${f.widget}`];
    if (f.required === false) parts.push('required: false');
    if (f.default !== undefined) parts.push(`default: ${typeof f.default === 'string' ? q(f.default) : f.default}`);
    if (f.pattern) parts.push(`pattern: [${f.pattern.map(q).join(', ')}]`);
    if (f.hint) parts.push(`hint: ${q(f.hint)}`);
    if (f.media_folder) parts.push(`media_folder: ${q(f.media_folder)}`);
    if (f.public_folder) parts.push(`public_folder: ${q(f.public_folder)}`);
    if (flag) parts.push(`i18n: ${flag}`);

    const collapseProps = () => [
      ...(f.label_singular ? [`${p}  label_singular: ${q(f.label_singular)}`] : []),
      ...(f.collapsed !== undefined ? [`${p}  collapsed: ${f.collapsed}`] : []),
    ];
    // media_folder/public_folder ride on `parts` for a leaf widget, but every container below builds its own lines — without splicing the pair in there too, an uploads path set on a list or an object is accepted by the catalog and silently never reaches the CMS.
    const mediaProps = () => [
      ...(f.media_folder ? [`${p}  media_folder: ${q(f.media_folder)}`] : []),
      ...(f.public_folder ? [`${p}  public_folder: ${q(f.public_folder)}`] : []),
    ];
    if (f.widget === 'blocks') {
      const types = AVAILABLE_BLOCKS.filter((b) => !b.fields.some((x) => x.widget === 'blocks'));
      const lines = [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: list`,
        ...(f.required === false ? [`${p}  required: false`] : []),
        ...collapseProps(),
        ...(f.hint ? [`${p}  hint: ${q(f.hint)}`] : []),
        ...mediaProps(),
        ...i18nLine,
        `${p}  summary: "{{fields.eyebrow}} {{fields.heading}}{{fields.quote}}"`,
        `${p}  types:`];
      for (const b of types) {
        lines.push(`${p}    - name: ${b.type}`, `${p}      label: ${q(b.label)}`, `${p}      widget: object`);
        if (flag) lines.push(`${p}      i18n: true`);
        lines.push(`${p}      fields:`);
        lines.push(...(b.fields.length
          ? b.fields.map((sf) => emitField(sf, indent + 8, i18n))
          : [`${p}        - { name: _auto, label: "Auto", widget: hidden${flag ? ', i18n: duplicate' : ''} }`]));
      }
      return lines.join('\n');
    }
    if (f.widget === 'list' && f.fields) {
      const sum = f.summary || listSummary(f.fields);
      return [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: list`,
        ...(f.required === false ? [`${p}  required: false`] : []),
        ...collapseProps(),
        ...(f.hint ? [`${p}  hint: ${q(f.hint)}`] : []),
        ...mediaProps(),
        ...i18nLine,
        ...(sum ? [`${p}  summary: ${q(sum)}`] : []),
        `${p}  fields:`, ...f.fields.map((sf) => emitField(sf, indent + 4, i18n))].join('\n');
    }
    if (f.widget === 'list' && f.field) {
      return [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: list`,
        ...(f.required === false ? [`${p}  required: false`] : []),
        ...collapseProps(),
        ...(f.hint ? [`${p}  hint: ${q(f.hint)}`] : []),
        ...mediaProps(),
        ...i18nLine,
        `${p}  field: ${emitFlow(f.field, i18n)}`].join('\n');
    }
    if (f.widget === 'object' && f.fields) {
      const head = [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: object`];
      if (f.required === false) head.push(`${p}  required: false`);
      // Gate convention: an object whose first field is the boolean `enabled` renders as a switch-card (THEME_CSS GATED + editor.js), and collapsed:false is load-bearing there — the switch must stay mounted in BOTH UI states, since open/closed is the custom .stomme-open class and never Sveltia's disclosure.
      const gated = f.fields[0]?.widget === 'boolean' && f.fields[0]?.name === 'enabled';
      if (gated) head.push(`${p}  collapsed: false`);
      else if (f.collapsed !== undefined) head.push(`${p}  collapsed: ${f.collapsed}`);
      if (f.summary) head.push(`${p}  summary: ${q(f.summary)}`);
      if (f.hint) head.push(`${p}  hint: ${q(f.hint)}`);
      head.push(...mediaProps());
      head.push(...i18nLine);
      head.push(`${p}  fields:`);
      return [...head, ...f.fields.map((sf) => emitField(sf, indent + 4, i18n))].join('\n');
    }
    if (f.widget === 'relation') {
      const list = (v) => `[${(Array.isArray(v) ? v : [v]).map(q).join(', ')}]`;
      return [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: relation`,
        ...(f.required === false ? [`${p}  required: false`] : []),
        `${p}  collection: ${q(f.collection)}`,
        `${p}  value_field: ${q(f.value_field || '{{slug}}')}`,
        ...(f.search_fields ? [`${p}  search_fields: ${list(f.search_fields)}`] : []),
        ...(f.display_fields ? [`${p}  display_fields: ${list(f.display_fields)}`] : []),
        ...(f.multiple ? [`${p}  multiple: true`] : []),
        ...(f.hint ? [`${p}  hint: ${q(f.hint)}`] : []),
        ...i18nLine].join('\n');
    }
    if (f.widget === 'select') {
      const opts = typeof f.options === 'string' ? OPTION_SOURCES[f.options] ?? [] : Array.isArray(f.options) ? f.options : [];
      const out = [`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`, `${p}  widget: select`];
      if (f.multiple) out.push(`${p}  multiple: true`);
      if (f.required === false) out.push(`${p}  required: false`);
      if (f.default !== undefined) out.push(`${p}  default: ${Array.isArray(f.default) ? `[${f.default.map(q).join(', ')}]` : q(f.default)}`);
      if (f.hint) out.push(`${p}  hint: ${q(f.hint)}`);
      out.push(...i18nLine);
      if (opts.length === 0) {
        out.push(`${p}  options: []`);
      } else {
        out.push(`${p}  options:`);
        for (const o of opts) out.push(`${p}    - { label: ${q(o.label)}, value: ${q(o.value)} }`);
      }
      return out.join('\n');
    }
    return `${p}- { ${parts.join(', ')} }`;
  }

  function emitFlow(f, i18n = false) {
    const flag = i18n ? i18nFlagFor(f) : null;
    const parts = [`name: ${f.name}`, `label: ${q(f.label)}`, `widget: ${f.widget}`];
    if (f.required === false) parts.push('required: false');
    if (flag) parts.push(`i18n: ${flag}`);
    return `{ ${parts.join(', ')} }`;
  }

  function emitWidget(indent, i18n = false) {
    const p = pad(indent);
    const lines = [
      `${p}- name: blocks`,
      `${p}  label: "Sections · build the page (drag to reorder)"`,
      `${p}  label_singular: "Section"`,
      `${p}  widget: list`,
      `${p}  required: false`,
      `${p}  collapsed: true`,
      ...(i18n ? [`${p}  i18n: true`] : []),
      `${p}  summary: "{{fields.eyebrow}} {{fields.heading}}{{fields.quote}}"`,
      `${p}  types:`,
    ];
    for (const b of AVAILABLE_BLOCKS) {
      lines.push(`${p}    - name: ${b.type}`, `${p}      label: ${q(b.label)}`, `${p}      widget: object`);
      if (i18n) lines.push(`${p}      i18n: true`);
      if (b.fields.length === 0) {
        lines.push(`${p}      fields:`, `${p}        - { name: _auto, label: "Auto", widget: hidden${i18n ? ', i18n: duplicate' : ''} }`);
      } else {
        lines.push(`${p}      fields:`, ...b.fields.map((f) => emitField(f, indent + 8, i18n)));
      }
    }
    return lines.join('\n');
  }

  // Rendered chrome-less inline by the editor theme — a nav label's link is inherent, and both fields blank makes a dropdown-only header. collapsed:false is load-bearing for that flat rendering: the children must stay mounted.
  function navLinkField(pageHint = 'Pick a page on the site. Leave blank for a dropdown-only header (the label just opens its menu).') {
    return {
      name: 'link', label: 'Link', widget: 'object', collapsed: false, fields: [
        { name: 'page', label: 'Page', widget: 'select', options: '$pages', required: false, hint: pageHint },
        { name: 'url', label: '…or a custom URL', widget: 'string', required: false, hint: 'External link, tel: or mailto: — overrides the page above.' },
      ],
    };
  }

  function emitFooterLinks(indent, i18n = false) {
    const footerLink = () => ({
      name: 'link', label: 'Link', widget: 'object', collapsed: false, fields: [
        { name: 'page', label: 'Page', widget: 'select', options: '$pages', required: false, hint: 'Pick a page on the site.' },
        { name: 'url', label: '…or a custom URL', widget: 'string', required: false, hint: 'External link, tel: or mailto: — overrides the page above.' },
      ],
    });
    const linkList = (name, label) => ({
      name, label, widget: 'list', required: false, collapsed: true, label_singular: 'Link', summary: '{{fields.label}}', fields: [
        { name: 'label', label: 'Label', widget: 'string' },
        footerLink(),
      ],
    });
    const fields = [
      { name: 'linksHeading', label: 'Quick links · heading', widget: 'string', required: false, hint: 'The heading above the quick links, e.g. "Links".' },
      linkList('links', 'Quick links'),
      { name: 'links2Heading', label: 'Second link group · heading', widget: 'string', required: false, hint: 'Optional extra column, e.g. your services.' },
      linkList('links2', 'Second link group'),
      linkList('legal', 'Legal links (bottom bar)'),
    ];
    return fields.map((f) => emitField(f, indent, i18n)).join('\n');
  }
  function emitNavLinks(indent, i18n = false) {
    const items = {
      name: 'items', label: 'Menu links', widget: 'list', required: false, collapsed: true, label_singular: 'Menu link', summary: '{{fields.label}}', fields: [
        { name: 'label', label: 'Label', widget: 'string' },
        navLinkField(),
        { name: 'menu', label: 'Dropdown from collection', widget: 'select', options: '$menus', required: false, hint: 'Optional. Fill a dropdown with every entry of a collection (e.g. all services). Overrides manual sub-links below.' },
        { name: 'children', label: '…or manual sub-links', widget: 'list', required: false, collapsed: true, label_singular: 'Sub-link', summary: '{{fields.label}}', fields: [{ name: 'label', label: 'Label', widget: 'string' }, navLinkField()] },
        { name: 'autoChildren', label: "List the page's subpages", widget: 'boolean', required: false, default: false, hint: 'Fills the dropdown with the pages that sit under the page above. A collection dropdown or manual sub-links win over it.' },
      ],
    };
    const cta = {
      name: 'cta', label: 'Button', widget: 'object', required: false, collapsed: true, summary: '{{fields.label}}', fields: [
        { name: 'label', label: 'Label', widget: 'string' },
        navLinkField(),
      ],
    };
    return [emitField(items, indent, i18n), emitField(cta, indent, i18n)].join('\n');
  }

  function buttonField(name, label, labelHint) {
    return {
      name, label, widget: 'object', required: false, collapsed: true, summary: '{{fields.label}}', fields: [
        { name: 'label', label: 'Label', widget: 'string', required: false, hint: labelHint },
        navLinkField('Pick a page on the site.'),
      ],
    };
  }
  function emitThanksButtons(indent) {
    return [
      emitField(buttonField('button', 'Primary button', 'Blank = localized default ("Back to home").'), indent),
      emitField(buttonField('button2', 'Second button'), indent),
    ].join('\n');
  }
  return { listSummary, emitField, emitFlow, emitWidget, navLinkField, emitFooterLinks, emitNavLinks, buttonField, emitThanksButtons };
}
