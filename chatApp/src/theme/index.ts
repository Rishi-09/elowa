import { palette, brand, type ThemeColors, type ThemeMode } from './colors';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  smallStrong: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },
  label: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
} as const;

/** Icon geometry — one stroke width and a fixed size ramp for the whole app. */
export const icon = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 36,
  stroke: 1.75,
} as const;

/** Animation durations in ms. Gated by the reduced-motion preference. */
export const motion = {
  instant: 80,
  fast: 140,
  base: 200,
  slow: 300,
} as const;

/** Minimum interactive sizes — Android/iOS accessibility guidance. */
export const touch = {
  min: 44,
  slop: 10,
} as const;

/** Responsive breakpoints (shortest-edge width in dp). */
export const breakpoints = {
  tablet: 600,
  desktop: 920,
} as const;

export type Elevation = 0 | 1 | 2 | 3;

const elevationFor = (shadow: string) =>
  ({
    0: {},
    1: {
      elevation: 1,
      shadowColor: shadow,
      shadowOpacity: 0.08,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
    },
    2: {
      elevation: 3,
      shadowColor: shadow,
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    3: {
      elevation: 8,
      shadowColor: shadow,
      shadowOpacity: 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
  }) as const;

export type Theme = {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  icon: typeof icon;
  motion: typeof motion;
  touch: typeof touch;
  breakpoints: typeof breakpoints;
  elevation: ReturnType<typeof elevationFor>;
};

export const buildTheme = (mode: ThemeMode): Theme => ({
  mode,
  colors: palette[mode],
  spacing,
  radius,
  typography,
  icon,
  motion,
  touch,
  breakpoints,
  elevation: elevationFor(palette[mode].shadow),
});

export { palette, brand };
export type { ThemeColors, ThemeMode };
