import type { SiteConfig, StommeFeatures, Listing } from '@gronare/stomme/config';

export const features: StommeFeatures = {
  faq: true,
  blog: false,
  areas: false,
  services: false,
  testimonials: false,
  documents: false,
};

export const site: SiteConfig = {
  routes: {
    services: '/services',
    towns: '/areas',
    blog: '/blog',
    contact: '/contact',
    formSuccess: '/thanks',
  },
  locale: 'en-US',
  cmsLocale: 'en',
  strings: {
    readMore: 'Read more',
  },
};

export const listings: Listing[] = [];
