#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { timelineYear, timelinePositions } = await jiti.import(resolve(PKG, 'src/timeline.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(JSON.stringify(got) === JSON.stringify(want), name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

eq(timelineYear('2011'), 2011, 'a four-digit year is read as it stands');
eq(timelineYear('Våren 1957'), 1957, 'a year inside a phrase is found');
eq(timelineYear('00-tal'), 2000, 'a two-digit decade at or below 30 reads as the 2000s');
eq(timelineYear('90-tal'), 1990, 'a two-digit decade above 30 reads as the 1900s');
eq(timelineYear('Planerat'), null, 'wording with no digits has no year');
eq(timelineYear(undefined), null, 'a missing year has no year');
eq(timelineYear('7'), null, 'a single digit is not a year');

const ascending = timelinePositions(['2000', '2011', '2012', '2017', '2019', '2022', '2025'], true);
check(ascending.every((x, i) => i === 0 || x > ascending[i - 1]), 'positions rise with the years', JSON.stringify(ascending));
check(ascending[0] >= 4 && ascending[ascending.length - 1] <= 74, 'every dot lands inside the range the trailing note leaves free', JSON.stringify(ascending));
check(ascending.every((x, i) => i === 0 || x - ascending[i - 1] >= 7.99), 'two years one apart are still pulled apart to a readable gap', JSON.stringify(ascending));
check(ascending[1] > 20, 'a long first gap stays long — the spacing follows the years, not the index', JSON.stringify(ascending));
check(timelinePositions(['2000', '2025'], false).pop() === 84, 'without a trailing note the last dot reaches further right');

eq(timelinePositions(['00-tal', '2011', '2025'], false), [4, 39.2, 84], 'a decade word takes part in the spread like any other year');
const unordered = timelinePositions(['2011', '00-tal', '2025'], false);
check(unordered.every((x, i) => i === 0 || x > unordered[i - 1]), 'a year out of order still draws left to right, in the order the items are written', JSON.stringify(unordered));
eq(timelinePositions(['2011', 'Snart', '2025'], false), [4, 44, 84], 'one unreadable year drops the whole line to even spacing');
eq(timelinePositions(['2019', '2019'], false), [4, 84], 'two identical years fall back to even spacing rather than stacking');
eq(timelinePositions(['2019'], false), [4], 'a single milestone sits at the start of the line');
eq(timelinePositions([], false), [], 'no milestones, no positions');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} timeline checks pass`);
if (failed) process.exit(1);
