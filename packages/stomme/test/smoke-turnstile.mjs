#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const DIST = resolve(STARTER, 'dist');
const ADMIN = resolve(STARTER, 'public/admin');
const KEY = '0xPROBEKEYNOTREAL';

const results = [];
const check = (ok, name) => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}`); };

function buildStatic(siteKey) {
  const r = spawnSync('pnpm', ['run', 'build:static'], {
    cwd: STARTER, encoding: 'utf8',
    // Empty, never absent: a site key in the ambient environment would build the "off" page as an ON one and every absence check below would pass while proving nothing.
    env: { ...process.env, STOMME_SLOTS_DIR: '', PUBLIC_TURNSTILE_SITE_KEY: siteKey },
  });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const html = (...parts) => {
  const file = join(DIST, ...parts);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

const MOUNT = /<div class="contact-turnstile"[^>]*>/;
const SCRIPT_TAG = /<script[^>]+src="[^"]*challenges\.cloudflare\.com[^"]*"/;
const FIELD = /name="cf-turnstile-response"/;

const admin = readdirSync(ADMIN).map((f) => [join(ADMIN, f), readFileSync(join(ADMIN, f))]);
const restore = () => { for (const [file, body] of admin) writeFileSync(file, body); };

try {
  console.log('· static build WITH a site key…');
  rmSync(DIST, { recursive: true, force: true });
  const on = buildStatic(KEY);
  check(on.ok, 'build succeeds with a site key');
  if (!on.ok) console.error(on.out);

  const keyed = html('contact', 'index.html');
  if (!keyed.includes('data-stomme-block="contactForm"')) {
    throw new Error('smoke-turnstile: the starter contact page carries no contactForm block — every check here would pass on a page without the form');
  }
  check(MOUNT.test(keyed), 'the widget mount is in the page');
  check(new RegExp(`<div class="contact-turnstile"[^>]*data-sitekey="${KEY}"`).test(keyed), 'the built site key reaches the mount');
  check(/<div class="contact-turnstile"[^>]*><\/div>\s*<button type="submit"/.test(keyed), 'the mount sits inside the form, above the submit button');
  check(!FIELD.test(keyed), 'the token field is never rendered — the submit appends it');

  console.log('· static build with no site key…');
  rmSync(DIST, { recursive: true, force: true });
  const off = buildStatic('');
  check(off.ok, 'build succeeds with no site key');
  if (!off.ok) console.error(off.out);

  const bare = html('contact', 'index.html');
  check(bare.includes('data-stomme-block="contactForm"'), 'the contact form still builds without a site key');
  check(!MOUNT.test(bare), 'no widget mount without a site key');
  check(!SCRIPT_TAG.test(bare), 'no challenge script tag without a site key');
  check(!bare.includes(KEY), 'no site key anywhere in the unkeyed build');
  check(!FIELD.test(bare), 'no token field without a site key');
  check(/<button type="submit" class="btn">/.test(bare), 'the submit button is unchanged');
} finally {
  restore();
  try { rmSync(DIST, { recursive: true, force: true }); } catch {}
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ turnstile gate smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ turnstile gate intact.');
