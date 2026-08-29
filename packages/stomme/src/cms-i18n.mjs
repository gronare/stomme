// The page-like content the CMS localizes. Everything else — settings, contact, theme, tracking, and every sync-owned addon pane — stays single-language: a locale file for them would fork data, not copy.
export const LOCALIZED_EDITORS = ['home', 'pages', 'nav'];

const TRANSLATABLE = new Set(['string', 'text', 'markdown', 'object', 'list', 'blocks']);

export function resolveCmsLocales(list) {
  const clean = [...new Set((Array.isArray(list) ? list : []).map((l) => String(l || '').trim().toLowerCase()).filter(Boolean))];
  return clean.length < 2 ? [] : clean;
}

// Sveltia writes a translated file from the field declarations alone: a key with no `i18n` is dropped from every non-default locale on save. So every field carries one — text and containers are translated, everything else is copied from the default locale.
export function i18nFlagFor(field) {
  if (!field || field.i18n === false) return null;
  if (typeof field.i18n === 'string') return field.i18n;
  return TRANSLATABLE.has(String(field.widget || '')) ? 'true' : 'duplicate';
}

export function localeFilePath(path) {
  return String(path).replace(/\.(\w+)$/, '.{{locale}}.$1');
}

export function i18nConfigBlock(locales, indent = 0) {
  const list = resolveCmsLocales(locales);
  if (!list.length) return '';
  const p = ' '.repeat(indent);
  return [
    `${p}i18n:`,
    `${p}  structure: multiple_files`,
    `${p}  locales: [${list.join(', ')}]`,
    `${p}  default_locale: ${list[0]}`,
    `${p}  omit_default_locale_from_file_path: true`,
  ].join('\n');
}
