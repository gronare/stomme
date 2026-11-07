import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// wrangler turns the workers.dev route back on at every deploy unless the config says false (no routes → default true), so a site on its own domain must carry the false.
export function closeWorkersDev(wranglerFile, ownHost) {
  if (!ownHost || !existsSync(wranglerFile)) return false;
  const config = JSON.parse(readFileSync(wranglerFile, 'utf8'));
  writeFileSync(wranglerFile, JSON.stringify({ ...config, workers_dev: false, preview_urls: false }));
  return true;
}
