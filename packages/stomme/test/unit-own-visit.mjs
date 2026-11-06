#!/usr/bin/env node
import { createJiti } from 'jiti';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url);
const { ownVisit, OWN_VISIT_KEY } = await jiti.import(resolve(PKG, 'src/own-visit.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const browser = ({ storage = new Map(), throws = false } = {}) => {
  const urls = [];
  const localStorage = {
    getItem: (k) => { if (throws) throw new Error('SecurityError'); return storage.has(k) ? storage.get(k) : null; },
    setItem: (k, v) => { if (throws) throw new Error('QuotaExceededError'); storage.set(k, String(v)); },
    removeItem: (k) => { if (throws) throw new Error('SecurityError'); storage.delete(k); },
  };
  const visit = (href) => {
    const u = new URL(href);
    const location = { search: u.search, pathname: u.pathname, hash: u.hash };
    const history = { state: null, replaceState: (_s, _t, url) => urls.push(url) };
    return vm.runInNewContext(ownVisit, { location, history, localStorage, URLSearchParams });
  };
  return { visit, storage, urls };
};

console.log('· the opt-out flag');
{
  const b = browser();
  check(b.visit('https://example.com/') === false, 'a browser without the flag is counted');
  check(b.urls.length === 0, 'a URL without the parameter is left alone');
}
{
  const b = browser();
  check(b.visit('https://example.com/services/?gh=1&utm_source=x#top') === true, '?gh=1 stops the beacon on that very page');
  check(b.storage.get(OWN_VISIT_KEY) === '1', '?gh=1 stores the flag');
  check(b.urls[0] === '/services/?utm_source=x#top', 'the parameter leaves the address bar, the rest of the URL stays', `got ${b.urls[0]}`);
  check(b.visit('https://example.com/contact/') === true, 'the flag holds on later pages without the parameter');
  check(b.visit('https://example.com/?gh=0') === false, '?gh=0 counts the visit again');
  check(!b.storage.has(OWN_VISIT_KEY), '?gh=0 clears the flag');
  check(b.urls[1] === '/', '?gh=0 leaves the address bar too', `got ${b.urls[1]}`);
}
{
  const b = browser({ throws: true });
  check(b.visit('https://example.com/?gh=1') === false, 'storage that throws counts the visit rather than breaking the page');
  check(b.urls[0] === '/', 'the parameter is stripped even when storage throws', `got ${b.urls[0]}`);
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exit(1);
