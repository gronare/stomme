#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { contactFormSamples, formSampleChrome } = await jiti.import(resolve(PKG, 'src/form-samples.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(got === want, name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const SV = { email: 'E-post', phone: 'Telefon', category: 'Kategori', unit: 'Lägenhet', message: 'Beskriv ditt projekt' };

const fault = {
  type: 'contactForm', eyebrow: 'Felanmälan', heading: 'Anmäl ett fel',
  showPhone: true, showCategory: true, labelCategory: 'Vad gäller det?',
  categories: ['Min lägenhet', 'Tvättstugan'], showUnit: true, labelUnit: 'Lägenhet',
  placeholderUnit: '29-1001', labelMessage: 'Beskriv felet',
};
const board = { type: 'contactForm', eyebrow: 'Styrelsen', heading: 'Skriv till styrelsen', labelMessage: 'Ditt ärende' };

const two = contactFormSamples([{ title: 'Kontakt', blocks: [{ type: 'pageHeader' }, fault, board] }], SV, 'sv-SE');

eq(two.length, 2, 'one sample per contactForm block, other block types ignored');
eq(two[0].name, 'Anmäl ett fel', 'the picker name is the block heading');
eq(two[0].recap.messageLabel, 'Beskriv felet', "the form's own message label wins over the site default");
check(two[0].recap.messageLabel !== SV.message, 'an overriding form never shows the engine default message label');
eq(two[0].recap.categoryLabel, 'Vad gäller det?', 'the category label comes from the block');
eq(two[0].recap.category, 'Min lägenhet', "the sample category is the form's first configured category");
eq(two[0].recap.unitLabel, 'Lägenhet', 'the unit label comes from the block');
eq(two[0].recap.unit, '29-1001', "the sample unit is the form's own placeholder");
eq(two[0].recap.phoneLabel, 'Telefon', 'the phone label comes from the site strings');
eq(two[0].recap.emailLabel, 'E-post', 'the email label falls back to the site strings');
check(/^Hej!/.test(two[0].recap.message), 'a Swedish site gets a Swedish sample message', two[0].recap.message);

eq(two[1].recap.messageLabel, 'Ditt ärende', 'the second form carries its own message label');
eq(two[1].recap.phone, undefined, 'no phone row when the form hides the phone field');
eq(two[1].recap.category, undefined, 'no category row when the form hides the category field');
eq(two[1].recap.unit, undefined, 'no unit row when the form hides the unit field');

const noCats = contactFormSamples([{ blocks: [{ type: 'contactForm', showCategory: true, categories: [] }] }], SV, 'sv');
eq(noCats[0].recap.category, undefined, 'showCategory with no configured categories renders no category row, as the form does');

const defaults = contactFormSamples([{ blocks: [{ type: 'contactForm' }] }], undefined, 'en');
eq(defaults[0].recap.messageLabel, 'Describe your project', 'with no site strings the English engine defaults apply');
eq(defaults[0].name, 'Form 1', 'an unnamed form on an untitled source is numbered');
eq(contactFormSamples([{ title: 'Contact', blocks: [{ type: 'contactForm' }] }])[0].name, 'Contact', 'an unnamed form takes the page title');

const many = contactFormSamples([
  { title: 'Home', blocks: [{ type: 'contactForm', heading: 'On the home page' }] },
  { title: 'Contact', blocks: [{ type: 'contactForm', heading: 'On the contact page' }] },
], SV, 'sv');
eq(many.length, 2, 'forms are collected across every source in order');
eq(many[0].name, 'On the home page', 'the first source is listed first');

const switcher = contactFormSamples([{
  title: 'Kontakt',
  blocks: [{
    type: 'contactSwitch', heading: 'Skriv till oss',
    items: [
      { label: 'Felanmälan', showUnit: true, labelUnit: 'Lägenhet', placeholderUnit: '29-1001', labelMessage: 'Beskriv felet' },
      { label: 'Styrelsen', labelMessage: 'Ditt ärende' },
      { showUnit: true },
    ],
  }],
}], SV, 'sv');
eq(switcher.length, 2, 'a switcher contributes one sample per pane, and a pane with no switch label is dropped as the block drops it');
eq(switcher[0].name, 'Felanmälan', "a pane's picker name is its switch button text");
eq(switcher[0].recap.messageLabel, 'Beskriv felet', "a pane's own message label wins over the site default");
eq(switcher[0].recap.unit, '29-1001', "a pane's unit sample is its own placeholder");
eq(switcher[1].recap.unit, undefined, 'a pane that hides the unit field renders no unit row');

eq(contactFormSamples(undefined).length, 0, 'no sources yields no samples');
eq(contactFormSamples([{ blocks: null }]).length, 0, 'a source without blocks yields no samples');

eq(formSampleChrome('sv-SE').picker, 'Formulär', 'the picker caption follows the site language');
eq(formSampleChrome('nb').picker, 'Skjema', 'Norwegian variants resolve to the Norwegian chrome');
eq(formSampleChrome().picker, 'Form', 'an unknown language falls back to English chrome');
check(formSampleChrome('sv').note.length > 20, 'the chrome carries a note explaining that the answers are samples');

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n✗ ${failed}/${results.length} failed` : `\n✓ ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
