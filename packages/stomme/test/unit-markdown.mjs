#!/usr/bin/env node
import { createJiti } from 'jiti';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const eq = (got, want, name) => check(got === want, name, `got ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);

// src/markdown.ts reaches for two Vite-only things plain node cannot supply — an `astro:assets` import and `import.meta.glob` — so they are swapped for test doubles, and a substitution that matches nothing throws (the guard bin/gen-admin-blocks.mjs uses) so a rewrite of the module can never silently stop being tested.
let src = readFileSync(resolve(PKG, 'src/markdown.ts'), 'utf8');
const substitute = (re, replacement, what) => {
  if (!re.test(src)) throw new Error(`test/unit-markdown.mjs: ${what} no longer matches src/markdown.ts — update the substitution`);
  src = src.replace(re, replacement);
};
substitute(/^import \{ getImage \} from 'astro:assets';$/m, 'const getImage = (globalThis as any).__stommeGetImage;', 'the astro:assets import');
substitute(/^import type \{ ImageMetadata \} from 'astro';$/m, '', 'the ImageMetadata type import');
substitute(/const uploads = import\.meta\.glob<[^>]*>\(\s*'[^']*',\s*\);/m,
  'const uploads: Record<string, () => Promise<any>> = (globalThis as any).__stommeUploads;', 'the uploads glob');

const WIDE = { src: '/_astro/wide.jpg', width: 1600, height: 900 };
const TALL = { src: '/_astro/tall.jpg', width: 900, height: 1600 };
const SQUARE = { src: '/_astro/square.jpg', width: 800, height: 800 };
globalThis.__stommeUploads = {
  '/src/assets/media/wide.jpg': async () => ({ default: WIDE }),
  '/src/assets/media/tall.jpg': async () => ({ default: TALL }),
  '/src/assets/media/nested/square.jpg': async () => ({ default: SQUARE }),
};
const optimised = [];
globalThis.__stommeGetImage = async ({ src: meta }) => { optimised.push(meta.src); return { src: `${meta.src}?optimised` }; };

const dir = mkdtempSync(join(HERE, '.tmp-markdown-'));
try {
  const file = join(dir, 'markdown.ts');
  writeFileSync(file, src);
  const { renderMarkdown } = await createJiti(import.meta.url).import(file);
  const cls = (html) => (html.match(/<figure class="([^"]*)"/) ?? [])[1];

  eq(await renderMarkdown(''), '', 'empty markdown renders nothing');
  eq(await renderMarkdown(), '', 'no argument renders nothing');
  eq((await renderMarkdown('# Title')).trim(), '<h1>Title</h1>', 'ordinary markdown still goes through marked');
  check((await renderMarkdown('A **bold** word')).includes('<strong>bold</strong>'), 'inline emphasis survives');

  eq(cls(await renderMarkdown('![Alt](/media/wide.jpg)')), 'prose-fig prose-fig--center',
    'an image with no title token is centred');
  eq(cls(await renderMarkdown('![Alt](/media/wide.jpg "left")')), 'prose-fig prose-fig--left',
    'a placement token in the image title becomes the placement class');
  eq(cls(await renderMarkdown('![Alt](/media/wide.jpg "RIGHT")')), 'prose-fig prose-fig--right',
    'placement tokens are case-insensitive');
  eq(cls(await renderMarkdown('![Alt](/media/wide.jpg "wide large")')), 'prose-fig prose-fig--wide prose-fig--large',
    'placement and size can be combined in any order');
  eq(cls(await renderMarkdown('![Alt](/media/wide.jpg "large wide")')), 'prose-fig prose-fig--wide prose-fig--large',
    'the tokens are recognised by name, not by position');
  eq(cls(await renderMarkdown('![Alt](/media/wide.jpg "banana")')), 'prose-fig prose-fig--center',
    'an unknown title token is ignored rather than emitted as a class');
  eq(cls(await renderMarkdown('![Alt](/media/wide.jpg "center")')), 'prose-fig prose-fig--center',
    'an explicit center token resolves to the same class as the default');

  eq(cls(await renderMarkdown('![Alt](/media/tall.jpg)')), 'prose-fig prose-fig--center prose-fig--portrait',
    'an upload taller than it is wide gets the portrait class');
  eq(cls(await renderMarkdown('![Alt](/media/wide.jpg)')), 'prose-fig prose-fig--center',
    'a landscape upload does not');
  eq(cls(await renderMarkdown('![Alt](/media/nested/square.jpg)')), 'prose-fig prose-fig--center',
    'a square upload is not portrait, and a nested media path still resolves');

  optimised.length = 0;
  const rendered = await renderMarkdown('![Alt](/media/wide.jpg)');
  eq(optimised.length, 1, 'a /media/ image is handed to Astro\'s image pipeline');
  check(rendered.includes('src="/_astro/wide.jpg?optimised"'), 'the optimised src replaces the authored /media/ path');

  optimised.length = 0;
  const external = await renderMarkdown('![Alt](https://example.test/a.png)');
  eq(optimised.length, 0, 'an external image is not sent through the image pipeline');
  check(external.includes('src="https://example.test/a.png"'), 'an external image keeps its own src');
  check((await renderMarkdown('![Alt](/media/absent.jpg)')).includes('src="/media/absent.jpg"'),
    'a /media/ path with no matching upload is left as authored instead of breaking the build');

  const captioned = await renderMarkdown('![A caption](/media/wide.jpg)');
  check(captioned.includes('<figcaption>A caption</figcaption>'), 'the alt text doubles as the caption');
  check(captioned.includes('alt="A caption"'), 'the alt attribute is kept as well');
  check(!(await renderMarkdown('![](/media/wide.jpg)')).includes('<figcaption>'),
    'an image with no alt gets no empty caption');
  check(captioned.includes('loading="lazy"') && captioned.includes('decoding="async"'),
    'every figure image is lazy and async-decoded');

  const block = await renderMarkdown('![Alt](/media/wide.jpg)');
  check(!/<p>\s*<figure/.test(block), 'a stand-alone image is unwrapped from its paragraph — a figure inside a p is invalid HTML');
  const inline = await renderMarkdown('Text before ![Alt](/media/wide.jpg) text after.');
  check(inline.includes('<p>Text before <figure') && inline.includes('</figure> text after.</p>'),
    'an image inside a sentence is still replaced in place');

  const twice = await renderMarkdown('![Alt](/media/wide.jpg)\n\n![Alt](/media/wide.jpg)\n');
  eq((twice.match(/<figure/g) ?? []).length, 2, 'the same image used twice is replaced both times');
  const two = await renderMarkdown('![One](/media/wide.jpg "left")\n\n![Two](/media/tall.jpg "right")\n');
  check(two.includes('prose-fig--left') && two.includes('prose-fig--right') && !two.includes('<img src="/media/'),
    'two different images each get their own placement');

  check(!(await renderMarkdown('![Alt](/media/wide.jpg)')).includes('<img src="/media/wide.jpg"'),
    'no unprocessed <img> survives for an upload the pipeline handled');

  console.log('\n· a body\'s own links follow the page\'s language');
  const enLink = (h) => (h === '/kontakt' ? '/en/kontakt' : h);
  eq(await renderMarkdown('Reach us via the [contact form](/kontakt).', enLink),
    '<p>Reach us via the <a href="/en/kontakt">contact form</a>.</p>\n',
    'an internal link in a markdown body is rewritten by the mapper');
  eq(await renderMarkdown('See [booking](/bokning/stugan).', enLink),
    '<p>See <a href="/bokning/stugan">booking</a>.</p>\n',
    'a link the mapper leaves alone is written out unchanged');
  eq(await renderMarkdown('[Us](https://x.se) and [mail](mailto:a@b.se)', enLink),
    '<p><a href="https://x.se">Us</a> and <a href="mailto:a@b.se">mail</a></p>\n',
    'external and mailto links pass through the mapper untouched');
  check(!(await renderMarkdown('Reach us via the [contact form](/kontakt).')).includes('/en/'),
    'without a mapper the body renders exactly as before');
  check((await renderMarkdown('`<a href="/kontakt">`', enLink)).includes('/kontakt') === true
    && !(await renderMarkdown('`<a href="/kontakt">`', enLink)).includes('/en/kontakt'),
    'markup inside a code span is escaped text, not a link — the rewrite cannot reach it');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} markdown checks passed`);
if (failed) { console.error('\n✗ markdown unit tests FAILED'); process.exit(1); }
