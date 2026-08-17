#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const root = resolve(process.argv[2] || '.');
const EXT = /\.(ts|mjs|js|astro)$/;
const SKIP = new Set(['node_modules', 'dist', '.astro', '.git']);
const COMMENT = /^\s*\/\//;
// A comment that stops mid-sentence is a wrapped block, not a second thought: the next line finishes it. Two adjacent one-liners about UNRELATED things are allowed and stay legal, which is why the rule reads the terminator rather than counting lines.
const FINISHED = /[.:!?)]$/;
const SWEDISH = /[åäöÅÄÖ]/;

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  if (SKIP.has(name)) return [];
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : (EXT.test(name) ? [p] : []);
});

const problems = [];
for (const file of walk(root)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const next = lines[i + 1] ?? '';
    const text = line.replace(/^\s*\/\/\s?/, '').trimEnd();
    if (COMMENT.test(line) && COMMENT.test(next) && text && !FINISHED.test(text)) {
      problems.push([relative(root, file), i + 1, 'wrapped over two lines — make it one line', text.slice(-60)]);
    }
    if (COMMENT.test(line) && SWEDISH.test(line)) {
      problems.push([relative(root, file), i + 1, 'Swedish in a comment — the code is English', text.slice(0, 60)]);
    }
  });
}

for (const [file, line, why, sample] of problems) console.error(`${file}:${line}  ${why}\n    …${sample}`);
console.log(problems.length ? `✗ ${problems.length} comment problem(s)` : '✓ comments: one line each, English');
process.exit(problems.length ? 1 : 0);
