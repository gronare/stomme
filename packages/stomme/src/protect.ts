// Scraper protection for contact details. When the Contact `protectContact` toggle is
// on, phone + email are never emitted as tel:/mailto: links or as plain text — they're
// reversed + base64-encoded into data-t / data-d attributes on a `.js-contact` link and
// reconstructed in the browser by the page script the integration injects (see the
// REVEAL constant in integration.mjs). Encode and decode MUST stay in sync:
//   encode = base64(reverse(s))   ·   decode = reverse(atob(s))
// The point isn't strong crypto — it's that the served HTML contains nothing that
// matches a phone/email pattern, so bulk harvesters (which don't run JS) get nothing.
export function encodeContact(value: string): string {
  const reversed = (value || '').split('').reverse().join('');
  // Phone/email are ASCII, so a plain base64 round-trips byte-for-byte in the browser.
  if (typeof btoa === 'function') return btoa(reversed);
  return Buffer.from(reversed, 'binary').toString('base64');
}

// Visible placeholder shown until the page script reveals the real value: keep the
// punctuation/spacing so layout doesn't jump, mask every letter and digit.
export function maskContact(value: string): string {
  return (value || '').replace(/[\p{L}\p{N}]/gu, '•');
}
