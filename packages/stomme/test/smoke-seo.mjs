#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const ASTRO = resolve(STARTER, 'node_modules/.bin/astro');
const PORT = Number(process.env.PORT || 4397);
const BASE = `http://127.0.0.1:${PORT}`;
const SITE_URL = 'https://example.com';

const results = [];
const check = (ok, name) => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}`); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUp(timeoutMs = 120000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { const r = await fetch(`${BASE}/`); if (r.status) return true; } catch {}
    await sleep(300);
  }
  return false;
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.text() };
}

async function portBusy() {
  try { await fetch(`${BASE}/`); return true; } catch { return false; }
}

const jsonLd = (html) => {
  const found = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) { try { found.push(JSON.parse(m[1])); } catch { found.push(null); } }
  return found;
};

let child;
try {
  if (await portBusy()) {
    console.error(`✗ something is already listening on ${BASE} — refusing to test against a server this run did not start.`);
    process.exit(1);
  }
  child = spawn(ASTRO, ['dev', '--port', String(PORT), '--host', '127.0.0.1', '--ignore-lock'], {
    cwd: STARTER,
    env: { ...process.env, STOMME_SLOTS_DIR: '', ASTRO_DEV_BACKGROUND: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const up = await waitUp();
  check(up, 'astro dev is serving the starter');
  if (!up) console.error(log);
  else {
    const robots = await get('/robots.txt');
    check(robots.status === 200, 'GET /robots.txt is served by the injected route');
    check(robots.body === `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap-index.xml\n`,
      'robots.txt allows every crawler and points at the sitemap index on the configured site URL');

    const thanks = await get('/thanks');
    check(thanks.status === 200, 'GET /thanks is served');
    check(/<meta name="robots" content="noindex, nofollow"\s*\/?>/.test(thanks.body),
      'the form-success page carries the noindex robots meta without the site listing it');

    const home = await get('/');
    check(home.status === 200, 'GET / is served');
    const homeLd = jsonLd(home.body);
    const business = homeLd.find((o) => o && o['@type'] === 'LocalBusiness');
    check(!!business, 'the home page carries a LocalBusiness application/ld+json script');
    check(business?.['@context'] === 'https://schema.org', 'the schema names its context');
    check(business?.name === 'Starter Co', "the business name is the settings singleton's name");
    check(business?.url === SITE_URL, 'the business url is the site origin');
    check(business?.telephone === '+15550100', "the telephone is the contact singleton's E.164 number");
    check(business?.email === 'hello@example.com', 'the email comes from the same singleton');
    check(!('address' in (business ?? {})), "the starter's blank address fields emit no PostalAddress");
    check(!('areaServed' in (business ?? {})), 'an empty towns collection emits no areaServed');
    check(!('sameAs' in (business ?? {})), 'no socials emit no sameAs');

    const inner = await get('/thanks');
    check(jsonLd(inner.body).every((o) => !o || o['@type'] !== 'LocalBusiness'),
      'a page that is not the site root carries no LocalBusiness schema');
  }
} finally {
  if (child?.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} } }
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ SEO baseline smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ robots.txt, form-success noindex and the LocalBusiness schema all in place.');
