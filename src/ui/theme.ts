import { Platform, useColorScheme } from 'react-native';

/**
 * Colour roles, each with a light and a dark value. Contrast figures for every pair that is actually
 * used are in docs/design-review.md. One colour, one meaning:
 *   accent  = the patient's next action (buttons, links, progress, the mic)
 *   amber   = provisional / not verified (demo mode, "inferred", notices)
 *   red     = emergency, and the irreversible wipe. Never decorative.
 */
export interface Palette {
  /** Page canvas. */
  bg: string;
  /** Cards, inputs. */
  surface: string;
  /** Quotes, tracks, secondary fills. */
  surfaceAlt: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  muted: string;
  /** Decorative separators (cards, rows). Not for controls. */
  hairline: string;
  /** Boundary of an interactive control (inputs, options): at least 3:1 against its surface. */
  fieldBorder: string;

  accent: string;
  accentPressed: string;
  onAccent: string;
  /** Accent used as text or border on surface / bg. */
  accentInk: string;
  accentTint: string;
  onAccentTint: string;
  /** Soft rings around the mic. */
  accentRing: string;

  /** Recording disc, so "recording" is never confused with the emergency red. */
  recordDisc: string;
  onRecordDisc: string;

  /** Error text and the wipe button. */
  dangerText: string;
  dangerFill: string;
  dangerFillPressed: string;
  onDangerFill: string;

  amberBg: string;
  amberInk: string;
  amberBorder: string;

  /** Code block for the FHIR JSON. */
  codeBg: string;
  codeInk: string;

  shadow: string;
  focus: string;
}

export const light: Palette = {
  bg: '#F4F7F7',
  surface: '#FFFFFF',
  surfaceAlt: '#E9F0F1',
  ink: '#0F2229',
  muted: '#4A5C66',
  hairline: '#DCE5E8',
  fieldBorder: '#6B7F89',

  accent: '#0B6670',
  accentPressed: '#084B53',
  onAccent: '#FFFFFF',
  accentInk: '#084B53',
  accentTint: '#DCEEF0',
  onAccentTint: '#084B53',
  accentRing: 'rgba(11,102,112,0.16)',

  recordDisc: '#0F2229',
  onRecordDisc: '#FFFFFF',

  dangerText: '#B00020',
  dangerFill: '#B00020',
  dangerFillPressed: '#7F0017',
  onDangerFill: '#FFFFFF',

  amberBg: '#FFF1CC',
  amberInk: '#5C4300',
  amberBorder: '#8A5A00',

  codeBg: '#0F1E26',
  codeInk: '#E6F1F5',

  shadow: '#0F2229',
  focus: '#0B6670',
};

export const dark: Palette = {
  bg: '#0B1519',
  surface: '#13232A',
  surfaceAlt: '#1B2F37',
  ink: '#E9F1F3',
  muted: '#A6B8BF',
  hairline: '#243A43',
  fieldBorder: '#7F97A0',

  accent: '#5CC8D2',
  accentPressed: '#3FB3BE',
  onAccent: '#04252A',
  accentInk: '#7FD6DE',
  accentTint: '#17383E',
  onAccentTint: '#BFEAEE',
  accentRing: 'rgba(92,200,210,0.18)',

  recordDisc: '#E9F1F3',
  onRecordDisc: '#0B1519',

  dangerText: '#FF9AA8',
  dangerFill: '#FF8F9C',
  dangerFillPressed: '#FF7586',
  onDangerFill: '#3A0009',

  amberBg: '#3A2D0A',
  amberInk: '#FFDE8A',
  amberBorder: '#C9A13A',

  codeBg: '#0A1217',
  codeInk: '#E6F1F5',

  shadow: '#000000',
  focus: '#7FD6DE',
};

/** Fixed colours that do not change with the appearance (they carry meaning on their own). */
export const fixed = {
  /** Emergency screen: same red, white text, in both appearances. */
  emergency: '#B00020',
  emergencyDeep: '#7F0017',
  onEmergency: '#FFFFFF',
  onEmergencySoft: '#FFE3E6',
  /** "Demo mode" badge: always visible amber, so screenshots never mislead. */
  demoBg: '#FFE082',
  demoInk: '#3E2A00',
};

export type Scheme = 'light' | 'dark';

/** Follows the system appearance. There is deliberately no in-app switch (HIG: Dark Mode). */
export function useTheme(): { c: Palette; scheme: Scheme } {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { c: scheme === 'dark' ? dark : light, scheme };
}

/** 4 pt grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

/**
 * Type scale. System typeface throughout (SF on Apple, Roboto on Android, the OS UI font on web):
 * it is the right call for a clinical tool and it follows the platform's text-size setting.
 * Reading text is 17 pt; only metadata (captions, chips, labels) is smaller.
 */
export const type = {
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.4 },
  question: { fontSize: 28, lineHeight: 36, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6 },
  chip: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
} as const;

export const font = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, Consolas, monospace' }),
};

/** Minimum touch target (points). Apple's default is 44; controls here are larger. */
export const TAP = 48;
