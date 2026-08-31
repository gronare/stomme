export interface ContactStrings {
  email?: string; phone?: string; category?: string; unit?: string; message?: string;
}

export interface FormSource {
  title?: string;
  blocks?: any;
}

export interface FormRecap {
  emailLabel: string; email: string;
  phoneLabel?: string; phone?: string;
  categoryLabel?: string; category?: string;
  unitLabel?: string; unit?: string;
  messageLabel: string; message: string;
}

export interface FormSample {
  name: string;
  recap: FormRecap;
}

const SAMPLE_EMAIL = 'anna@example.com';
const SAMPLE_UNIT = '1001';

const SAMPLE_EN = {
  phone: '555 0123',
  message: 'Hello! Here is a short description of what I am asking about. Get in touch whenever it suits you.',
  picker: 'Form',
  note: "Sample answers, shown with this form's own field labels. A visitor sees the answers they typed.",
};

const SAMPLE_SV = {
  phone: '070-123 45 67',
  message: 'Hej! Här är en kort beskrivning av mitt ärende. Hör gärna av er när det passar.',
  picker: 'Formulär',
  note: 'Exempelsvar, visade med det här formulärets egna fältnamn. Besökaren ser det hon själv skrev.',
};

const SAMPLE_NO = {
  phone: '400 12 345',
  message: 'Hei! Her er en kort beskrivelse av saken min. Ta gjerne kontakt når det passer deg.',
  picker: 'Skjema',
  note: 'Eksempelsvar, vist med dette skjemaets egne feltnavn. Den besøkende ser det hun selv skrev.',
};

const SAMPLE_BY_LANG: Record<string, typeof SAMPLE_EN> = {
  en: SAMPLE_EN, sv: SAMPLE_SV, no: SAMPLE_NO, nb: SAMPLE_NO, nn: SAMPLE_NO,
};

function sampleText(locale?: string): typeof SAMPLE_EN {
  const lang = String(locale || 'en').split(/[-_]/)[0].toLowerCase();
  return SAMPLE_BY_LANG[lang] || SAMPLE_EN;
}

export function formSampleChrome(locale?: string): { picker: string; note: string } {
  const s = sampleText(locale);
  return { picker: s.picker, note: s.note };
}

// Label resolution mirrors blocks/ContactForm.astro's `L` exactly (block override, else the site string, else the English default); test/cross-file-contracts.mjs pins the two together.
function sampleRecap(b: any, c: ContactStrings, s: typeof SAMPLE_EN): FormRecap {
  const categories: string[] = (Array.isArray(b.categories) ? b.categories : []).filter(Boolean);
  const recap: FormRecap = {
    emailLabel: b.labelEmail || (c.email ?? 'Email'),
    email: SAMPLE_EMAIL,
    messageLabel: b.labelMessage || (c.message ?? 'Describe your project'),
    message: s.message,
  };
  if (b.showPhone === true) {
    recap.phoneLabel = c.phone ?? 'Phone';
    recap.phone = s.phone;
  }
  if (b.showCategory === true && categories.length > 0) {
    recap.categoryLabel = b.labelCategory || (c.category ?? 'Category');
    recap.category = String(categories[0]);
  }
  if (b.showUnit === true) {
    recap.unitLabel = b.labelUnit || (c.unit ?? 'Unit');
    recap.unit = String(b.placeholderUnit || SAMPLE_UNIT);
  }
  return recap;
}

export function contactFormSamples(sources?: FormSource[], contact?: ContactStrings, locale?: string): FormSample[] {
  const s = sampleText(locale);
  const c = contact ?? {};
  const out: FormSample[] = [];
  const add = (form: any, ...names: unknown[]) => {
    out.push({ name: String(names.find(Boolean) ?? `${s.picker} ${out.length + 1}`), recap: sampleRecap(form, c, s) });
  };
  for (const source of Array.isArray(sources) ? sources : []) {
    const blocks: any[] = Array.isArray(source?.blocks) ? source.blocks : [];
    for (const b of blocks) {
      if (!b) continue;
      if (b.type === 'contactForm') add(b, b.heading, b.eyebrow, source?.title);
      // A switcher's panes are forms the visitor really submits, so each pane is sampled the same way; a pane without a switch label is one the block itself drops.
      if (b.type === 'contactSwitch') {
        for (const item of Array.isArray(b.items) ? b.items : []) {
          if (item && item.label) add(item, item.label, b.heading, source?.title);
        }
      }
    }
  }
  return out;
}
