const LEFT = 4;
const MAX_GAP = 8;

export function timelineYear(raw: unknown): number | null {
  const text = String(raw ?? '');
  const four = text.match(/\d{4}/);
  if (four) return Number(four[0]);
  const two = text.match(/(?<!\d)(\d{2})(?!\d)/);
  if (!two) return null;
  const n = Number(two[1]);
  return n <= 30 ? 2000 + n : 1900 + n;
}

export function timelinePositions(years: unknown[], trailing = false): number[] {
  const right = trailing ? 74 : 84;
  const count = years.length;
  const round = (n: number) => Math.round(n * 100) / 100;
  const evenly = years.map((_, i) => round(count > 1 ? LEFT + (i * (right - LEFT)) / (count - 1) : LEFT));
  const parsed = years.map(timelineYear);
  if (count < 2 || !parsed.every((y) => y !== null)) return evenly;

  const ys = parsed as number[];
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  if (max === min) return evenly;
  const gap = Math.min(MAX_GAP, (right - LEFT) / (count - 1));
  const at = ys.map((y) => LEFT + ((y - min) / (max - min)) * (right - LEFT));
  for (let i = 1; i < count; i++) at[i] = Math.max(at[i], at[i - 1] + gap);
  if (at[count - 1] > right) {
    at[count - 1] = right;
    for (let i = count - 2; i >= 0; i--) at[i] = Math.min(at[i], at[i + 1] - gap);
  }
  return at.map(round);
}
