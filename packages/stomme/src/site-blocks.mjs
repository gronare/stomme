import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadSiteBlocks({ jiti, schemaPath, slotsDir = process.env.STOMME_SLOTS_DIR, log = console }) {
  const { BLOCKS: siteBlocks } = await jiti.import(schemaPath);
  if (!Array.isArray(siteBlocks)) throw new Error(`No BLOCKS export found in ${schemaPath}`);
  const file = slotsDir ? resolve(slotsDir, 'block-catalog.mjs') : null;
  if (!file || !existsSync(file)) return siteBlocks;
  try {
    const mod = await jiti.import(pathToFileURL(file).href);
    const added = (Array.isArray(mod.BLOCKS) ? mod.BLOCKS : []).filter((b) => b && b.type);
    const own = new Set(siteBlocks.map((b) => b.type));
    const fresh = added.filter((b) => !own.has(b.type));
    if (fresh.length) log.log(`  · addon blocks: ${fresh.map((b) => b.type).join(', ')}`);
    return [...siteBlocks, ...fresh];
  } catch (e) {
    log.warn(`  ⚠ addon blocks: ${resolve(file)} could not be read (${e.message}) — skipped`);
    return siteBlocks;
  }
}
