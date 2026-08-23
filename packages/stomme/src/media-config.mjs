const R2_KEYS = ['accountId', 'bucket', 'accessKeyId', 'publicUrl'];

export function resolveMediaConfig(media) {
  const m = media && typeof media === 'object' ? media : {};
  const storage = m.storage ?? 'git';
  if (storage === 'git') return { storage, pointers: m.pointers === true };
  if (storage !== 'r2') throw new Error(`stomme: site.media.storage must be "git" or "r2", got ${JSON.stringify(storage)}`);
  const missing = R2_KEYS.filter((k) => !m[k]);
  if (missing.length) throw new Error(`stomme: site.media with storage "r2" needs ${missing.join(', ')}`);
  return { storage, pointers: false, accountId: m.accountId, bucket: m.bucket, accessKeyId: m.accessKeyId, publicUrl: m.publicUrl, prefix: m.prefix, jurisdiction: m.jurisdiction };
}

// The secret access key is never written: Sveltia asks the editor for it once and keeps it in the browser.
export function r2LibraryYaml(media, indent = '  ') {
  if (media.storage !== 'r2') return '';
  const rows = [
    ['access_key_id', media.accessKeyId], ['bucket', media.bucket], ['account_id', media.accountId],
    ['public_url', media.publicUrl], ['prefix', media.prefix], ['jurisdiction', media.jurisdiction],
  ].filter(([, v]) => v);
  return `${indent}cloudflare_r2:\n${rows.map(([k, v]) => `${indent}  ${k}: ${JSON.stringify(String(v))}`).join('\n')}\n`;
}
