export interface ThemeColors {
  brand?: string; ink?: string; muted?: string; onDark?: string; surface?: string; paper?: string; line?: string;
  highlight?: string; secondary?: string; dark?: string; darkInk?: string; darkLine?: string; eyebrowColor?: string;
  scheme?: string;
  nightBrand?: string; nightInk?: string; nightMuted?: string; nightOnDark?: string; nightSurface?: string; nightPaper?: string; nightLine?: string;
  nightHighlight?: string; nightSecondary?: string; nightDark?: string; nightDarkInk?: string; nightDarkLine?: string;
}

export const NIGHT_COLORS = [
  ['nightBrand', '--color-brand'], ['nightInk', '--color-ink'], ['nightMuted', '--color-muted'], ['nightOnDark', '--color-on-dark'],
  ['nightSurface', '--color-surface'], ['nightPaper', '--color-paper'], ['nightLine', '--color-line'], ['nightHighlight', '--color-highlight'],
  ['nightSecondary', '--color-secondary'], ['nightDark', '--color-dark'], ['nightDarkInk', '--color-dark-ink'], ['nightDarkLine', '--color-dark-line'],
] as const;

const clean = (v: unknown) => String(v ?? '').replace(/[<>{};]/g, '').trim();

export function themeStyle(theme: ThemeColors, fontVars: string[] = []): string {
  const eyebrowAccent = theme.eyebrowColor === 'highlight' || theme.eyebrowColor === 'secondary' ? theme.eyebrowColor : 'brand';
  return [
    `--color-brand:${theme.brand}`,
    `--color-ink:${theme.ink}`,
    ...(theme.muted ? [`--color-muted:${theme.muted}`] : []),
    `--color-on-dark:${theme.onDark}`,
    `--color-surface:${theme.surface}`,
    `--color-paper:${theme.paper}`,
    `--color-line:${theme.line}`,
    `--color-highlight:${theme.highlight}`,
    ...(theme.secondary ? [`--color-secondary:${theme.secondary}`] : []),
    `--eyebrow-accent:var(--color-${eyebrowAccent})`,
    ...(theme.dark ? [`--color-dark:${theme.dark}`] : []),
    ...(theme.darkInk ? [`--color-dark-ink:${theme.darkInk}`] : []),
    ...(theme.darkLine ? [`--color-dark-line:${theme.darkLine}`] : []),
    ...fontVars,
  ].join(';');
}

// The day palette sits inline on <html>, so the night one needs !important to win over it while the visitor's system is dark.
export function nightStyle(theme: ThemeColors): string | null {
  if (theme.scheme !== 'auto') return null;
  const vars = NIGHT_COLORS.flatMap(([key, prop]) => (theme[key] && clean(theme[key]) ? [`${prop}:${clean(theme[key])} !important`] : []));
  return `:root{color-scheme:light dark}@media (prefers-color-scheme: dark){:root{${[...vars, 'color-scheme:dark'].join(';')}}}`;
}
