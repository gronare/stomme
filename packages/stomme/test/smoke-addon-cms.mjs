#!/usr/bin/env node
/*
 * stomme — smoke for the addon CMS-pane seam (bin/gen-admin-blocks.mjs, "Addon CMS panes").
 * The slots dir may ship a `cms.mjs` at its root exporting `collections`: an array of
 * { feature, yaml }, or a function returning one, called with the site's own
 * { routes, features }. Each pane is spliced into the collections:generated region only
 * when the site's flag is on — so an out-of-tree extension's pages are EDITABLE like every
 * other page instead of being invisible to the CMS.
 *
 * Runs the real generator over the `starter` site with a throwaway STOMME_SLOTS_DIR stub.
 * Run with:  pnpm --filter @gronare/stomme test:addon-cms
 *
 * ASSERTS
 *   1. A pane whose feature is ON in the starter (faq) lands in config.yml, at the region's
 *      indent, and the function form receives the site's own routes (the pane's hint carries
 *      routes.formSuccess = '/thanks').
 *   2. A pane whose feature is OFF (blog) is not emitted.
 *   3. A malformed entry is skipped with a warning, and the generator still succeeds.
 *   4. WITHOUT the slots dir, the generated config.yml is byte-identical to the tracked one —
 *      the seam costs a site with no addons nothing.
 *   5. `panelFiles` — the same manifest may contribute FILES to a collection the engine already
 *      emits. An ON entry lands in THAT collection's own `files:` (Settings, after the engine's
 *      own panes) with the site's routes and block picker in hand; an OFF one is not emitted; a
 *      malformed one warns without costing the rest; and an entry naming a collection the engine
 *      does not emit lands nowhere at all.
 *
 * starter/public/admin/config.yml is regenerated in place (as admin-contract.mjs already
 * does) and restored from its pre-run bytes in `finally`.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const STARTER = resolve(REPO_ROOT, 'starter');
const CONFIG = resolve(STARTER, 'public/admin/config.yml');

const results = [];
const check = (ok, name) => { results.push([!!ok, name]); console.log(`${ok ? '✓' : '✗'} ${name}`); };

function generate(env) {
  const r = spawnSync('pnpm', ['run', 'cms:gen'], {
    cwd: STARTER,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`, yml: readFileSync(CONFIG, 'utf8') };
}

const ORIGINAL = readFileSync(CONFIG, 'utf8');
let stub;
try {
  stub = mkdtempSync(join(tmpdir(), 'stomme-addon-cms-'));
  // A file collection is the shape a single editable page uses (the engine's own
  // "Form confirmation" pane is one), so the stub mirrors a real addon page.
  writeFileSync(join(stub, 'cms.mjs'), `export const collections = ({ routes, blocks }) => [
  {
    feature: 'faq',
    yaml: \`- name: addon_on
  label: "Addon pane"
  files:
    - name: addon_on
      label: "Addon page"
      file: "src/content/addon/addon.md"
      fields:
        - { name: heading, label: "Heading", widget: string, required: false, hint: "success route is \${routes.formSuccess}" }
\${blocks(8)}\`,
  },
  { feature: 'blog', yaml: '- name: addon_off\\n  label: "Addon pane (off)"\\n  files: []' },
  { feature: '', yaml: '- name: broken' },
];

// Files contributed to a collection the ENGINE emits — the addon's own setting under Settings.
export const panelFiles = ({ routes, blocks }) => ({
  settings: [
    {
      feature: 'faq',
      yaml: \`- name: addon_panel
  label: "Addon settings page"
  file: "src/content/addon/panel.md"
  fields:
    - { name: heading, label: "Heading", widget: string, required: false, hint: "panel route is \${routes.formSuccess}" }
\${blocks(6)}\`,
    },
    { feature: 'blog', yaml: '- name: addon_panel_off\\n  label: "Off"\\n  file: "src/content/addon/off.md"\\n  fields: []' },
    { feature: '', yaml: '- name: broken_panel' },
  ],
  nowhere: [{ feature: 'faq', yaml: '- name: addon_panel_stray\\n  label: "Stray"\\n  file: "src/content/addon/stray.md"\\n  fields: []' }],
});
`);

  console.log('· cms:gen WITH STOMME_SLOTS_DIR (stub)…');
  const withStub = generate({ STOMME_SLOTS_DIR: stub });
  check(withStub.ok, 'cms:gen succeeds with an addon CMS manifest');
  if (!withStub.ok) console.error(withStub.out);
  check(/^ {2}- name: addon_on$/m.test(withStub.yml), "the ON pane is emitted at the collections indent");
  check(withStub.yml.includes('success route is /thanks'), "the manifest function receives the site's own routes");
  // The pane composes out of the SITE's blocks, so an addon page is stylable like any other.
  // Authored at 8 in the pane, +2 for the region indent, exactly like the engine's own editors.
  check(/^ {10}- name: blocks$/m.test(withStub.yml), "the manifest function receives the site's own block picker");
  check(!withStub.yml.includes('addon_off'), 'a pane whose feature is OFF is not emitted');
  check(!withStub.yml.includes('- name: broken'), 'a malformed entry is not emitted');
  check(/addon cms: skipped a malformed entry/.test(withStub.out), 'the malformed entry is reported');
  // The pane must sit INSIDE the generated region, or `cms:gen` would drop it next run.
  const region = withStub.yml.slice(
    withStub.yml.indexOf('# >>> collections:generated'),
    withStub.yml.indexOf('# <<< collections:generated'),
  );
  check(region.includes('- name: addon_on'), 'the pane lands inside the collections:generated region');

  // ── panelFiles: files spliced into a collection the engine already emits ──────────
  const settings = withStub.yml.slice(
    withStub.yml.indexOf('# >>> settings:generated'),
    withStub.yml.indexOf('# <<< settings:generated'),
  );
  check(/^ {6}- name: addon_panel$/m.test(settings), "the ON panel file lands in the settings collection's own files:");
  check(settings.includes('panel route is /thanks'), "the panelFiles function receives the site's own routes");
  // Authored at 6 in the panel file, +6 for the settings files indent.
  check(/^ {12}- name: blocks$/m.test(settings), "the panelFiles function receives the site's own block picker");
  // Appended last, so an addon can never displace the settings the site's owner came for.
  check(settings.indexOf('- name: addon_panel') > settings.indexOf('- name: showContact'), "the panel file follows the engine's own settings panes");
  check(!withStub.yml.includes('addon_panel_off'), 'a panel file whose feature is OFF is not emitted');
  check(!withStub.yml.includes('broken_panel'), 'a malformed panel file is not emitted');
  check(/addon cms: skipped a malformed panel file/.test(withStub.out), 'the malformed panel file is reported');
  check(!withStub.yml.includes('addon_panel_stray'), 'a panel file for a collection the engine does not emit lands nowhere');

  console.log('· cms:gen WITHOUT STOMME_SLOTS_DIR…');
  const noStub = generate({ STOMME_SLOTS_DIR: '' });
  check(noStub.ok, 'cms:gen succeeds without a slots dir');
  check(noStub.yml === ORIGINAL, 'without a slots dir the generated config is byte-identical to the tracked one');
} finally {
  writeFileSync(CONFIG, ORIGINAL);
  if (stub) { try { rmSync(stub, { recursive: true, force: true }); } catch {} }
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('\n✗ addon CMS-pane seam smoke FAILED:');
  for (const [, name] of failed) console.error(`   · ${name}`);
  process.exit(1);
}
console.log('✓ addon CMS-pane seam intact.');
