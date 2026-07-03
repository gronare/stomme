// The site's block catalog. By default it's the library catalog; extend it with
// your own blocks: `export const BLOCKS = [...defaultBlocks, ...myBlocks]` (and
// register the component via the <BlockRenderer registry={...}> prop). Run
// `pnpm cms:gen` after edits.
import { defaultBlocks } from '@gronare/stomme/catalog';
import type { BlockDef } from '@gronare/stomme/kit';

export const BLOCKS: BlockDef[] = [...defaultBlocks];
