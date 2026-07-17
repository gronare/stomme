// Resolve a link field to an href string. Accepts:
//   • an object { page, url }  — the linkField() shape (url wins over page)
//   • a plain string           — legacy/back-compat (returned as-is)
//   • nothing                  — the fallback
export function resolveLink(value: unknown, fallback = '/'): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const v = value as { url?: string; page?: string };
    return v.url || v.page || fallback;
  }
  return fallback;
}

// Resolve a buttonField() group `{ label, link }` to { label, href } — null = no button.
// Legacy args accept the pre-group pair (ctaLabel + ctaHref etc.) so an engine update
// keeps rendering existing sites' content unchanged (kit FIELD POLICY).
export function resolveButton(button: unknown, legacyLabel?: unknown, legacyHref?: unknown, fallback = '/'): { label: string; href: string } | null {
  const b = (button && typeof button === 'object' ? button : {}) as { label?: unknown; link?: unknown };
  const label = typeof b.label === 'string' && b.label ? b.label : typeof legacyLabel === 'string' && legacyLabel ? legacyLabel : '';
  if (!label) return null;
  return { label, href: resolveLink(b.link ?? legacyHref, fallback) };
}
