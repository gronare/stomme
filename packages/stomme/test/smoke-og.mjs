// Smoke test for the OG-card renderer (src/og.mjs): every style preset, with and
// without a photo background, plus the sharp-only fallbacks — asserts each result is
// a valid 1200×630 PNG. Pure node (no Astro); run with:  pnpm --filter @gronare/stomme test:og
// The rendered cards are written to a temp dir (path printed) for eyeballing.
import sharp from 'sharp';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as og from '../src/og.mjs';

const outDir = mkdtempSync(join(tmpdir(), 'stomme-og-'));
let failures = 0;

function assertPng(name, buf) {
  const sig = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const ok = sig && w === 1200 && h === 630;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${sig ? 'PNG' : 'NOT PNG'} ${w}×${h}, ${(buf.length / 1024).toFixed(0)} KB`);
  if (!ok) failures++;
  writeFileSync(join(outDir, `${name}.png`), buf);
}

// A deterministic "photo": a two-tone gradient-ish jpeg.
const photo = await sharp({
  create: { width: 1600, height: 900, channels: 3, background: { r: 96, g: 148, b: 180 } },
})
  .composite([{
    input: await sharp({ create: { width: 800, height: 900, channels: 3, background: { r: 214, g: 190, b: 140 } } }).jpeg().toBuffer(),
    left: 800, top: 0,
  }])
  .jpeg()
  .toBuffer();

const base = {
  title: 'Professionell drönartvätt av fasader och tak i hela Västsverige',
  tagline: 'Snabbt, skonsamt och utan ställningar',
  wordmark: { pre: 'Starter', accent: 'Co' },
  theme: { brand: '#4338ca', ink: '#1f2937', onDark: '#ffffff' },
};

for (const style of ['editorial', 'ops', 'bold']) {
  assertPng(`card-${style}-photo`, await og.renderOgCard({ ...base, bgImageBuffer: photo, og: { style, scrim: 55 } }));
  assertPng(`card-${style}-brand-bg`, await og.renderOgCard({ ...base, og: { style, scrim: 55 } }));
}
// Option toggles + a short title (large type path). showLogo off, no second line.
assertPng('card-no-extras', await og.renderOgCard({
  title: 'Short title', wordmark: { pre: 'X' }, theme: base.theme,
  bgImageBuffer: photo, og: { style: 'editorial', scrim: 80, showLogo: false, accent: '#f59e0b' },
}));
// Site-default brand card: business name on the solid brand background, no photo/wordmark.
assertPng('card-default-brand', await og.renderOgCard({
  title: 'Acme Drone Services', wordmark: null, theme: base.theme,
  og: { style: 'editorial', scrim: 55, showLogo: false },
}));
// Fallback surfaces (routes/og.ts steps 3–4).
assertPng('fallback-raw-image', await og.rawImagePng(photo));
assertPng('fallback-solid', await og.solidPng('#4338ca'));
// loadImageSource: a missing file must resolve to null, never throw.
if ((await og.loadImageSource('/images/does-not-exist.jpg')) !== null) { console.log('✗ loadImageSource should return null for missing files'); failures++; }
else console.log('✓ loadImageSource → null for a missing file');

console.log(`\ncards written to ${outDir}`);
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('smoke-og: all good');
