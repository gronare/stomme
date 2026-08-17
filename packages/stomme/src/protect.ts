export function encodeContact(value: string): string {
  const reversed = (value || '').split('').reverse().join('');
  if (typeof btoa === 'function') return btoa(reversed);
  return Buffer.from(reversed, 'binary').toString('base64');
}

export function maskContact(value: string): string {
  return (value || '').replace(/[\p{L}\p{N}]/gu, '•');
}
