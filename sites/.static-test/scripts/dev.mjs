// Local dev: regenerate the CMS config + preview assets, then run Astro. There is no
// local CMS proxy to start any more — Sveltia edits local files through the browser's
// File System Access API, so Decap's decap-server (and the `local_backend:` line it
// needed, which stomme-gen now strips from config.yml) is gone.
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

// Regenerate the CMS config + preview assets from the current catalog, content and
// theme before starting, so /admin always reflects the live site (build does the same).
spawnSync('npx', ['stomme-gen'], { stdio: 'inherit' });

// Clear Astro's content-schema cache: it goes stale when the (linked) engine's collection
// schemas change, and a stale schema silently strips new fields from entries — content
// looks "dead" for no visible reason. Cheap to rebuild, so clear it on every dev start.
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
