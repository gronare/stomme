// The engine's collections (core + optional, all defined). Feature flags in
// site.config decide which optional ones are shown (admin / blocks / routes); the
// schemas always exist so nothing errors when a feature is off. Add your own
// collections by spreading them in: `{ ...stommeCollections(), myCollection }`.
import { stommeCollections } from '@gronare/stomme/collections';

export const collections = { ...stommeCollections() };
