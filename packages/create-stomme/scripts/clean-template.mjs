// postpack: the tarball is already built (prepack → pack → postpack), so remove the
// bundled snapshot from the working tree. Keeps the local/linked scaffolder reading the
// live ../../../starter instead of a stale ./template.
import { rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
rmSync(resolve(here, '../template'), { recursive: true, force: true });
console.log('postpack: cleaned template/');
