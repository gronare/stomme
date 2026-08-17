import { stommeCollections } from '@gronare/stomme/collections';
import { stommeAddonCollections } from '@gronare/stomme/addon-collections';
import { listings } from './site.config.ts';

export const collections = { ...stommeCollections(listings), ...stommeAddonCollections() };
