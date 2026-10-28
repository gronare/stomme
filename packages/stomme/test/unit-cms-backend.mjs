#!/usr/bin/env node
import { makeSettingsPane } from '../src/settings-pane.mjs';

const results = [];
const check = (ok, name, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
};
const backend = (CMS, SITE_NAME) => makeSettingsPane({ q: JSON.stringify, pad: (n) => ' '.repeat(n), COLLECTION_EDITORS: {}, collectionEnabled: () => false, FEATURES: {}, LISTINGS: [], CMS, LOCALES: [], ADDON_PANES: [], ADDON_PANEL_FILES: [], getStaticCollections: () => new Set(), SITE_NAME }).emitCms(0);
const field = (yaml, key) => (yaml.match(new RegExp(`^  ${key}: (.*)$`, 'm')) || [])[1];
// What the pinned Sveltia accepts, from its own config validation: these names, and an owner/name repo on every Git backend.
const SVELTIA_BACKENDS = ['github', 'gitlab', 'gitea', 'forgejo', 'test-repo'];
const REPO = /^[^/:]+(?:\/[^/:]+)+$/;

const fresh = backend(null, 'my-garden-site');
check(SVELTIA_BACKENDS.includes(field(fresh, 'name')), 'a site with no cms config names a backend Sveltia accepts', fresh);
check(REPO.test(field(fresh, 'repo') || ''), 'and a repo in the owner/name form Sveltia requires', fresh);
check(field(fresh, 'repo') === 'local/my-garden-site', "the placeholder repo is the site's own, so two local sites never share Sveltia's stored folder", fresh);
check(field(backend(null, '@scope/site'), 'repo') === 'local/scope-site', 'a scoped package name still makes a valid repo');
check(field(fresh, 'branch') === 'main', 'the branch defaults to main');

const set = backend({ backend: 'github', repo: 'acme/site', branch: 'live', siteDomain: 'example.org' }, 'ignored');
check(field(set, 'name') === 'github' && field(set, 'repo') === 'acme/site' && field(set, 'branch') === 'live' && field(set, 'site_domain') === 'example.org', 'a configured backend is written as given', set);
const repoOnly = backend({ repo: 'acme/site' }, 'ignored');
check(field(repoOnly, 'name') === 'github' && field(repoOnly, 'repo') === 'acme/site', 'a repo with no backend name is a GitHub repo', repoOnly);
const gitlab = backend({ backend: 'gitlab' }, 'ignored');
check(field(gitlab, 'name') === 'gitlab' && field(gitlab, 'repo') === undefined, 'a named backend never gets the placeholder repo', gitlab);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
