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
