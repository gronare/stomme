import { SHAPES } from './blocks-gallery.mjs';

export function normalize(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

export function searchBlocks(blocks, query) {
  var words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return blocks;
  return blocks.filter(function (b) { return words.every(function (w) { return b.terms.indexOf(w) !== -1; }); });
}

const splitList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

export function pickerData(blocks, { t = (key, fallback) => fallback, groupOrder = [], fields = ['blocks'] } = {}) {
  const items = blocks.map((b) => {
    const label = t(`block.${b.type}.label`, b.label);
    const summary = t(`block.${b.type}.description`, b.summary || '');
    const ownKeywords = b.keywords || [];
    const keywords = splitList(t(`block.${b.type}.keywords`, ownKeywords.join(', ')));
    return {
      type: b.type,
      label,
      group: b.group || 'Other',
      summary,
      shape: SHAPES[b.shape] ? b.shape : 'prose',
      terms: normalize([label, b.label, summary, ...keywords, ...ownKeywords].join(' ')),
    };
  });
  const present = [...new Set(items.map((b) => b.group))];
  const order = [...groupOrder.filter((g) => present.includes(g)), ...present.filter((g) => !groupOrder.includes(g))];
  items.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  return {
    fields,
    ui: {
      title: t('picker.ui.title', 'Add section'),
      search: t('picker.ui.search', 'Search sections'),
      placeholder: t('picker.ui.placeholder', 'Search: image, price, map, quote…'),
      close: t('picker.ui.close', 'Close'),
      groups: t('picker.ui.groups', 'Groups'),
      add: t('picker.ui.add', 'Add {name}'),
      empty: t('picker.ui.empty', 'No section matches “{query}”.'),
    },
    groups: order.map((id) => ({ id, label: t(`gallery.group.${id}`, id) })),
    blocks: items,
    shapes: SHAPES,
  };
}
