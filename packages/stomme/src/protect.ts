// encode = base64(reverse(s)) and MUST stay in sync with its hand-mirrored decode, reverse(atob(s)), in the REVEAL page script in integration.mjs.
export function encodeContact(value: string): string {
  const reversed = (value || '').split('').reverse().join('');
  // Phone/email are ASCII, so a plain base64 round-trips byte-for-byte in the browser.
  if (typeof btoa === 'function') return btoa(reversed);
  return Buffer.from(reversed, 'binary').toString('base64');
}

// Keep the punctuation and spacing so layout doesn't jump when the page script swaps the real value in.
export function maskContact(value: string): string {
  return (value || '').replace(/[\p{L}\p{N}]/gu, '•');
}
