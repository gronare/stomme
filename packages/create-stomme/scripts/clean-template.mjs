// postpack: the tarball is built, so drop the snapshot and let the local scaffolder read the live starter again.
import { rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
rmSync(resolve(here, '../template'), { recursive: true, force: true });
console.log('postpack: cleaned template/');
