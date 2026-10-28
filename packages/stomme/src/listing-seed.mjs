// The editable index page seeded for a listing that has none yet; published, since the listing is configured to be on the site.
export function listingIndexSeed(l) {
  const label = JSON.stringify(l.label || l.id);
  const block =
    l.preset === 'catalog'
      ? `  - type: catalogList\n    source: ${l.id}\n    base: ${l.route}\n    media:\n      showImages: true\n    layout:\n      filters: true\n      columns: 3`
      : `  - type: postList\n    source: ${l.id}\n    base: ${l.route}\n    media:\n      showImages: true\n    layout:\n      featured: true\n      columns: 3`;
  return `---\ntitle: ${label}\npublished: true\nseo:\n  title: ${label}\n  description: ${label}\nblocks:\n  - type: pageHeader\n    heading: ${label}\n${block}\n---\n`;
}

export function listingIndexSlug(l) {
  return l.route.replace(/^\/+/, '') || l.id;
}
