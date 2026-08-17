// Every collection is defined here whatever the feature flags say — the schemas must exist so nothing errors when a feature is off. Add your own by spreading them in.
import { stommeCollections } from '@gronare/stomme/collections';
import { stommeAddonCollections } from '@gronare/stomme/addon-collections';
import { listings } from './site.config.ts';

// stommeAddonCollections() merges whatever a build-time addon dir contributes, and is empty when there is none.
export const collections = { ...stommeCollections(listings), ...stommeAddonCollections() };
