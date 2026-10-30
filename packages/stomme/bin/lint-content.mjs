#!/usr/bin/env node
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { loadSiteBlocks } from '../src/site-blocks.mjs';
import { lintContent, formatReport } from '../src/content-lint.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const USAGE = `stomme-lint-content [--json] [--strict]

Reads every block in src/content/**/*.md against the site's catalog and reports
each field the catalog does not declare, each older field from
block-migrations.json and each block type the site does not have.

  --json      print the report as JSON
  --strict    exit 1 when anything is reported`;

export async function siteBlocks(root, log = { log() {}, warn: console.warn }) {
  const jiti = createJiti(import.meta.url);
  const schemaPath = resolve(root, process.env.STOMME_SCHEMA || 'src/blocks/schema.ts');
  if (existsSync(schemaPath)) return loadSiteBlocks({ jiti, schemaPath, log });
  return (await jiti.import(resolve(here, '../catalog.ts'))).defaultBlocks;
}

export const registry = () => JSON.parse(readFileSync(resolve(here, '../block-migrations.json'), 'utf8'));

async function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  const unknown = argv.filter((a) => !['--json', '--strict'].includes(a));
  if (unknown.length) { console.error(`stomme-lint-content: unknown option ${unknown[0]}\n\n${USAGE}`); return 2; }
  const root = process.cwd();
  const result = lintContent({ root, blocks: await siteBlocks(root), registry: registry() });
  if (argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else console.log(formatReport(result));
  const { unknown: u, legacy: l, 'unknown-block': b, unreadable: r } = result.counts;
  return argv.includes('--strict') && u + l + b + r > 0 ? 1 : 0;
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exitCode = await main(process.argv.slice(2));
