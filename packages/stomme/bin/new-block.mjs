#!/usr/bin/env node
// stomme-new-block — scaffold a new block component in the CONSUMER's project.
//
//   npx stomme-new-block PromoBanner
//
// Creates <cwd>/src/blocks/<Name>.astro and prints the two edits to register it.
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = process.cwd();

const raw = process.argv[2];
if (!raw) {
  console.error('Usage: npx stomme-new-block <BlockName>   e.g. npx stomme-new-block PromoBanner');
  process.exit(1);
}

// PascalCase component name → camelCase block type.
const Pascal = raw
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
  .replace(/\s/g, '')
  .replace(/^(.)/, (_, c) => c.toUpperCase());
const type = Pascal.charAt(0).toLowerCase() + Pascal.slice(1);
const file = resolve(root, 'src/blocks', `${Pascal}.astro`);

if (existsSync(file)) {
  console.error(`Already exists: ${file}`);
  process.exit(1);
}
mkdirSync(dirname(file), { recursive: true });

writeFileSync(
  file,
  `---
interface Props {
  heading?: string;
}
const { heading } = Astro.props;
---

<section class="section">
  {heading && <h2 class="display">{heading}</h2>}
  <!-- TODO: build the ${Pascal} block -->
</section>
`,
);

console.log(`✓ Created src/blocks/${Pascal}.astro

Then register it (2 edits) and run \`stomme-gen\`:

  1) your BlockRenderer registry (src/blocks/BlockRenderer.astro)
       import ${Pascal} from './${Pascal}.astro';
       // …and in the registry passed to stomme's <BlockRenderer registry={…}>:
       ${type}: ${Pascal},

  2) src/blocks/schema.ts  (add to BLOCKS)
       {
         type: '${type}',
         label: '${Pascal}',
         fields: [
           { name: 'heading', label: 'Rubrik', widget: 'string', required: false },
         ],
       },
`);
