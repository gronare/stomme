// ─────────────────────────────────────────────────────────────────────────
// Icon library — the single source for the engine's icon set.
//
// name → inner SVG markup for a 24×24 stroke glyph (fill none, stroke
// currentColor, stroke-width 2, round caps/joins — the wrapper in Icon.astro
// supplies those attributes). Hand-drawn to a shared grammar: few nodes,
// ~2px breathing room, geometry that reads at 16–24px.
//
// Consumed by:
//   • Icon.astro — renders a glyph inline (zero JS, no external requests)
//   • kit.ts     — derives the CMS icon-picker options (ICON_NAMES), which
//                  also feed blocks-manifest.json for drift validation
// Adding a glyph here is the ONLY step — picker and renderer can't drift.
// Record order = picker order, grouped roughly by theme.
// ─────────────────────────────────────────────────────────────────────────
export const ICONS: Record<string, string> = {
  // generic
  check: '<path d="M5 13l4 4L19 7"/>',
  star: '<path d="M12 3l2.4 6.2 6.5.3-5.1 4.1 1.7 6.4-5.5-3.6-5.5 3.6 1.7-6.4-5.1-4.1 6.5-.3z"/>',
  heart: '<path d="M12 20c-5-3.5-8-6.6-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 3.4-3 6.5-8 10z"/>',
  spark: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
  sparkles: '<path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z"/><path d="M18 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/>',
  arrow: '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pin: '<path d="M12 21c-4.5-4.2-7-7.6-7-11a7 7 0 0 1 14 0c0 3.4-2.5 6.8-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4"/><path d="M17 14.2a6 6 0 0 1 4 5.8"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  bulb: '<path d="M9 15.5a6 6 0 1 1 6 0c-.7.7-1 1.5-1 2.5h-4c0-1-.3-1.8-1-2.5z"/><path d="M10 21h4"/>',
  chart: '<path d="M4 4v16h16"/><path d="M8 16v-4M12 16V7M16 16v-6"/>',
  gauge: '<path d="M5.6 18.4a9 9 0 1 1 12.8 0"/><path d="M12 12l4.5-4.5"/><circle cx="12" cy="12" r="1"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-3 5 3-1.5-7.5"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
  tag: '<path d="M4 4h7l9.5 9.5-7 7L4 11z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
  percent: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M19 5L5 19"/>',
  coins: '<circle cx="8.5" cy="8.5" r="5.5"/><path d="M13.9 9.6A5.5 5.5 0 1 1 9.6 13.9"/>',
  document: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
  gear: '<circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2L18 18M18 6l-1.8 1.8M7.8 16.2L6 18"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  link: '<path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1"/><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z"/>',
  wifi: '<path d="M3 9a13 13 0 0 1 18 0"/><path d="M6.5 12.5a8 8 0 0 1 11 0"/><path d="M9.5 16a3.5 3.5 0 0 1 5 0"/><path d="M12 19.5h.01"/>',
  // contact
  phone: '<path d="M6 3h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  headset: '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="6" rx="1"/><rect x="17" y="13" width="4" height="6" rx="1"/><path d="M20 19a4 4 0 0 1-4 3h-2"/>',
  // home & property
  home: '<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  roof: '<path d="M3 12l9-7 9 7"/><path d="M5 11v8h14v-8"/><path d="M9 19v-4h6v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.8 12.2L20 3"/><path d="M16 7l3 3"/>',
  truck: '<path d="M2 6h12v10H2z"/><path d="M14 9h4l3 3v4h-3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  tree: '<path d="M12 3l5 7h-3l4 6H6l4-6H7z"/><path d="M12 16v5"/>',
  // trades & building
  wrench: '<path d="M14 7a4 4 0 0 0-5 5l-6 6 3 3 6-6a4 4 0 0 0 5-5l-3 3-3-3z"/>',
  hammer: '<path d="M12 6l3-3 6 6-3 3z"/><path d="M13 9l2 2-8.6 8.6a1.4 1.4 0 0 1-2-2z"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l1.5 1.5M10 10l1.5 1.5M13 7l1.5 1.5"/>',
  paint: '<rect x="3" y="3" width="14" height="6" rx="1"/><path d="M17 7h3.5v4H12v10"/>',
  plug: '<path d="M9 2v5M15 2v5"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
  bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  // energy & climate
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  panel: '<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M3 9h18M9 4v13M15 4v13M9 21h6"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4"/><path d="M7 12h5"/>',
  leaf: '<path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14"/><path d="M5 19c2-4 5-7 9-9"/>',
  flame: '<path d="M12 3c-2.5 3-5.5 5.5-5.5 9.5a5.5 5.5 0 0 0 11 0c0-1.8-.7-3.3-1.8-4.8-.7 1-1.5 1.7-2.7 2.1.6-2.3.3-4.6-1-6.8z"/>',
  snowflake: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
  thermometer: '<path d="M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 10v7"/>',
  droplet: '<path d="M12 3c3.5 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-6 6-10z"/>',
  wind: '<path d="M3 9h10a3 3 0 1 0-3-3"/><path d="M3 15h14a3 3 0 1 1-3 3"/>',
  // cleaning, drone & tech work
  spray: '<path d="M8 10h6l1 10H7z"/><path d="M10 10V6h4"/><path d="M17 3.5h.01M20 6h.01M17 8.5h.01"/>',
  drone: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 8l8 8M16 8l-8 8"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13" r="3.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
};

// Selectable names, in picker order. Derived — cannot drift from the glyphs.
export const ICON_NAMES = Object.keys(ICONS);

// Unknown/legacy names degrade to this glyph (a neutral burst).
export const FALLBACK_ICON = 'spark';
