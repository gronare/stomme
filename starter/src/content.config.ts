// The engine's collections (core + optional, all defined). Feature flags in
// site.config decide which optional ones are shown (admin / blocks / routes); the
// schemas always exist so nothing errors when a feature is off. Add your own
// collections by spreading them in: `{ ...stommeCollections(), myCollection }`.
import { stommeCollections } from '@gronare/stomme/collections';
import { stommeAddonCollections } from '@gronare/stomme/addon-collections';
import { listings } from './site.config.ts';

// `listings` adds a collection per config-defined listing (news/for-sale/…);
// `stommeAddonCollections()` merges any collections a build-time addon dir contributes
// (empty when none — see STOMME_SLOTS_DIR).
export const collections = { ...stommeCollections(listings), ...stommeAddonCollections() };
