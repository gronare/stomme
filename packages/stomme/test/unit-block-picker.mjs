#!/usr/bin/env node
import { resolve, dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { pickerData, searchBlocks, normalize } from '../admin/block-picker.mjs';
import { SHAPES } from '../admin/blocks-gallery.mjs';
import { buildOptionSources } from '../src/option-sources.mjs';
import sv from '../admin/labels.sv.js';
import { THEME_CSS } from '../src/admin-theme.mjs';

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const { defaultBlocks } = await createJiti(import.meta.url).import(resolve(pkg, 'catalog.ts'));
const root = mkdtempSync(join(tmpdir(), 'stomme-picker-'));
const ALL_ON = { blog: true, areas: true, services: true, testimonials: true, faq: true, documents: true, pages: true };
const LISTINGS = [{ id: 'posts', route: '/blog', label: 'Blog', preset: 'article' }, { id: 'catalog', route: '/catalog', label: 'Catalog', preset: 'catalog' }];
const { AVAILABLE_BLOCKS, GROUP_ORDER } = buildOptionSources({ root, ROUTES: { services: '/services', towns: '/areas', blog: '/blog' }, FEATURES: ALL_ON, LISTINGS, BLOCKS: defaultBlocks });
const off = buildOptionSources({ root, ROUTES: { services: '/services', towns: '/areas', blog: '/blog' }, FEATURES: { pages: true }, LISTINGS: [], BLOCKS: defaultBlocks });
rmSync(root, { recursive: true, force: true });

const svT = (key, en) => (sv[key] && sv[key][0] === en ? sv[key][1] : en);
const en = pickerData(AVAILABLE_BLOCKS, { groupOrder: GROUP_ORDER });
const sw = pickerData(AVAILABLE_BLOCKS, { t: svT, groupOrder: GROUP_ORDER });
const types = (list) => list.map((b) => b.type);
const inGroup = (data, g) => types(data.blocks.filter((b) => b.group === g)).sort();

check(JSON.stringify(inGroup(en, 'Contact')) === JSON.stringify(['contactCard', 'contactForm', 'contactSwitch', 'findUs', 'map']),
  'the contact blocks form their own Contact group', inGroup(en, 'Contact').join(', '));
check(JSON.stringify(inGroup(en, 'Calls to action')) === JSON.stringify(['ctaBox', 'ctaPanel']),
  'Calls to action holds only the two call-to-action blocks', inGroup(en, 'Calls to action').join(', '));
check(inGroup(en, 'Media').includes('logoStrip') && !inGroup(en, 'Numbers').includes('logoStrip'), 'the logo strip sits in Media');

const groupIds = en.groups.map((g) => g.id);
check(JSON.stringify(groupIds) === JSON.stringify(GROUP_ORDER.filter((g) => groupIds.includes(g))), 'groups follow the generator\'s group order', groupIds.join(' · '));
const positions = en.blocks.map((b) => groupIds.indexOf(b.group));
check(positions.every((p, i) => i === 0 || p >= positions[i - 1]), 'blocks come grouped, in group order');
check(en.blocks.length === AVAILABLE_BLOCKS.length, `every available block is offered (${en.blocks.length})`);
check(!types(pickerData(off.AVAILABLE_BLOCKS, { groupOrder: off.GROUP_ORDER }).blocks).includes('testimonials'),
  'a block whose collection is off is not offered');

const bare = defaultBlocks.filter((b) => !b.summary || !(b.keywords && b.keywords.length) || !SHAPES[b.shape] || !b.group);
check(bare.length === 0, 'every catalog block carries a group, a summary, keywords and a known shape', types(bare).join(', '));

const svBare = defaultBlocks.filter((b) => !sv[`block.${b.type}.description`] || !sv[`block.${b.type}.keywords`]);
check(svBare.length === 0, 'every catalog block has a Swedish description and Swedish keywords', types(svBare).join(', '));
const staleKeywords = defaultBlocks.filter((b) => sv[`block.${b.type}.keywords`] && sv[`block.${b.type}.keywords`][0] !== b.keywords.join(', '));
check(staleKeywords.length === 0, 'every Swedish keyword entry answers the catalog\'s English keywords', types(staleKeywords).join(', '));

const plans = sw.blocks.find((b) => b.type === 'plans');
check(plans.label === sv['block.plans.label'][1] && plans.summary === sv['block.plans.description'][1], 'a Swedish admin gets the Swedish label and description', `${plans.label} · ${plans.summary}`);
check(sw.groups.find((g) => g.id === 'Contact').label === 'Kontakt' && sw.ui.add === 'Lägg till {name}', 'group names and dialog copy follow the admin language');

const hit = (data, q) => types(searchBlocks(data.blocks, q));
check(hit(sw, 'pris').includes('plans'), 'Swedish keyword: "pris" finds the pricing block', hit(sw, 'pris').join(', '));
check(hit(en, 'price').includes('plans'), 'English keyword: "price" finds the pricing block');
check(hit(sw, 'karta').includes('findUs') && hit(sw, 'karta').includes('map'), '"karta" finds both map blocks', hit(sw, 'karta').join(', '));
check(hit(sw, 'OPPETTIDER').includes('findUs'), 'accent- and case-insensitive: "OPPETTIDER" finds öppettider', hit(sw, 'OPPETTIDER').join(', '));
check(hit(sw, 'PRÍS').includes('plans'), 'an accent typed in the query is ignored too');
check(hit(sw, 'formulär').includes('contactForm'), 'the name matches ("formulär" → Kontaktformulär)');
check(hit(en, 'captions').includes('gallery'), 'the description matches ("captions" → Gallery)');
check(hit(sw, 'pris').includes('catalogList') && JSON.stringify(hit(sw, 'pris paket')) === JSON.stringify(['plans']), 'every word of a multi-word query must match ("pris paket" narrows "pris")', hit(sw, 'pris paket').join(', '));
check(hit(sw, '').length === sw.blocks.length && hit(sw, '   ').length === sw.blocks.length, 'an empty query offers every block');
check(hit(sw, 'zzqx').length === 0, 'a query nothing matches offers nothing');
check(normalize('  Åre  Öl ') === 'are ol', 'normalize lowercases, strips accents and collapses spaces', normalize('  Åre  Öl '));

check(THEME_CSS.includes('.stomme-picker .wf .ln') && !/(^|\n)\.wf/.test(THEME_CSS), 'the admin theme carries the wireframe CSS, scoped to the picker');
check(JSON.stringify(sw.shapes) === JSON.stringify(SHAPES), 'the picker reuses the gallery\'s wireframe shapes');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} block-picker checks hold`);
if (failed) process.exit(1);
