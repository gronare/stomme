import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { THEME_CSS } from './admin-theme.mjs';

// Splices the auth shim, the pinned CMS bundle and the generated theme stylesheet into public/admin/index.html.
export function writeAdminShell({ root, here, SVELTIA_CMS_SRC }) {
// Same-window auth handoff: browsers that open the login in the current tab instead of a popup (Arc, some mobile) have no live window.opener to receive the token, so the gateway redirects back to /admin with it in the URL fragment and this shim persists it the way Sveltia does. It MUST run before the CMS bundle, whose hash router would otherwise consume the fragment — hence <head>.
const AUTH_SHIM = `      (function () {
        try {
          var m = (location.hash || '').match(/stomme_cms_token=([^&]+)/);
          if (!m) return;
          var token = decodeURIComponent(m[1]);
          if (!token) return;
          var email = '';
          try {
            var b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            b += '==='.slice((b.length + 3) % 4);
            email = (JSON.parse(atob(b)) || {}).email || '';
          } catch (e) {}
          localStorage.setItem('sveltia-cms.user', JSON.stringify({ name: email, login: email, email: email, token: token, backendName: 'github' }));
          history.replaceState(null, '', location.pathname + location.search);
          location.reload();
        } catch (e) {}
      })();`;
try {
  const indexPath = resolve(root, 'public/admin/index.html');
  let html = readFileSync(indexPath, 'utf8');
  const START = '<!-- >>> stomme-auth:generated (managed by stomme-gen — do not edit) -->';
  const END = '<!-- <<< stomme-auth:generated -->';
  const region = `${START}\n    <script>\n${AUTH_SHIM}\n    </script>\n    ${END}`;
  const s = html.indexOf(START), e = html.indexOf(END);
  if (s !== -1 && e !== -1) {
    html = html.slice(0, s) + region + html.slice(e + END.length); // refresh in place
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', `    ${region}\n  </head>`); // inject once
  }
  // Re-pins an existing Sveltia tag at any version as well as swapping a legacy Decap one, so a version bump propagates on cms:gen. `type="module"` is deliberately omitted — Sveltia warns when it is present.
  html = html.replace(
    /<script\s+src="https:\/\/unpkg\.com\/(?:decap-cms|@sveltia\/cms)@[^"]*"><\/script>/,
    `<script src="${SVELTIA_CMS_SRC}"></script>`,
  );
  // Loaded after the CMS bundle and cache-busted by a content hash, so a plain reload always gets the current version.
  {
    let src = ''; try { src = readFileSync(resolve(here, '../admin/editor.js'), 'utf8'); } catch (e) {}
    let h = 0; for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
    const addonTag = '<script src="/admin/stomme-addon-previews.js"></script>';
    const hasAddonPreviews = existsSync(resolve(root, 'public/admin/stomme-addon-previews.js'));
    if (hasAddonPreviews && !html.includes(addonTag)) {
      html = html.replace('<script src="/admin/previews.js"></script>',
        `${addonTag}\n    <script src="/admin/previews.js"></script>`);
    } else if (!hasAddonPreviews && html.includes(addonTag)) {
      html = html.replace(new RegExp(`\\s*${addonTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '');
    }
    const tag = `<script src="/admin/stomme-editor.js?v=${(h >>> 0).toString(36)}"></script>`;
    if (/<script src="\/admin\/stomme-editor\.js[^"]*"><\/script>/.test(html)) {
      html = html.replace(/<script src="\/admin\/stomme-editor\.js[^"]*"><\/script>/, tag);
    } else {
      html = html.replace(`<script src="${SVELTIA_CMS_SRC}"></script>`, `<script src="${SVELTIA_CMS_SRC}"></script>\n    ${tag}`);
    }
  }
  const T_START = '<!-- >>> stomme-theme:generated (managed by stomme-gen — do not edit) -->';
  const T_END = '<!-- <<< stomme-theme:generated -->';
  // External, content-hashed stylesheet: an inline <style> in index.html is not cache-busted, so a plain reload keeps serving stale theme CSS.
  let th = 0; for (let i = 0; i < THEME_CSS.length; i++) th = (th * 31 + THEME_CSS.charCodeAt(i)) | 0;
  try { writeFileSync(resolve(root, 'public/admin/stomme-theme.css'), THEME_CSS); }
  catch (e) { console.warn('  (stomme-theme.css skipped:', e.message + ')'); }
  const themeRegion = `${T_START}\n    <link rel="stylesheet" href="/admin/stomme-theme.css?v=${(th >>> 0).toString(36)}">\n    ${T_END}`;
  const ts = html.indexOf(T_START), te = html.indexOf(T_END);
  if (ts !== -1 && te !== -1) {
    html = html.slice(0, ts) + themeRegion + html.slice(te + T_END.length); // refresh in place
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', `    ${themeRegion}\n  </head>`); // inject once
  }
  writeFileSync(indexPath, html);
} catch (e) {
  console.warn('  (admin auth shim skipped:', e.message + ')');
}
}
