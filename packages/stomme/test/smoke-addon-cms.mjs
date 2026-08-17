#!/usr/bin/env node
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
  // Authored at 8 in the pane, +2 for the region indent — hence the 10-space match.
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
