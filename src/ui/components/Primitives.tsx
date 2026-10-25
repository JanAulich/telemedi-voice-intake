import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, radius, space, TAP } from '../theme';

/** Scrolling page with a centred, phone-width column (works on wide web windows). */
export function Page({ children, background = colors.bg }: { children: ReactNode; background?: string }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: background }}
      contentContainerStyle={styles.pageContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.column}>{children}</View>
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children, color = colors.ink }: { children: ReactNode; color?: string }) {
  return (
    <Text accessibilityRole="header" style={[styles.h1, { color }]}>
      {children}
    </Text>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.h2}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, small }: { children: ReactNode; muted?: boolean; small?: boolean }) {
  return <Text style={[styles.body, muted && { color: colors.muted }, small && { fontSize: 14, lineHeight: 20 }]}>{children}</Text>;
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'light';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = variantStyles[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.85 },
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={[styles.buttonText, { color: v.fg }]}>{label}</Text>}
    </Pressable>
  );
}

const variantStyles: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.primaryDark, border: colors.primary },
  danger: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primaryDark, border: 'transparent' },
  light: { bg: '#FFFFFF', fg: colors.danger, border: '#FFFFFF' },
};

export function Chip({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Always visible when the app runs on the offline mock, so screenshots never mislead. */
export function DemoBadge() {
  return (
    <View accessibilityRole="alert" style={styles.demo}>
      <Text style={styles.demoText}>Demo mode — no AI</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  pageContent: { flexGrow: 1, alignItems: 'center', padding: space.lg, paddingBottom: space.xxl },
  column: { width: '100%', maxWidth: 640, gap: space.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.ink },
  body: { fontSize: 17, lineHeight: 24, color: colors.ink },
  button: {
    minHeight: TAP + 4,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  chipText: { fontSize: 13, fontWeight: '700' },
  demo: {
    alignSelf: 'flex-start',
    backgroundColor: colors.demoBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  demoText: { color: colors.demoInk, fontWeight: '800', fontSize: 14 },
  error: { color: colors.danger, fontSize: 15, lineHeight: 21, fontWeight: '600' },
});
