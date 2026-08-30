export function slugifyHeading(text: unknown): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function blockAnchors(blocks: { heading?: unknown }[]): (string | undefined)[] {
  const taken = new Set<string>();
  return (Array.isArray(blocks) ? blocks : []).map((b) => {
    const base = typeof b?.heading === 'string' ? slugifyHeading(b.heading) : '';
    if (!base) return undefined;
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    return slug;
  });
}
