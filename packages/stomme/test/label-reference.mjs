import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { buildOptionSources } from '../src/option-sources.mjs';
import { makeEmitters } from '../src/emit-fields.mjs';
import { makeCollectionEditors } from '../src/collection-editors.mjs';
import { makeSettingsPane } from '../src/settings-pane.mjs';
import { LOCALIZED_EDITORS } from '../src/cms-i18n.mjs';
import { scanLabels, listingAliases } from '../src/label-paths.mjs';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES = { services: '/services', towns: '/areas', blog: '/blog' };
const ALL_ON = { blog: true, areas: true, services: true, testimonials: true, faq: true, tracking: true, pages: true };
const ALL_OFF = { blog: false, areas: false, services: false, testimonials: false, faq: false, tracking: false, pages: true };
const LISTINGS = [
  { id: 'posts', route: '/blog', label: 'Blog', preset: 'article' },
  { id: 'catalog', route: '/catalog', label: 'Catalog', preset: 'catalog', specs: [{ key: 'spec', label: 'Spec' }] },
];

function emit(defaultBlocks, FEATURES, listings, LOCALES = []) {
  const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const pad = (n) => ' '.repeat(n);
  const root = mkdtempSync(join(tmpdir(), 'stomme-label-ref-'));
  try {
    const { OPTION_SOURCES, collectionEnabled, AVAILABLE_BLOCKS, GROUP_ORDER } =
      buildOptionSources({ root, ROUTES, FEATURES, LISTINGS: listings, BLOCKS: defaultBlocks });
    const { emitField, emitWidget, emitNavLinks, emitFooterLinks, buttonField, emitThanksButtons } =
      makeEmitters({ q, pad, AVAILABLE_BLOCKS, OPTION_SOURCES });
    const localized = (n) => LOCALES.length > 1 && LOCALIZED_EDITORS.includes(n);
    const { COLLECTION_EDITORS, listingEditor } = makeCollectionEditors({ q, emitField, emitWidget, buttonField, localized });
    const { emitCollections, emitSettings } = makeSettingsPane({
      q, pad, emitWidget, emitNavLinks, emitFooterLinks, emitThanksButtons,
      COLLECTION_EDITORS, listingEditor, collectionEnabled, FEATURES, LISTINGS: listings, CMS: null, LOCALES,
      ADDON_PANES: [], ADDON_PANEL_FILES: [], getStaticCollections: () => new Set(),
    });
    return { yaml: `collections:\n${emitCollections(2)}\n${emitSettings()}`, blocks: AVAILABLE_BLOCKS, groups: GROUP_ORDER };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export async function referenceLabels() {
  const jiti = createJiti(import.meta.url);
  const { defaultBlocks } = await jiti.import(resolve(PKG, 'catalog.ts'));
  const on = emit(defaultBlocks, ALL_ON, LISTINGS);
  const off = emit(defaultBlocks, ALL_OFF, []);
  // A third pass with languages on: the locale-gated fields (a page's own address, the switcher variant) exist in no other pass, and an untranslatable label is one a Swedish editor reads in English.
  const multi = emit(defaultBlocks, ALL_ON, LISTINGS, ['sv', 'en', 'no']);
  const byPath = new Map();
  for (const [yaml, listings] of [[on.yaml, LISTINGS], [off.yaml, []], [multi.yaml, LISTINGS]])
    for (const h of scanLabels(yaml, { aliases: listingAliases(listings) }))
      if (!byPath.has(h.path)) byPath.set(h.path, h.text);
  const onPaths = new Set(scanLabels(on.yaml, { aliases: listingAliases(LISTINGS) }).map((h) => h.path));
  if (![...byPath.keys()].some((k) => !onPaths.has(k)))
    throw new Error('label reference: the features-off pass contributed no path of its own — each gate hides strings the other shows, so both must run');
  return { byPath, blocks: on.blocks, groups: on.groups, yamls: [on.yaml, off.yaml, multi.yaml] };
}
