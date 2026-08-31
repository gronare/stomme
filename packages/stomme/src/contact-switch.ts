import { slugifyHeading } from './anchors';

export const SWITCH_VARIANTS = ['segmented', 'cards', 'tabs'] as const;
export type SwitchVariant = (typeof SWITCH_VARIANTS)[number];

export function switchVariant(raw: unknown): SwitchVariant {
  return SWITCH_VARIANTS.includes(raw as SwitchVariant) ? (raw as SwitchVariant) : 'segmented';
}

export interface SwitchItem {
  label?: string;
  description?: string;
  intro?: string;
  labelName?: string;
  labelEmail?: string;
  labelMessage?: string;
  submitLabel?: string;
  showPhone?: boolean;
  showCategory?: boolean;
  labelCategory?: string;
  categories?: string[];
  showUnit?: boolean;
  labelUnit?: string;
  placeholderUnit?: string;
  showDirectContact?: boolean;
  inbox?: string;
}

export interface SwitchPane {
  item: SwitchItem;
  anchor: string;
  tabId: string;
  panelId: string;
  hidden: boolean;
}

// Each pane carries an anchor of its own: ContactForm derives every field id from its anchor, so one shared anchor makes a label click focus the field in the pane next door.
export function switchPanes(items: unknown, anchor?: string, heading?: string): SwitchPane[] {
  const base = anchor || slugifyHeading(heading) || 'contact-switch';
  const listed = (Array.isArray(items) ? items : []).filter((it): it is SwitchItem => !!it && !!(it as SwitchItem).label);
  return listed.map((item, i) => ({
    item,
    anchor: `${base}-${i}`,
    tabId: `${base}-tab-${i}`,
    panelId: `${base}-panel-${i}`,
    hidden: listed.length > 1 && i > 0,
  }));
}
