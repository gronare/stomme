import type { SoftwareConfig } from './config.ts';

export interface SiteSchemaInput {
  name?: string;
  url?: string;
  logo?: string;
  sameAs?: Array<string | undefined>;
  software?: SoftwareConfig | null;
}

type JsonLd = Record<string, unknown>;

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const CONTEXT = 'https://schema.org';

export function websiteJsonLd(input: SiteSchemaInput): JsonLd | null {
  const name = text(input.name);
  const url = text(input.url);
  if (!name || !url) return null;
  return { '@context': CONTEXT, '@type': 'WebSite', name, url };
}

export function organizationJsonLd(input: SiteSchemaInput): JsonLd | null {
  const name = text(input.name);
  const url = text(input.url);
  if (!name || !url) return null;
  const logo = text(input.logo);
  const sameAs = (input.sameAs ?? []).map(text).filter(Boolean);
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    name,
    url,
    ...(logo ? { logo } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function softwareJsonLd(input: SiteSchemaInput): JsonLd | null {
  const sw = input.software;
  if (!sw || typeof sw !== 'object') return null;
  const name = text(sw.name) || text(input.name);
  const url = text(input.url);
  if (!name || !url) return null;
  const category = text(sw.applicationCategory);
  const os = text(sw.operatingSystem);
  const repo = text(sw.repo);
  return {
    '@context': CONTEXT,
    '@type': 'SoftwareApplication',
    name,
    url,
    ...(category ? { applicationCategory: category } : {}),
    ...(os ? { operatingSystem: os } : {}),
    ...(sw.free === true ? { offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } : {}),
    ...(repo ? { sameAs: [repo] } : {}),
  };
}
