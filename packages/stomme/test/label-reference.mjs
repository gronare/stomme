import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { buildOptionSources } from '../src/option-sources.mjs';
import { makeEmitters } from '../src/emit-fields.mjs';
import { makeCollectionEditors } from '../src/collection-editors.mjs';
import { makeSettingsPane } from '../src/settings-pane.mjs';
import { scanLabels, listingAliases } from '../src/label-paths.mjs';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES = { services: '/services', towns: '/areas', blog: '/blog' };
const ALL_ON = { blog: true, areas: true, services: true, testimonials: true, faq: true, tracking: true, pages: true };
const ALL_OFF = { blog: false, areas: false, services: false, testimonials: false, faq: false, tracking: false, pages: true };
const LISTINGS = [
  { id: 'posts', route: '/blog', label: 'Blog', preset: 'article' },
  { id: 'catalog', route: '/catalog', label: 'Catalog', preset: 'catalog', specs: [{ key: 'spec', label: 'Spec' }] },
];

function emit(defaultBlocks, FEATURES, listings) {
  const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const pad = (n) => ' '.repeat(n);
  const root = mkdtempSync(join(tmpdir(), 'stomme-label-ref-'));
  try {
    const { OPTION_SOURCES, collectionEnabled, AVAILABLE_BLOCKS, GROUP_ORDER } =
      buildOptionSources({ root, ROUTES, FEATURES, LISTINGS: listings, BLOCKS: defaultBlocks });
    const { emitField, emitWidget, emitNavLinks, emitFooterLinks, buttonField, emitThanksButtons } =
      makeEmitters({ q, pad, AVAILABLE_BLOCKS, OPTION_SOURCES });
    const { COLLECTION_EDITORS, listingEditor } = makeCollectionEditors({ q, emitField, emitWidget, buttonField });
    const { emitCollections, emitSettings } = makeSettingsPane({
      q, pad, emitWidget, emitNavLinks, emitFooterLinks, emitThanksButtons,
      COLLECTION_EDITORS, listingEditor, collectionEnabled, FEATURES, LISTINGS: listings, CMS: null,
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
  const byPath = new Map();
  for (const [yaml, listings] of [[on.yaml, LISTINGS], [off.yaml, []]])
    for (const h of scanLabels(yaml, { aliases: listingAliases(listings) }))
      if (!byPath.has(h.path)) byPath.set(h.path, h.text);
  const onPaths = new Set(scanLabels(on.yaml, { aliases: listingAliases(LISTINGS) }).map((h) => h.path));
  if (![...byPath.keys()].some((k) => !onPaths.has(k)))
    throw new Error('label reference: the features-off pass contributed no path of its own — each gate hides strings the other shows, so both must run');
  return { byPath, blocks: on.blocks, groups: on.groups };
}
