// Apex Training — design tokens
// Mirror of workout-screen.jsx (T_LIGHT / T_DARK) for runtime usage in JSX
// where Tailwind classes aren't enough (inline SVGs, dynamic styles).

export type ThemeName = 'light' | 'dark';

export const T_LIGHT = {
  bg: '#fafaf9',
  surface: '#ffffff',
  surfaceMuted: '#f5f5f4',
  border: 'rgba(15,15,12,0.08)',
  borderStrong: 'rgba(15,15,12,0.14)',
  ink: '#0c0a09',
  inkMuted: '#57534e',
  inkSubtle: '#a8a29e',
  accent: '#0c0a09',
  accentInk: '#fafaf9',
  success: '#15803d',
  successBg: '#dcfce7',
  successInk: '#14532d',
  warn: '#b45309',
  warnBg: '#fef3c7',
  pr: '#a16207',
  prBg: '#fef9c3',
  danger: '#b91c1c',
  dangerBg: '#fee2e2',
  videoBg: '#e7e5e4',
  videoStripe: '#d6d3d1',
  cardShadow: '0 1px 0 rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
  monoFont: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',
  font: '-apple-system, "Inter", system-ui, sans-serif',
  radius: 16,
  radiusSm: 10,
  radiusLg: 22,
} as const;

export const T_DARK = {
  bg: '#0a0a0b',
  surface: '#141416',
  surfaceMuted: '#1c1c1f',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  ink: '#fafaf9',
  inkMuted: 'rgba(250,250,249,0.66)',
  inkSubtle: 'rgba(250,250,249,0.38)',
  accent: '#ff6b1a',
  accentInk: '#0a0a0b',
  success: '#a3e635',
  successBg: 'rgba(163,230,53,0.14)',
  successInk: '#bef264',
  warn: '#fbbf24',
  warnBg: 'rgba(251,191,36,0.14)',
  pr: '#ff6b1a',
  prBg: 'rgba(255,107,26,0.14)',
  danger: '#f87171',
  dangerBg: 'rgba(248,113,113,0.14)',
  videoBg: '#1c1c1f',
  videoStripe: '#26262a',
  cardShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
  monoFont: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',
  font: '-apple-system, "Inter", system-ui, sans-serif',
  radius: 16,
  radiusSm: 10,
  radiusLg: 22,
} as const;

// Alarga literais do `as const` (ex.: "#fafaf9" → string) e remove readonly.
// Sem isto, T_DARK não é atribuível a typeof T_LIGHT, e o spread com
// accentOverride (`string`) quebra contra os literais.
type WidenLiterals<T> = {
  -readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends number
      ? number
      : T[K];
};

export type ThemeTokens = WidenLiterals<typeof T_LIGHT>;

export function getTheme(name: ThemeName, accentOverride?: string): ThemeTokens {
  const base: ThemeTokens = name === 'dark' ? T_DARK : T_LIGHT;
  if (!accentOverride) return base;
  return {
    ...base,
    accent: accentOverride,
    pr: name === 'dark' ? accentOverride : base.pr,
  };
}

export const DENSITY = {
  compact:     { pad: 12, gap: 10, rowH: 40, headerPb: 12 },
  regular:     { pad: 16, gap: 14, rowH: 46, headerPb: 16 },
  comfortable: { pad: 20, gap: 18, rowH: 52, headerPb: 20 },
} as const;

export type DensityName = keyof typeof DENSITY;
