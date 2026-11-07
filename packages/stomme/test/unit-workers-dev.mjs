#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import stomme from '../integration.mjs';

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const WRANGLER = { name: 'probe', main: 'entry.mjs', compatibility_date: '2026-01-01', assets: { directory: '../client', binding: 'ASSETS' } };

async function build(site, { serverBuild = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'stomme-workers-dev-'));
  const outDir = join(root, 'dist');
  mkdirSync(join(outDir, 'client'), { recursive: true });
  const file = join(outDir, 'server/wrangler.json');
  if (serverBuild) {
    mkdirSync(join(outDir, 'server'), { recursive: true });
    writeFileSync(file, JSON.stringify(WRANGLER));
  }
  const hooks = stomme({}).hooks;
  hooks['astro:config:done']?.({ config: { site, outDir: pathToFileURL(`${outDir}/`) } });
  await hooks['astro:build:done']({ dir: pathToFileURL(`${outDir}/client/`) });
  let out = null;
  try { out = JSON.parse(readFileSync(file, 'utf8')); } catch {}
  rmSync(root, { recursive: true, force: true });
  return out;
}

const own = await build('https://example.se');
check(own?.workers_dev === false, 'a site served on its own domain deploys with the workers.dev route off', JSON.stringify(own));
check(own?.preview_urls === false, 'a site served on its own domain deploys with workers.dev preview URLs off', JSON.stringify(own));
check(own?.name === 'probe' && own?.main === 'entry.mjs' && own?.assets?.binding === 'ASSETS', 'the rest of the generated wrangler config is kept as built', JSON.stringify(own));

for (const demo of ['https://probe.gronare.workers.dev', 'https://probe.pages.dev']) {
  const out = await build(demo);
  check(out && !('workers_dev' in out) && !('preview_urls' in out), `a demo site on ${new URL(demo).hostname} keeps its workers.dev route (wrangler's default stays on)`, JSON.stringify(out));
}

const unset = await build(undefined);
check(unset && !('workers_dev' in unset), 'a site without an address keeps its workers.dev route', JSON.stringify(unset));

const noServer = await build('https://example.se', { serverBuild: false });
check(noServer === null, 'a static build gets no wrangler config written');

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
