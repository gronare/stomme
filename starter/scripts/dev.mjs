// Local dev: run Astro AND the Decap CMS local proxy together, so /admin saves +
// the media library work with no login. The proxy listens on Decap's default port
// (8081, matching `local_backend: true` in public/admin/config.yml). If that port is
// taken — e.g. another site's dev server is already running — we pick the next free
// port and repoint the admin's local_backend at it. Override the starting port with
// CMS_PROXY_PORT. Both processes are torn down together on exit, and local_backend is
// reset to the default so a bumped port never leaks into a commit.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CONFIG = resolve(process.cwd(), 'public/admin/config.yml');
const DEFAULT_PORT = 8081;

const portFree = (port) =>
  new Promise((res) => {
    const srv = createServer();
    srv.once('error', () => res(false));
    srv.once('listening', () => srv.close(() => res(true)));
    srv.listen(port, '127.0.0.1');
  });

const firstFreePort = async (start) => {
  let p = start;
  for (let i = 0; i < 50 && !(await portFree(p)); i++) p += 1;
  return p;
};

// `local_backend: true` means the admin talks to the default :8081; any other port
// needs the explicit URL form. Rewrites the single line in place (no-op if absent).
const setLocalBackend = (value) => {
  try {
    const cfg = readFileSync(CONFIG, 'utf8');
    const next = cfg.replace(/^local_backend:.*$/m, value);
    if (next !== cfg) writeFileSync(CONFIG, next);
  } catch {
    /* no admin config here — skip */
  }
};

// Regenerate the CMS config + preview assets from the current catalog, content and
// theme before starting, so /admin always reflects the live site (build does the same).
spawnSync('npx', ['stomme-gen'], { stdio: 'inherit' });

const desired = Number(process.env.CMS_PROXY_PORT) || DEFAULT_PORT;
const proxyPort = await firstFreePort(desired);
if (proxyPort !== desired) {
  console.log(`⚠ CMS proxy port ${desired} is in use — using ${proxyPort} instead.`);
}
setLocalBackend(
  proxyPort === DEFAULT_PORT
    ? 'local_backend: true'
    : `local_backend: { url: "http://localhost:${proxyPort}/api/v1" }`,
);

const children = [
  spawn('npx', ['decap-server'], { stdio: 'inherit', env: { ...process.env, PORT: String(proxyPort) } }),
  spawn('npx', ['astro', 'dev'], { stdio: 'inherit' }),
];

let exiting = false;
const shutdown = () => {
  if (exiting) return;
  exiting = true;
  setLocalBackend('local_backend: true'); // don't leak a bumped port into git
  for (const c of children) { try { c.kill('SIGTERM'); } catch {} }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
for (const c of children) c.on('exit', shutdown);
