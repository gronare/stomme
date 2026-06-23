// Local dev: run Astro AND the Decap CMS local proxy together, so /admin saves +
// the media library work with no login. The proxy runs on Decap's default port
// (8081), matching `local_backend: true` in public/admin/config.yml. Override with
// CMS_PROXY_PORT (and set local_backend.url to match). Torn down together on exit.
import { spawn } from 'node:child_process';

const env = process.env.CMS_PROXY_PORT ? { ...process.env, PORT: process.env.CMS_PROXY_PORT } : process.env;

const children = [
  spawn('npx', ['decap-server'], { stdio: 'inherit', env }),
  spawn('npx', ['astro', 'dev'], { stdio: 'inherit' }),
];

let exiting = false;
const shutdown = () => {
  if (exiting) return;
  exiting = true;
  for (const c of children) { try { c.kill('SIGTERM'); } catch {} }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
for (const c of children) c.on('exit', shutdown);
