#!/usr/bin/env node
import { writeFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const catalogPath = resolve(pkgRoot, 'catalog.ts');
const outPath = resolve(pkgRoot, 'blocks-manifest.json');

// walk() MUST mirror emitField()'s recursion in gen-admin-blocks.mjs — object/list-with-fields recurse over `fields`, single-field lists descend into `field` — and drops UI-only keys (label, hint, summary, collapsed, label_singular, default).
export function walk(f) {
  const node = { name: f.name, widget: f.widget };
  // Drift-required = required AND no default: a default can never be 'missing' at render, so it must not warn when absent even where kit marks the field required purely so the editor does not read 'optional'.
  if (f.required === false || f.default !== undefined) node.required = false;
  if (f.multiple) node.multiple = true;
  if (Array.isArray(f.options)) {
    node.options = f.options.map((o) => (o && typeof o === 'object' ? o.value : o));
  } else if (typeof f.options === 'string') {
    node.options = f.options;
  }
  if (f.widget === 'object' && Array.isArray(f.fields)) node.fields = f.fields.map(walk);
  else if (f.widget === 'list' && Array.isArray(f.fields)) node.fields = f.fields.map(walk);
  else if (f.widget === 'list' && f.field) node.field = walk(f.field);
  return node;
}

// blocksToManifest() is the single source of the field-node contract, reused by the per-site custom-delta emitter in gen-admin-blocks.mjs so a site manifest and the engine manifest project a block identically — identical projection means it is not a custom override.
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
  const jiti = createJiti(import.meta.url);
  const mod = await jiti.import(catalogPath);
  const catalog = mod.defaultBlocks;
  if (!Array.isArray(catalog)) {
    throw new Error(`defaultBlocks export not found (or not an array) in ${catalogPath}`);
  }

  const manifest = blocksToManifest(catalog);
  if (write) writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

// realpathSync is required: a plain resolve() leaves an npm .bin/* symlink unresolved, the direct-invocation guard never matches, and the generator silently no-ops.
const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const manifest = await generate();
  const types = Object.keys(manifest.blocks);
  console.log(`✓ blocks-manifest: ${types.length} block types (${types.join(', ')})`);
  console.log(`  → ${outPath}`);
}
