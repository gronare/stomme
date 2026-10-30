# Add a custom block

Write your own block component, register it beside the library's blocks, and give it fields in the CMS.

1. Scaffold the component. The name becomes the file `src/blocks/PromoBanner.astro` and the block type `promoBanner`.

   ```bash
   pnpm block:new PromoBanner
   ```

   Build its markup with the library's classes (`.section`, `.display`, `.card`, …) or a scoped `<style>`, and colour it with the theme's CSS variables. [Styles](../reference/styles.md) shows each class and variable.

2. Create `src/blocks/BlockRenderer.astro`, a thin wrapper that passes your blocks to the engine's renderer.

   ```astro
   ---
   import Engine from '@gronare/stomme/BlockRenderer.astro';
   import PromoBanner from './PromoBanner.astro';

   const props = Astro.props;
   ---
   <Engine {...props} registry={{ promoBanner: PromoBanner }} />
   ```

   The CMS preview and `/lookbook` pick this file up on their own.

3. Import the wrapper in the pages that render blocks, `src/pages/index.astro` and `src/pages/[...slug].astro`.

   ```astro
   import BlockRenderer from '../blocks/BlockRenderer.astro';
   ```

4. Add the block's fields to the catalog in `src/blocks/schema.ts`.

   ```ts
   import { defaultBlocks } from '@gronare/stomme/catalog';
   import { headingFields, layoutGroup, styleGroup, surfaceField, type BlockDef } from '@gronare/stomme/kit';

   export const BLOCKS: BlockDef[] = [
     ...defaultBlocks,
     {
       type: 'promoBanner',
       label: 'Promo banner',
       group: 'Calls to action',
       fields: [...headingFields, layoutGroup([]), styleGroup([surfaceField])],
       samples: [{ heading: 'Ten percent off this month' }],
     },
   ];
   ```

5. Regenerate the CMS.

   ```bash
   pnpm cms:gen
   ```

   The output lists `promoBanner` under the custom blocks, and **Promo banner** appears in the CMS's section picker.

`layoutGroup` gives the block `layout.beside`, and `styleGroup([surfaceField])` gives it `style.surface`. The renderer handles both for every block, yours included. `samples` is what `/lookbook` shows. [Field kit](../reference/field-kit.md) lists every helper.

## Replace or extend a built-in block

A custom type wins over a library type with the same key. Register a component as `hero` and it renders every hero block.

To extend rather than replace, handle your own case and hand the rest back to the engine's block.

```astro
---
// src/blocks/Hero.astro
import EngineHero from '@gronare/stomme/blocks/Hero.astro';
const props = Astro.props;
---
{props.media?.kind === 'diagram'
  ? <section class="section hero-grid"><!-- your own media --></section>
  : <EngineHero {...props} />}
```

Register it in the wrapper as `registry={{ hero: Hero }}`. A new value such as `diagram` renders from content right away. To offer it in the CMS, add it to the hero's `media.kind` options in `src/blocks/schema.ts` and run `pnpm cms:gen`.

Import engine files by their published names, such as `@gronare/stomme/Header.astro` and `@gronare/stomme/blocks/Hero.astro`. Other paths inside the package are not stable.
