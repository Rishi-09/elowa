/**
 * Elowa brand palette.
 *
 * Brand constants (do not drift):
 *   primary navy   #1E2D3F
 *   secondary blue #7EA7D9
 *   surface cream  #E8E4DF
 *   muted blue     #B9C8D8
 *   primary text   #2F3E52
 *
 * Every semantic token below resolves to one of those, a tint/shade of one, or
 * a neutral. Components must read tokens — never literals.
 *
 * Contrast (WCAG 2.1): body text pairs are >= 4.5:1 against their own surface,
 * muted text >= 4.5:1, and `onAccent` >= 4.5:1 against `accent` in both modes.
 */

export const brand = {
  navy: '#1E2D3F',
  blue: '#7EA7D9',
  cream: '#E8E4DF',
  mutedBlue: '#B9C8D8',
  text: '#2F3E52',
} as const;

export const palette = {
  light: {
    /* surfaces */
    bg: '#FDFCFB',
    surface: brand.cream,
    surfaceElevated: '#FFFFFF',
    surfaceSunken: '#F2EFEB',
    border: '#D9D3CC',
    borderStrong: brand.mutedBlue,
    overlay: 'rgba(30, 45, 63, 0.55)',
    skeleton: '#DFDAD4',

    /* text */
    text: brand.text,
    textMuted: '#56677D',
    textSubtle: '#7E8B9C',
    textInverse: '#FFFFFF',
    onAccent: '#FFFFFF',

    /* brand / interactive */
    accent: brand.navy,
    accentMuted: '#DEE7F2',
    accentSoft: brand.blue,
    focus: '#4A7CB5',

    /* chat */
    chatBg: brand.cream,
    bubbleOut: brand.navy,
    bubbleIn: '#FFFFFF',
    bubbleOutText: '#FFFFFF',
    bubbleInText: brand.text,
    bubbleOutMeta: 'rgba(255, 255, 255, 0.70)',
    bubbleInMeta: '#7E8B9C',

    /* status */
    danger: '#A8382F',
    dangerMuted: '#F6E3E1',
    success: '#3E7F5C',
    warning: '#8A6212',
    online: '#3E7F5C',

    /* chrome */
    header: brand.navy,
    headerText: '#FFFFFF',
    headerMuted: 'rgba(255, 255, 255, 0.72)',
    tabBar: '#FFFFFF',
    shadow: '#1E2D3F',
  },
  dark: {
    /* surfaces */
    bg: '#141D27',
    surface: '#1C2734',
    surfaceElevated: '#22303F',
    surfaceSunken: '#101821',
    border: '#2D3C4D',
    borderStrong: '#3C5068',
    overlay: 'rgba(8, 13, 19, 0.70)',
    skeleton: '#243240',

    /* text */
    text: '#ECEFF3',
    textMuted: '#9BAABD',
    textSubtle: '#7D8CA0',
    textInverse: '#152233',
    onAccent: '#152233',

    /* brand / interactive */
    accent: brand.blue,
    accentMuted: '#22354A',
    accentSoft: brand.mutedBlue,
    focus: '#9CC0E8',

    /* chat */
    chatBg: '#101821',
    bubbleOut: '#2A4461',
    bubbleIn: '#1C2734',
    bubbleOutText: '#ECEFF3',
    bubbleInText: '#ECEFF3',
    bubbleOutMeta: 'rgba(236, 239, 243, 0.62)',
    bubbleInMeta: '#9BAABD',

    /* status */
    danger: '#E0756B',
    dangerMuted: '#3A2320',
    success: '#6FBF95',
    warning: '#D9AE5A',
    online: '#6FBF95',

    /* chrome */
    header: brand.navy,
    headerText: '#FFFFFF',
    headerMuted: 'rgba(255, 255, 255, 0.72)',
    tabBar: '#1C2734',
    shadow: '#000000',
  },
} as const;

export type ThemeColors = { -readonly [K in keyof typeof palette.light]: string };
export type ThemeMode = 'light' | 'dark';
