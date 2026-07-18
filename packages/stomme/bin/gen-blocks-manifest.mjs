#!/usr/bin/env node
// stomme-gen-blocks — emit packages/stomme/blocks-manifest.json: a machine-readable,
// per-block-type field tree derived from the block catalog (catalog.ts `defaultBlocks`),
// the same source that generates the Sveltia editor config.
//
//   node bin/gen-blocks-manifest.mjs        (or: pnpm --filter @gronare/stomme gen:blocks-manifest)
//
// Why: the schema-manifest (gen-schema-manifest.mjs) lists each collection's TOP-LEVEL
// frontmatter fields, but marks `blocks`-carrying collections (home/pages/services) as
// passthrough — so the control plane is blind BELOW the block level. This manifest ships
// the block field trees so the control plane can flag block-level drift (a block with a
// renamed/removed field, an unknown `type`, or a missing required field). Fetched raw at
// gronare/stomme@<release-sha>, alongside schema-manifest.json. See the vault:
// stomme-blocks-manifest.
//
// It is a REPORTING artifact (a lenient, faithful projection of the catalog), not a
// build-time gate — the fleet model tolerates/reports drift rather than hard-failing.
//
// CONTRACT (the control plane depends on this exact shape):
//   { "blocks": { "<type>": { "label", "group", "shape", "collection"?, "fields": [<node>] } } }
// where a field <node> = { "name", "widget", "required"?, "multiple"?, "options"?,
//   "fields"? | "field"? }. `fields` = nested object group OR typed (list-of-objects)
// list; `field` = single-field list — which stores an array of SCALARS in frontmatter
// (the inner field's `name` never appears). Absence of `required` means the field IS
// required; a field with an editor default is emitted `required:false` (its default fills
// it at render, so it can never be missing). `options` is the literal value list for a select, or a dynamic sentinel
// string kept verbatim ("$pages", "$services", "$faq", …).
import { writeFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..'); // packages/stomme (the engine source, wherever this lives)
const catalogPath = resolve(pkgRoot, 'catalog.ts');
const outPath = resolve(pkgRoot, 'blocks-manifest.json');

// One catalog Field → a drift-relevant node. Mirrors the recursion in gen-admin-blocks.mjs
// (emitField): object-with-fields and typed list (list-with-fields) recurse over `fields`;
// a single-field list (list-with-field) descends into `field`. Everything else is a leaf.
// Keeps only what the control plane needs to diff frontmatter; UI-only keys (label, hint,
// summary, collapsed, label_singular, default) are dropped.
export function walk(f) {
  const node = { name: f.name, widget: f.widget };
  // Drift-required = required AND no default. A field with a `default` can never be
  // "missing" at render (the default fills it), so it must not warn when absent — even
  // when it's editor-required (kit marks some fields required purely so the Sveltia UI
  // doesn't read "optional", e.g. contactForm's field labels). Only a required field with
  // NO default is genuinely missable content.
  if (f.required === false || f.default !== undefined) node.required = false;
  if (f.multiple) node.multiple = true;
  if (Array.isArray(f.options)) {
    node.options = f.options.map((o) => (o && typeof o === 'object' ? o.value : o));
  } else if (typeof f.options === 'string') {
    node.options = f.options; // dynamic sentinel ($pages/$services/…) — resolved per-site, kept literal
  }
  if (f.widget === 'object' && Array.isArray(f.fields)) node.fields = f.fields.map(walk);
  else if (f.widget === 'list' && Array.isArray(f.fields)) node.fields = f.fields.map(walk);
  else if (f.widget === 'list' && f.field) node.field = walk(f.field);
  return node;
}

// Project a list of BlockDefs into the manifest's `{ blocks: { <type>: entry } }` shape.
// The single source of the field-node contract — reused by the per-site custom-delta
// emitter in gen-admin-blocks.mjs so a site manifest and the engine manifest project a
// block identically (identical projection == not a custom override).
export function blocksToManifest(blockDefs) {
  const blocks = {};
  for (const b of [...blockDefs].sort((a, z) => a.type.localeCompare(z.type))) {
    const entry = { label: b.label };
    if (b.group) entry.group = b.group;
    if (b.shape) entry.shape = b.shape;
    if (b.collection) entry.collection = b.collection;
    entry.fields = Array.isArray(b.fields) ? b.fields.map(walk) : [];
    blocks[b.type] = entry;
  }
  return { blocks };
}

export async function generate({ write = true } = {}) {
  // catalog.ts → ./src/kit.ts import nothing virtual (unlike collections.ts, which imports
  // astro:content), so a plain jiti import works — no astro:content stub needed.
  const jiti = createJiti(import.meta.url);
  const mod = await jiti.import(catalogPath);
  const catalog = mod.defaultBlocks;
  if (!Array.isArray(catalog)) {
    throw new Error(`defaultBlocks export not found (or not an array) in ${catalogPath}`);
  }

  // The WHOLE engine catalog, every block type — a manifest describes what the engine
  // offers, not what any one site enables (contrast AVAILABLE_BLOCKS in gen-admin-blocks).
  const manifest = blocksToManifest(catalog);
  if (write) writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

// Run when invoked directly (bin / script). Importers (stomme-gen) call generate().
// realpathSync so an npm `.bin/*` symlink (npx stomme-gen-blocks) still matches the
// module realpath in import.meta.url — a plain resolve() leaves the symlink unresolved
// and the guard silently no-ops.
const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const manifest = await generate();
  const types = Object.keys(manifest.blocks);
  console.log(`✓ blocks-manifest: ${types.length} block types (${types.join(', ')})`);
  console.log(`  → ${outPath}`);
}
