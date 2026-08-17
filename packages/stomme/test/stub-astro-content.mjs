// Stands in for Astro's `astro:content` so the pure content-enumeration modules can run under plain node.
export const store = { collections: {}, entries: {} };

export function reset(entries = {}, collections = {}) {
  store.entries = entries;
  store.collections = collections;
}

export async function getCollection(name) {
  return store.collections[name] ?? [];
}

export async function getEntry(collection, id) {
  return store.entries[`${collection}/${id}`];
}
