#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { switchPanes, switchVariant } = await jiti.import(resolve(PKG, 'src/contact-switch.ts'));
const read = (p) => readFileSync(resolve(PKG, p), 'utf8');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

eq(switchVariant('segmented'), 'segmented', 'the segmented switch is taken as written');
eq(switchVariant('cards'), 'cards', 'the choice cards are taken as written');
eq(switchVariant('tabs'), 'tabs', 'the tabs are taken as written');
eq(switchVariant(undefined), 'segmented', 'no layout choice renders the segmented switch');
eq(switchVariant('accordion'), 'segmented', 'a layout the block does not have renders the segmented switch');

const two = [{ label: 'Report a fault' }, { label: 'Write to the board' }];
eq(switchPanes(two, '', 'Write to us').map((p) => p.anchor), ['write-to-us-0', 'write-to-us-1'], 'each pane derives its own anchor from the heading');
eq(switchPanes(two, 'kontakt').map((p) => [p.tabId, p.panelId]), [['kontakt-tab-0', 'kontakt-panel-0'], ['kontakt-tab-1', 'kontakt-panel-1']], 'the tab and its panel are two different ids');
eq(switchPanes(two).map((p) => p.anchor), ['contact-switch-0', 'contact-switch-1'], 'with no anchor and no heading the panes still differ from each other');
const ids = switchPanes(two, 'kontakt').flatMap((p) => [p.anchor, p.tabId, p.panelId]);
check(new Set(ids).size === ids.length, 'no two ids on the switch collide', ids.join(' '));
eq(switchPanes(two).map((p) => p.hidden), [false, true], 'the first form is the one the page opens on');
eq(switchPanes([{ label: 'Only one' }]).map((p) => p.hidden), [false], 'a lone form is never hidden — there is no switch to bring it back');
eq(switchPanes([{ intro: 'No label' }, { label: 'Real' }]).map((p) => p.item.label), ['Real'], 'an item with no switch label is not offered');
eq(switchPanes([]), [], 'no items, no panes');
eq(switchPanes(undefined), [], 'a missing item list is not an error');
eq(switchPanes('two forms'), [], 'a list that is not a list renders nothing');

const form = read('blocks/ContactForm.astro');
const block = read('blocks/ContactSwitch.astro');

check(/<section data-stomme-block="contactForm"[^>]*class=\{embedded \? 'contact-embed' : 'section'\}/.test(form),
  'the embedded contact form stays a <section>, so its submit script still finds its own root with closest(\'section\')');
check(/document\.currentScript\.closest\('section'\)/.test(form), 'the contact form still reads its root that way');
check(/embedded \? intro &&/.test(form), 'an embedded form drops the section heading but keeps its intro');
check(/<ContactForm[\s\S]{0,200}?\n\s+embedded\n/.test(block), 'the switcher asks the contact form to render embedded, rather than repeating its markup');
check(/anchor=\{p\.anchor\}/.test(block), 'the switcher hands each pane its own anchor, so no two panes share a field id');

check(/role="tablist"/.test(block) && /role="tab"/.test(block) && /role={switched \? 'tabpanel' : undefined}/.test(block),
  'the switch carries the tablist / tab / tabpanel roles');
check(/aria-controls=\{p\.panelId\}/.test(block) && /aria-labelledby=\{switched \? p\.tabId : undefined\}/.test(block),
  'each tab names its panel and each panel names its tab');
check(/<noscript>/.test(block) && /\.contact-switch__pane\[hidden\] \{ display: block; \}/.test(block) && /\.contact-switch__controls \{ display: none; \}/.test(block),
  'without JavaScript every form is reachable and the dead switch is hidden');
check(/hidden=\{p\.hidden\}/.test(block), 'the panes ship hidden from the markup, so no form flashes before the script runs');

const styles = read('styles.css');
check(/@media \(prefers-reduced-motion: reduce\) \{ \.contact-switch__pane \{ animation: none; \} \}/.test(styles),
  'the swap animation is off when the visitor asked for less motion');
const switchRules = styles.split('\n').filter((l) => /\.contact-switch|\.contact-embed/.test(l));
check(switchRules.length > 0 && !switchRules.some((l) => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(l)),
  'every colour on the switch is a token, so a theme can recolour it', switchRules.filter((l) => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(l)).join('\n'));

const manifest = JSON.parse(read('blocks-manifest.json'));
const renderer = read('src/BlockRenderer.astro');
check(!!manifest.blocks.contactSwitch, 'the block is in the generated manifest');
check(/contactSwitch: ContactSwitch,/.test(renderer), 'the renderer knows the block type');
check(/CONTACT_FORM_BLOCKS = new Set\(\['contactForm', 'contactSwitch'\]\)/.test(renderer),
  'a site with the contact-form feature off gets neither contact block');
const itemFields = manifest.blocks.contactSwitch.fields.find((f) => f.name === 'items')?.fields ?? [];
const formFields = manifest.blocks.contactForm.fields.map((f) => f.name);
const missing = formFields.filter((n) => !['eyebrow', 'heading', 'layout'].includes(n) && !itemFields.some((f) => f.name === n));
check(missing.length === 0, 'every per-form field the contact form takes is editable on a switch item', `missing: ${missing.join(', ')}`);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} contact-switch checks pass`);
if (failed) process.exit(1);
