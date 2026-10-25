import { Platform } from 'react-native';

export const colors = {
  bg: '#F3F7F8',
  surface: '#FFFFFF',
  ink: '#10222C',
  muted: '#475A66',
  border: '#C9D6DC',
  primary: '#0B6670',
  primaryDark: '#084B53',
  onPrimary: '#FFFFFF',
  danger: '#B00020',
  dangerDark: '#7F0017',
  warnBg: '#FFF4D6',
  warnInk: '#5C4300',
  statedBg: '#DFF3E4',
  statedInk: '#14532D',
  inferredBg: '#FFE9CC',
  inferredInk: '#7A3E00',
  demoBg: '#FFE082',
  demoInk: '#3E2A00',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 14, lg: 24, pill: 999 };

export const font = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, Consolas, monospace' }),
};

/** Minimum touch target (points). */
export const TAP = 48;
