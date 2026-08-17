import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// Vite's public middleware matches exact filenames only, so a directory address under public/ never reaches sirv and Astro's router has no route for it: `/admin` 404s in dev while the same address works in production, and both the README and create-stomme promise the CMS lives there.
export function publicIndexPlugin(publicDir) {
  return {
    name: 'stomme:public-index',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [path, query] = (req.url || '').split('?');
        let rel = '';
        try { rel = decodeURIComponent(path || '').replace(/^\/+|\/+$/g, ''); } catch { return next(); }
        if (rel && !rel.split('/').includes('..') && existsSync(resolve(publicDir, rel, 'index.html'))) {
          req.url = `/${rel}/index.html${query ? `?${query}` : ''}`;
        }
        next();
      });
    },
  };
}
