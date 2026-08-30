import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '@stomme/config';

const escape = (s: string) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');

// RFC 5545 counts the 75-octet limit in octets, not characters, so the split walks UTF-8 bytes and never lands inside one: a folded multi-byte character would arrive as mojibake in the reader's calendar.
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74;
  }
  return out.join('\r\n ');
}

const stamp = (d: Date) => `${d.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;

export function calendarFeed(collection: string, prefix: string): APIRoute {
  return async (context) => {
    const origin = String(site?.url || context.site || '').replace(/\/+$/, '');
    const host = (() => { try { return new URL(origin).hostname; } catch { return 'localhost'; } })();
    const entries = (await getCollection(collection))
      .filter((p: any) => p.data.eventDate)
      .map((p: any) => ({ id: p.id, data: p.data, date: String(p.data.eventDate).slice(0, 10) }))
      .sort((a: { date: string }, b: { date: string }) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const dtstamp = stamp(new Date());
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//stomme//calendar//EN', 'CALSCALE:GREGORIAN'];
    for (const p of entries) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${p.id}@${host}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART;VALUE=DATE:${p.date.replace(/-/g, '')}`);
      lines.push(`SUMMARY:${escape(p.data.title)}`);
      if (p.data.excerpt) lines.push(`DESCRIPTION:${escape(p.data.excerpt)}`);
      lines.push(`URL:${origin}${prefix}/${p.id}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');

    return new Response(`${lines.map(fold).join('\r\n')}\r\n`, {
      headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
    });
  };
}
