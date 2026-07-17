#!/usr/bin/env node
// stomme-gen-schema — emit packages/stomme/schema-manifest.json: a machine-readable
// list of every content collection's allowed TOP-LEVEL frontmatter fields, derived
// from the zod schemas in collections.ts.
//
//   node bin/gen-schema-manifest.mjs        (or: pnpm --filter @gronare/stomme gen:schema-manifest)
//
// Why: the control plane can't introspect Astro/zod, so the engine (which owns the schema)
// ships this manifest. the control plane fetches it raw at gronare/stomme@<release-sha> and
// flags site content whose frontmatter carries keys the collection schema doesn't
// accept (the `contact.hq`-style drift). See the vault: stomme-fleet-drift-och-autoupdate.
//
// CONTRACT (the control plane depends on this exact shape):
//   { "collections": { "<name>": { "fields": [...], "passthrough": <bool>, "nested"?: {...} } },
//     "presets":     { "<name>": { "fields": [...] } } }
//
// `passthrough: true` means the collection's schema carries a passthrough `blocks`
// array (home/pages/services) — unknown BLOCK-level fields are retained, so the control plane
// validates only unexpected TOP-LEVEL collection keys, never block-level keys.
import { writeFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..'); // packages/stomme (the engine source, wherever this lives)
const collectionsPath = resolve(pkgRoot, 'collections.ts');
const outPath = resolve(pkgRoot, 'schema-manifest.json');
const stubPath = resolve(here, '_astro-content-stub.mjs');

// Peel zod's modifier wrappers (default / optional / nullable / effects) off a field
// type to reach the type it actually describes.
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

// The field→type shape of a ZodObject (after unwrapping), or null for non-objects.
function objectShape(type) {
  const u = unwrap(type);
  if (!u) return null;
  const shape = u.shape ?? (typeof u._def?.shape === 'function' ? u._def.shape() : u._def?.shape);
  return shape && typeof shape === 'object' ? shape : null;
}

// Top-level field names a z.object(...) schema accepts.
function fieldsOf(schema) {
  const shape = objectShape(schema);
  return shape ? Object.keys(shape) : [];
}

// One level of nested keys for object-typed fields (contact.address, settings.logo, …).
// Optional/additive — the control plane v1 validates top-level only. Array/record fields are
// left out (their element shape isn't a top-level concern).
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
  // collections.ts imports `astro:content` (a virtual module that only exists inside an
  // Astro build). Alias it to our stub so jiti can transpile+run the factory in plain
  // Node; `astro/loaders` resolves natively.
  const jiti = createJiti(import.meta.url, { alias: { 'astro:content': stubPath } });
  const mod = await jiti.import(collectionsPath);
  if (typeof mod.stommeCollections !== 'function') {
    throw new Error(`stommeCollections export not found in ${collectionsPath}`);
  }

  // No listings → the engine's fixed base collections only. Listing collections are
  // per-site (config-defined); their shape is captured by the `presets` map instead.
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

  // Preset schemas (article / catalog) back the per-site listing collections; expose
  // them so the control plane can validate listing content whose collection id it can't know.
  const presets = {};
  for (const [name, schema] of Object.entries(mod.PRESET_SCHEMAS ?? {})) {
    presets[name] = { fields: fieldsOf(schema) };
  }

  const manifest = { collections, presets };
  if (write) writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

// Run when invoked directly (bin / script). Importers (stomme-gen) call generate().
// realpathSync so an npm `.bin/*` symlink (npx stomme-gen-schema) still matches the
// module realpath in import.meta.url — a plain resolve() leaves the symlink unresolved
// and the guard silently no-ops.
const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const manifest = await generate();
  const names = Object.keys(manifest.collections);
  console.log(`✓ schema-manifest: ${names.length} collections (${names.join(', ')}) · presets: ${Object.keys(manifest.presets).join(', ')}`);
  console.log(`  → ${outPath}`);
}
