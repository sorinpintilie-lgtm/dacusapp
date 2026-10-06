import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Dacus design tokens.
 * Brand: the red and charcoal of the logo, with warm-neutral greys taken from the chimney.
 * One accent (brand red) for actions, prices on sale and selection; everything else is neutral.
 */
export const colors = {
  brand: '#D20A11',
  brandPressed: '#AE070D',
  brandTint: '#FDEDED',

  ink: '#161616',
  inkSoft: '#232323',
  charcoal: '#3A3A3A',

  canvas: '#FFFFFF',
  grouped: '#F4F3F1',
  surface: '#FFFFFF',
  well: '#F3F2F0',
  wellStrong: '#EAE8E5',

  textPrimary: '#161616',
  textSecondary: '#5E5C59',
  textTertiary: '#8F8C88',
  textInverse: '#FFFFFF',
  textInverseMuted: 'rgba(255, 255, 255, 0.72)',

  line: '#E8E6E3',
  lineStrong: '#D6D3CF',

  success: '#1D7A46',
  successTint: '#E6F3EB',
  warning: '#9A5A00',
  warningTint: '#FDF3E1',
  danger: '#D20A11',
  dangerTint: '#FDEDED',

  scrim: 'rgba(12, 11, 10, 0.48)',
  skeleton: '#EEECE9',
  skeletonShine: '#F7F6F4',
};

export const fonts = {
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
  extrabold: 'Barlow_800ExtraBold',
  extraboldItalic: 'Barlow_800ExtraBold_Italic',
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

/** Shape rule: surfaces, wells, buttons and inputs use `md`; chips, steppers and icon buttons are pills. */
export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

/** Font weights come from the font file, never from `fontWeight` (Android would fake them). */
export const textStyles = {
  display: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 34, letterSpacing: -0.4 },
  title1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 31, letterSpacing: -0.3 },
  title2: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 26, letterSpacing: -0.2 },
  title3: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 23, letterSpacing: -0.1 },
  headline: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  callout: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  subhead: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
  subheadMedium: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19 },
  footnote: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15, letterSpacing: 0.2 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textStyles;

/** Prices: bold figures with equal widths so totals don't jitter when they change. */
export const priceStyles = {
  sm: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
  md: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 23, fontVariant: ['tabular-nums'] },
  lg: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 34, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

// boxShadow renders on iOS, Android (New Architecture) and web alike. Shadows are warm-tinted and only
// used for things that float above content (bars, sheets, toasts, buttons over photos).
export const shadows = {
  float: { boxShadow: '0px 6px 20px rgba(28, 22, 16, 0.10)' },
  raised: { boxShadow: '0px 14px 36px rgba(28, 22, 16, 0.18)' },
  bar: { boxShadow: '0px -6px 18px rgba(28, 22, 16, 0.07)' },
  chip: { boxShadow: '0px 1px 2px rgba(28, 22, 16, 0.08)' },
} satisfies Record<string, ViewStyle>;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

/** iOS continuous (squircle) corners; ignored elsewhere. */
export const continuous = { borderCurve: 'continuous' } satisfies ViewStyle;
