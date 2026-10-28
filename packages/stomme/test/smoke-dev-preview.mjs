#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STARTER = resolve(HERE, '../../../starter');
const PORT = Number(process.env.PORT || 4597);
const base = `http://localhost:${PORT}`;
const MARKER = 'DEV-PREVIEW ✓ Åäö';
const DATA = Buffer.from(JSON.stringify([{ type: 'hero', heading: MARKER, media: { kind: 'none' } }])).toString('base64');

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

async function up(ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { const r = await fetch(`${base}/robots.txt`); if (r.status < 500) return true; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// astro dev runs in the background when it detects an agent, so the server is stopped through astro as well as by killing the child.
function stop(child) {
  spawnSync('npx', ['astro', 'dev', 'stop'], { cwd: STARTER, stdio: 'ignore' });
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
}

for (const target of ['netlify', 'static']) {
  try { await fetch(`${base}/`); console.error(`✗ something already listens on ${base}; refusing to test a server this run did not start`); process.exit(1); } catch {}
  const log = [];
  const child = spawn('npx', ['astro', 'dev', '--port', String(PORT)], { cwd: STARTER, env: { ...process.env, STOMME_TARGET: target }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  child.stdout.on('data', (d) => log.push(String(d)));
  child.stderr.on('data', (d) => log.push(String(d)));
  try {
    if (!(await up(90000))) { check(false, `${target}: the dev server starts`, log.join('').slice(-2000)); continue; }
    let html = '';
    for (let i = 0; i < 3 && !html.includes(MARKER); i++) html = await (await fetch(`${base}/preview?data=${encodeURIComponent(DATA)}`)).text();
    const main = (html.match(/<main[^>]*>([\s\S]*)<\/main>/) || [])[1] || '';
    check(main.includes(MARKER), `${target}: /preview in dev renders the draft from ?data=`, main ? `<main> holds: ${main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160)}` : 'no <main> in the response');
    const logs = spawnSync('npx', ['astro', 'dev', 'logs'], { cwd: STARTER, encoding: 'utf8' }).stdout || '';
    check(!/Edge Functions local development server/.test(log.join('') + logs), `${target}: dev starts no edge-functions server that fails`);
  } finally {
    stop(child);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
