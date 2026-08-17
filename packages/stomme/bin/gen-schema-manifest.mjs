#!/usr/bin/env node
// schema-manifest.json: every content collection's allowed TOP-LEVEL frontmatter fields, read from the zod schemas in collections.ts and published for tooling that cannot introspect Astro/zod. `passthrough: true` marks a collection whose schema carries a passthrough `blocks` array, meaning unknown BLOCK-level keys are retained and only unexpected top-level keys are unexpected.
import { writeFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..'); // packages/stomme (the engine source, wherever this lives)
const collectionsPath = resolve(pkgRoot, 'collections.ts');
const outPath = resolve(pkgRoot, 'schema-manifest.json');
const stubPath = resolve(here, '_astro-content-stub.mjs');

// Peels zod's default/optional/nullable/effects wrappers to reach the type underneath.
function unwrap(type) {
  let cur = type;
  const seen = new Set();
  while (cur && cur._def && !seen.has(cur)) {
    seen.add(cur);
    const def = cur._def;
    if (def.innerType) { cur = def.innerType; continue; } // ZodDefault / ZodOptional / ZodNullable
    if (def.schema) { cur = def.schema; continue; } // ZodEffects (.transform)
    break;
  }
  return cur;
}

function objectShape(type) {
  const u = unwrap(type);
  if (!u) return null;
  const shape = u.shape ?? (typeof u._def?.shape === 'function' ? u._def.shape() : u._def?.shape);
  return shape && typeof shape === 'object' ? shape : null;
}

function fieldsOf(schema) {
  const shape = objectShape(schema);
  return shape ? Object.keys(shape) : [];
}

// One level only, and array/record fields are left out on purpose — their element shape is not a top-level concern.
function nestedOf(schema) {
  const shape = objectShape(schema);
  if (!shape) return undefined;
  const nested = {};
  for (const [key, type] of Object.entries(shape)) {
    const inner = objectShape(type);
    if (inner) nested[key] = Object.keys(inner);
  }
  return Object.keys(nested).length ? nested : undefined;
}

export async function generate({ write = true } = {}) {
  // collections.ts imports the virtual astro:content, which exists only inside an Astro build, so jiti gets a stub for it; astro/loaders resolves natively.
  const jiti = createJiti(import.meta.url, { alias: { 'astro:content': stubPath } });
  const mod = await jiti.import(collectionsPath);
  if (typeof mod.stommeCollections !== 'function') {
    throw new Error(`stommeCollections export not found in ${collectionsPath}`);
  }

  // No listings means the fixed base collections only — listing collections are per-site, and their shape is carried by the `presets` map instead.
  const cols = mod.stommeCollections();
  const collections = {};
  for (const name of Object.keys(cols).sort()) {
    const schema = cols[name]?.schema;
    const fields = fieldsOf(schema);
    const entry = { fields, passthrough: fields.includes('blocks') };
    const nested = nestedOf(schema);
    if (nested) entry.nested = nested;
    collections[name] = entry;
  }

  // Presets are exposed separately so listing content can be validated without knowing the site's collection id in advance.
  const presets = {};
  for (const [name, schema] of Object.entries(mod.PRESET_SCHEMAS ?? {})) {
    presets[name] = { fields: fieldsOf(schema) };
  }

  const manifest = { collections, presets };
  if (write) writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

// realpathSync is required: a plain resolve() leaves an npm .bin/* symlink unresolved, the direct-invocation guard never matches, and the generator silently no-ops.
const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const manifest = await generate();
  const names = Object.keys(manifest.collections);
  console.log(`✓ schema-manifest: ${names.length} collections (${names.join(', ')}) · presets: ${Object.keys(manifest.presets).join(', ')}`);
  console.log(`  → ${outPath}`);
}
