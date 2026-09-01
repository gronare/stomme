export interface ContactData {
  phone?: string;
  phoneE164?: string;
  email?: string;
  address?: {
    street?: string;
    postcode?: string;
    city?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  socials?: Array<{ platform?: string; url?: string }>;
  orgNr?: string;
  founded?: string;
}

export interface LocalBusinessInput {
  name?: string;
  url?: string;
  image?: string;
  contact?: ContactData;
  towns?: Array<string | undefined>;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const coord = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export function localBusinessJsonLd(input: LocalBusinessInput): Record<string, unknown> | null {
  const contact = input.contact ?? {};
  const a = contact.address ?? {};
  const name = text(input.name);
  const telephone = text(contact.phoneE164) || text(contact.phone);
  const email = text(contact.email);
  const taxID = text(contact.orgNr);
  const foundingDate = text(contact.founded);
  const address = {
    ...(text(a.street) ? { streetAddress: text(a.street) } : {}),
    ...(text(a.postcode) ? { postalCode: text(a.postcode) } : {}),
    ...(text(a.city) ? { addressLocality: text(a.city) } : {}),
    ...(text(a.country) ? { addressCountry: text(a.country) } : {}),
  };
  const lat = coord(a.lat);
  const lng = coord(a.lng);
  const sameAs = (contact.socials ?? []).map((s) => text(s && s.url)).filter(Boolean);
  const areaServed = (input.towns ?? []).map(text).filter(Boolean);

  const hasContact = !!(telephone || email || taxID || foundingDate || sameAs.length
    || Object.keys(address).length || (lat !== undefined && lng !== undefined));
  if (!name && !hasContact) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    ...(name ? { name } : {}),
    ...(text(input.url) ? { url: text(input.url) } : {}),
    ...(telephone ? { telephone } : {}),
    ...(email ? { email } : {}),
    ...(taxID ? { taxID } : {}),
    ...(foundingDate ? { foundingDate } : {}),
    ...(Object.keys(address).length ? { address: { '@type': 'PostalAddress', ...address } } : {}),
    ...(lat !== undefined && lng !== undefined ? { geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(text(input.image) ? { image: text(input.image) } : {}),
    ...(areaServed.length ? { areaServed: areaServed.map((n) => ({ '@type': 'City', name: n })) } : {}),
  };
}
