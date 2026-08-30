import { resolve } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

export function buildOptionSources({ root, ROUTES, FEATURES, LISTINGS, BLOCKS }) {
  // A translation is the same page in another language, never a second link target — and it is one whether or not the site has switched its languages on, or a site with the files in place but the setting still off offers /info.en in every picker. Both halves are load-bearing: a language subtag in the stem AND the untranslated sibling beside it, so a page genuinely called `plan.b` stays a page.
  const LOCALE_TAIL = /\.([a-z]{2,3}(?:-[a-z0-9]{2,8})?)\.md$/i;
  const isLocaleFile = (f, siblings) => {
    const m = f.match(LOCALE_TAIL);
    return !!m && siblings.has(`${f.slice(0, -m[0].length)}.md`);
  };

  function contentFiles(dir) {
    let files = [];
    try {
      files = readdirSync(resolve(root, dir)).filter((f) => f.endsWith('.md'));
    } catch {
      return [];
    }
    const siblings = new Set(files);
    return files.filter((f) => !isLocaleFile(f, siblings)).sort();
  }

  function labelFromFrontmatter(file, key) {
    try {
      const m = readFileSync(file, 'utf8').match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
      return m ? m[1].replace(/^["']|["']$/g, '').trim() : null;
    } catch {
      return null;
    }
  }

  function collectionOptions(dir, routePrefix, labelKey) {
    return contentFiles(dir).map((f) => {
      const slug = f.replace(/\.md$/, '');
      const route = `${routePrefix}/${slug}`;
      const label = labelFromFrontmatter(resolve(root, dir, f), labelKey) || slug;
      return { label: `${label} (${route})`, value: route };
    });
  }

  function pageRouteOptions() {
    const opts = [{ label: 'Home (/)', value: '/' }];
    for (const f of contentFiles('src/content/pages')) {
      const slug = f.replace(/\.md$/, '');
      const label = labelFromFrontmatter(resolve(root, 'src/content/pages', f), 'title') || slug;
      opts.push({ label: `${label} (/${slug})`, value: `/${slug}` });
    }
    return opts;
  }

  const PAGE_OPTIONS = [
    { label: '— No page —', value: '' },
    ...pageRouteOptions(),
    ...collectionOptions('src/content/services', ROUTES.services, 'navLabel'),
    ...collectionOptions('src/content/towns', ROUTES.towns, 'name'),
  ];

  function serviceOptions() {
    return contentFiles('src/content/services').map((f) => {
      const slug = f.replace(/\.md$/, '');
      return { label: labelFromFrontmatter(resolve(root, 'src/content/services', f), 'navLabel') || slug, value: slug };
    });
  }
  const SERVICE_OPTIONS = serviceOptions();

  function faqOptions() {
    return contentFiles('src/content/faq').map((f) => {
      const slug = f.replace(/\.md$/, '');
      return { label: labelFromFrontmatter(resolve(root, 'src/content/faq', f), 'question') || slug, value: slug };
    });
  }
  const FAQ_OPTIONS = faqOptions();

  function faqTagOptions() {
    const files = contentFiles('src/content/faq');
    const tags = new Set();
    for (const f of files) {
      let src = '';
      try { src = readFileSync(resolve(root, 'src/content/faq', f), 'utf8'); } catch { continue; }
      const block = src.match(/^tags:\s*\n((?:[ \t]+-[ \t]+.*\n)+)/m);
      if (block) for (const m of block[1].matchAll(/-[ \t]+["']?([^"'\n]+?)["']?\s*$/gm)) tags.add(m[1].trim());
      const inline = src.match(/^tags:\s*\[([^\]]*)\]/m);
      if (inline) for (const t of inline[1].split(',')) { const v = t.trim().replace(/^["']|["']$/g, ''); if (v) tags.add(v); }
    }
    return [...tags].sort().map((t) => ({ label: t, value: t }));
  }
  const FAQ_TAG_OPTIONS = faqTagOptions();

  function documentGroupOptions() {
    const groups = new Set();
    for (const f of contentFiles('src/content/documents')) {
      const g = labelFromFrontmatter(resolve(root, 'src/content/documents', f), 'group');
      if (g) groups.add(g);
    }
    return [...groups].sort().map((g) => ({ label: g, value: g }));
  }
  const DOCUMENT_GROUP_OPTIONS = documentGroupOptions();

  const OPTION_SOURCES = { '$pages': PAGE_OPTIONS, '$services': SERVICE_OPTIONS, '$faq': FAQ_OPTIONS, '$faqTags': FAQ_TAG_OPTIONS, '$documentGroups': DOCUMENT_GROUP_OPTIONS };

  function collectionExists(name) {
    try {
      readdirSync(resolve(root, 'src/content', name));
      return true;
    } catch {
      return false;
    }
  }
  const FEATURE_OF = { faq: 'faq', testimonials: 'testimonials', documents: 'documents', towns: 'areas', posts: 'blog', services: 'services' };
  function collectionEnabled(name) {
    if (name === 'home') return true;
    // Pages are enabled unless EXPLICITLY disabled — a deliberate exception to "absent = off", since the collection predates feature flags and absent-means-off would orphan every existing site's page content.
    if (name === 'pages') return !(FEATURES && FEATURES.pages === false);
    if (FEATURES && FEATURE_OF[name]) return !!FEATURES[FEATURE_OF[name]];
    return collectionExists(name);
  }
  const hasCatalog = LISTINGS.some((l) => l.preset === 'catalog');
  const hasArticle = !!(FEATURES && FEATURES.blog) || LISTINGS.some((l) => l.preset === 'article');
  const presetOk = (b) => (b.type !== 'catalogList' || hasCatalog) && (b.type !== 'postList' || hasArticle);
  const featureOn = (name) => !!(FEATURES && FEATURES[name]);
  const blockOk = (b) => (!b.collection || collectionEnabled(b.collection)) && (!b.feature || featureOn(b.feature)) && presetOk(b);
  const AVAILABLE_BLOCKS = BLOCKS.filter(blockOk);

  const NO_SAMPLE = BLOCKS.filter((b) => !(b.sample || (Array.isArray(b.samples) && b.samples.length)));
  if (NO_SAMPLE.length) console.warn(`  ⚠ lookbook: no sample for ${NO_SAMPLE.map((b) => b.type).join(', ')} — add \`sample\`/\`samples\` in the catalog (block won't render in /lookbook)`);
  const SKIPPED_BLOCKS = BLOCKS.filter((b) => !blockOk(b));

  // The menu value encodes "<collectionId>::<routeBase>" — Header splits on it to query the collection AND build per-entry links, so the separator is a contract.
  const MENU_OPTIONS = [];
  if (collectionEnabled('services')) MENU_OPTIONS.push({ label: 'Services', value: `services::${ROUTES.services || '/services'}` });
  if (collectionEnabled('towns')) MENU_OPTIONS.push({ label: 'Areas', value: `towns::${ROUTES.towns || '/areas'}` });
  for (const l of LISTINGS) MENU_OPTIONS.push({ label: l.label || l.id, value: `${l.id}::${l.route}` });
  OPTION_SOURCES['$menus'] = MENU_OPTIONS;

  const GROUP_ORDER = ['Hero & headers', 'Text', 'Cards & lists', 'Media', 'Quote & highlight', 'Numbers', 'From collections', 'Calls to action', 'Automatic'];
  const groupRank = (b) => { const i = GROUP_ORDER.indexOf(b.group); return i === -1 ? GROUP_ORDER.length : i; };
  AVAILABLE_BLOCKS.sort((a, b) => groupRank(a) - groupRank(b));
  return { PAGE_OPTIONS, FAQ_TAG_OPTIONS, DOCUMENT_GROUP_OPTIONS, OPTION_SOURCES, collectionEnabled, AVAILABLE_BLOCKS, SKIPPED_BLOCKS, GROUP_ORDER };
}
