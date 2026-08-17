export function resolveLink(value: unknown, fallback = '/'): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const v = value as { url?: string; page?: string };
    return v.url || v.page || fallback;
  }
  return fallback;
}

// The legacy args are the pre-group pair (ctaLabel + ctaHref etc.), still accepted so an engine update keeps rendering existing sites' content unchanged (kit FIELD POLICY).
export function resolveButton(button: unknown, legacyLabel?: unknown, legacyHref?: unknown, fallback = '/'): { label: string; href: string } | null {
  const b = (button && typeof button === 'object' ? button : {}) as { label?: unknown; link?: unknown };
  const label = typeof b.label === 'string' && b.label ? b.label : typeof legacyLabel === 'string' && legacyLabel ? legacyLabel : '';
  if (!label) return null;
  return { label, href: resolveLink(b.link ?? legacyHref, fallback) };
}
