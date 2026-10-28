#!/usr/bin/env node
import { createJiti } from 'jiti';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const STUB_CONTENT = resolve(HERE, 'stub-astro-content.mjs');
const STUB_ENV = resolve(HERE, 'stub-runtime-env.mjs');
const jiti = createJiti(import.meta.url, {
  alias: { 'astro:content': STUB_CONTENT, '@stomme/config': resolve(HERE, 'stub-stomme-config.mjs'), '@stomme/runtime-env': STUB_ENV },
});
const { reset } = await jiti.import(STUB_CONTENT);
const { env: platform } = await jiti.import(STUB_ENV);
const { POST } = await jiti.import(resolve(PKG, 'src/contact.ts'));

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};

const ENV_KEYS = ['RESEND_API_KEY', 'CONTACT_FROM', 'CONTACT_TO'];
for (const k of ENV_KEYS) delete process.env[k];
const setPlatform = (vars) => { for (const k of Object.keys(platform)) delete platform[k]; Object.assign(platform, vars); };
const MAIL = { RESEND_API_KEY: 're_test', CONTACT_FROM: 'site@example.com', CONTACT_TO: 'owner@example.com' };

let calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  return new Response('{"id":"x"}', { status: 200 });
};
const sent = () => calls.filter((c) => c.url.includes('api.resend.com'));

// The Cloudflare adapter's locals: reading `runtime.env` throws, exactly as Astro 7 ships it.
const cloudflareLocals = { get runtime() { return { get env() { throw new Error('Astro.locals.runtime.env has been removed in Astro v6.'); } }; } };

async function post(fields = {}, { locals = cloudflareLocals, ip = '203.0.113.7' } = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ name: 'Ada', email: 'ada@example.com', message: 'Hello', ...fields })) fd.set(k, v);
  const request = new Request('https://site.example/api/contact', { method: 'POST', body: fd, headers: { accept: 'application/json', 'CF-Connecting-IP': ip } });
  return POST({ request, locals, redirect: (to, status) => new Response(null, { status, headers: { location: to } }) });
}

reset({}, {});

// ── env reads ───────────────────────────────────────────────────────────────
calls = []; setPlatform(MAIL);
let res = await post();
check(res.status === 200, 'a POST on the Cloudflare adapter succeeds without touching locals.runtime', `HTTP ${res.status} ${await res.clone().text()}`);
check(sent().length === 1 && JSON.parse(sent()[0].init.body).to === 'owner@example.com', 'the recipient comes from the platform env');
check(sent()[0]?.init.headers.Authorization === 'Bearer re_test', 'the API key comes from the platform env');

calls = []; setPlatform({});
Object.assign(process.env, MAIL);
res = await post({}, { locals: {} });
check(res.status === 200 && sent().length === 1, 'on a Node-style target the keys come from process.env', `HTTP ${res.status}`);
for (const k of ENV_KEYS) delete process.env[k];

calls = []; setPlatform({});
res = await post({}, { locals: {} });
check(res.status === 500 && /not configured/.test((await res.json()).error), 'with no keys anywhere the handler names what is missing');

// ── STOMME_RL ───────────────────────────────────────────────────────────────
const kv = new Map();
const rl = { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } };
calls = []; setPlatform({ ...MAIL, STOMME_RL: rl });
const statuses = [];
for (let i = 0; i < 6; i++) statuses.push((await post({}, { ip: '198.51.100.1' })).status);
check(JSON.stringify(statuses) === JSON.stringify([200, 200, 200, 200, 200, 429]), 'the STOMME_RL binding from the platform env refuses the sixth message', statuses.join(','));
check(kv.get('c:site.example:198.51.100.1') === '5', 'the rate limit counts per host and client address', String(kv.get('c:site.example:198.51.100.1')));

// ── wiring ──────────────────────────────────────────────────────────────────
const integration = readFileSync(resolve(PKG, 'integration.mjs'), 'utf8');
check(/@stomme\/runtime-env/.test(integration) && /runtime-env-cloudflare\.mjs/.test(integration), 'the integration aliases @stomme/runtime-env to the Cloudflare module on that adapter');
check(/from 'cloudflare:workers'/.test(readFileSync(resolve(PKG, 'src/runtime-env-cloudflare.mjs'), 'utf8')), 'the Cloudflare module reads env from cloudflare:workers');
check(!/locals\s*\??\.\s*runtime|runtime\?\.env/.test(readFileSync(resolve(PKG, 'src/contact.ts'), 'utf8').replace(/\/\/.*$/gm, '')), 'the handler never reads locals.runtime');

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
