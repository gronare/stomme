import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function loadAddonCms({ slotsDir, ROUTES, FEATURES, emitWidget, emitField, buttonField, navLinkField }) {
  let ADDON_PANES = [];
  const ADDON_PANEL_FILES = {};
    const manifest = slotsDir ? resolve(slotsDir, 'cms.mjs') : null;
    if (manifest && existsSync(manifest)) {
      try {
        const mod = await import(pathToFileURL(manifest).href);
        const declared = mod.collections ?? mod.default;
        const entries = typeof declared === 'function'
          ? declared({
              routes: ROUTES, features: FEATURES, blocks: emitWidget,
              fields: {
                button: (name, label, indent = 8, hint) => emitField(buttonField(name, label, hint), indent),
                link: (name, label, indent = 8, hint) =>
                  emitField({ ...navLinkField(hint), name, label }, indent),
              },
            })
          : declared;
        const addonCtx = {
          routes: ROUTES, features: FEATURES, blocks: emitWidget,
          fields: {
            button: (name, label, indent = 8, hint) => emitField(buttonField(name, label, hint), indent),
            link: (name, label, indent = 8, hint) =>
              emitField({ ...navLinkField(hint), name, label }, indent),
          },
        };
        const panels = typeof mod.panelFiles === 'function' ? mod.panelFiles(addonCtx) : mod.panelFiles;
        for (const [collection, list] of Object.entries(panels || {})) {
          ADDON_PANEL_FILES[collection] = (Array.isArray(list) ? list : []).filter((e) => {
            if (!e || typeof e.feature !== 'string' || !e.feature || typeof e.yaml !== 'string' || !e.yaml.trim()) {
              console.warn('  ⚠ addon cms: skipped a malformed panel file (needs a non-empty `feature` and `yaml`)');
              return false;
            }
            return !FEATURES || !!FEATURES[e.feature];
          });
        }

        ADDON_PANES = (Array.isArray(entries) ? entries : []).filter((e) => {
          if (!e || typeof e.feature !== 'string' || !e.feature || typeof e.yaml !== 'string' || !e.yaml.trim()) {
            console.warn('  ⚠ addon cms: skipped a malformed entry (needs a non-empty `feature` and `yaml`)');
            return false;
          }
          return !FEATURES || !!FEATURES[e.feature];
        });
      } catch (e) {
        throw new Error(`stomme-gen: failed to load the CMS manifest from STOMME_SLOTS_DIR (${manifest}): ${e?.message || e}`);
      }
    }
  return { ADDON_PANES, ADDON_PANEL_FILES };
}
