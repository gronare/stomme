import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

spawnSync('npx', ['stomme-gen'], { stdio: 'inherit' });

// Astro's content-schema cache goes stale when the linked engine's collection schemas change, and a stale schema SILENTLY strips new fields from entries — content looks dead for no visible reason. Cheap to rebuild, so clear it every start.
rmSync(resolve(process.cwd(), '.astro'), { recursive: true, force: true });
rmSync(resolve(process.cwd(), 'node_modules/.astro'), { recursive: true, force: true });

const astro = spawn('npx', ['astro', 'dev'], { stdio: 'inherit' });

let exiting = false;
const shutdown = () => {
  if (exiting) return;
  exiting = true;
  try { astro.kill('SIGTERM'); } catch {}
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
astro.on('exit', shutdown);
