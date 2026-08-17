import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// STOMME_SLOTS_DIR may ship a `cms.mjs` exporting `collections`: { feature, yaml } entries, or a function called with the site's own { routes, features }, `blocks(indent)` — the very picker the engine's own page editors embed — and `fields`. Each `yaml` is one collection authored at indent 0, emitted only when features[feature] is truthy; no dir / no file ⇒ config.yml unchanged.
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
        // `panelFiles` is { <collection>: [ { feature, yaml } ] }: files spliced into the `files:` list of a collection the engine already emits, so an extension's own setting lands under Settings beside the header and the identity instead of as a lone collection at the bottom of the sidebar. Gated on the feature, and given the same context a collection gets — a panel file is a page like any other and the block picker is the site's own.
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
        // A broken manifest must not silently cost the site every generated pane.
        throw new Error(`stomme-gen: failed to load the CMS manifest from STOMME_SLOTS_DIR (${manifest}): ${e?.message || e}`);
      }
    }
  return { ADDON_PANES, ADDON_PANEL_FILES };
}
