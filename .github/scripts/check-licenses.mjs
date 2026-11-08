import { execFileSync } from 'node:child_process';

const allowed = new Set([
  '0BSD', 'Apache-2.0', 'BlueOak-1.0.0', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'CC-BY-4.0',
  'ISC', 'MIT', 'MIT-0', 'Python-2.0', 'Unlicense', 'Zlib', 'BSL-1.0',
  'MPL-2.0', 'OFL-1.1', 'LGPL-2.1-or-later', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
  'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later', 'AGPL-3.0-only', 'AGPL-3.0-or-later',
]);

const exceptions = {
  '@netlify/ai': { reported: 'Unknown', reason: 'the packed manifest has no license field; the registry lists MIT' },
  '@netlify/binary-info': { reported: 'Apache 2', reason: 'a non-SPDX spelling of Apache-2.0' },
  callsite: { reported: 'Unknown', reason: 'no license field; the readme states MIT' },
  'spdx-exceptions': { reported: 'CC-BY-3.0', reason: 'a JSON list of SPDX identifiers, data rather than code' },
};

function tokens(expression) {
  return expression.replace(/[()]/g, ' $& ').trim().split(/\s+/);
}

function evaluate(expression) {
  const list = tokens(expression);
  let at = 0;
  const term = () => {
    if (list[at] === '(') {
      at++;
      const value = or();
      at++;
      return value;
    }
    const id = list[at++];
    if (list[at] === 'WITH') at += 2;
    return allowed.has(id);
  };
  const and = () => {
    let value = term();
    while (list[at] === 'AND') { at++; value = term() && value; }
    return value;
  };
  const or = () => {
    let value = and();
    while (list[at] === 'OR') { at++; value = and() || value; }
    return value;
  };
  return or();
}

const report = JSON.parse(execFileSync('pnpm', ['licenses', 'list', '--recursive', '--prod', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

const refused = [];
for (const [license, packages] of Object.entries(report)) {
  for (const pkg of packages) {
    const exception = exceptions[pkg.name];
    if (exception && exception.reported === license) continue;
    if (!evaluate(license)) refused.push(`${pkg.name}@${pkg.versions.join(',')}: ${license}`);
  }
}

if (refused.length) {
  console.error(`Dependencies under a license not allowed alongside AGPL-3.0-only:\n  ${refused.join('\n  ')}`);
  console.error('Add the license to the allowlist in .github/scripts/check-licenses.mjs only if it is compatible, or an exception with its reason.');
  process.exit(1);
}
console.log(`${Object.values(report).flat().length} production dependencies, all under allowed licenses.`);
