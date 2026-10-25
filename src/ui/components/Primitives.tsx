import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { fixed, radius, space, TAP, type, useTheme } from '../theme';
import type { Palette } from '../theme';

/**
 * Keyboard focus ring. On the web a ring that appears on every mouse click looks broken, so it is only
 * drawn after Tab was pressed. On native there is no mouse, so it is always allowed (external keyboard,
 * Switch Control).
 */
let keyboardNav = Platform.OS !== 'web';
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') keyboardNav = true;
  }, true);
  window.addEventListener('pointerdown', () => {
    keyboardNav = false;
  }, true);
}

/** Returns focus state plus the two handlers to spread on a Pressable or TextInput. */
export function useFocusRing() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    handlers: {
      onFocus: () => setFocused(keyboardNav),
      onBlur: () => setFocused(false),
    },
  };
}

export function focusStyle(c: Palette) {
  return { outlineWidth: 3, outlineStyle: 'solid', outlineColor: c.focus, outlineOffset: 2 } as const;
}

function useStyles() {
  const { c } = useTheme();
  return { c, s: useMemo(() => makeStyles(c), [c]) };
}

/** Scrolling page with a centred column (works on wide web windows). */
export function Page({
  children,
  background,
  maxWidth = 560,
}: {
  children: ReactNode;
  background?: string;
  maxWidth?: number;
}) {
  const { c, s } = useStyles();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: background ?? c.bg }}
      contentContainerStyle={s.pageContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[s.column, { maxWidth }]}>{children}</View>
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { s } = useStyles();
  return <View style={[s.card, style]}>{children}</View>;
}

export function H1({ children, color }: { children: ReactNode; color?: string }) {
  const { c, s } = useStyles();
  return (
    <Text accessibilityRole="header" style={[s.h1, { color: color ?? c.ink }]}>
      {children}
    </Text>
  );
}

export function H2({ children }: { children: ReactNode }) {
  const { s } = useStyles();
  return (
    <Text accessibilityRole="header" style={s.h2}>
      {children}
    </Text>
  );
}

/** `small` is a 15 pt caption: use it for metadata only. Everything a person has to read is 17 pt. */
export function Body({ children, muted, small }: { children: ReactNode; muted?: boolean; small?: boolean }) {
  const { c, s } = useStyles();
  return <Text style={[s.body, small && s.caption, muted && { color: c.muted }]}>{children}</Text>;
}

/** Amber note for provisional or contextual information (not an error). */
export function Notice({ children }: { children: ReactNode }) {
  const { s } = useStyles();
  return (
    <View style={s.notice}>
      <Text style={s.noticeText}>{children}</Text>
    </View>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'light' | 'outlineLight';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  large,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Bigger label and target, for the one action that must never be missed (call 112). */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, s } = useStyles();
  const { focused, handlers } = useFocusRing();
  const v = variantStyles(c)[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      {...handlers}
      style={({ pressed }) => [
        s.button,
        variant === 'ghost' && s.buttonGhost,
        { backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border },
        focused && focusStyle(variant === 'light' || variant === 'outlineLight' ? { ...c, focus: fixed.onEmergency } : c),
        large && s.buttonLarge,
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[s.buttonText, large && s.buttonTextLarge, { color: v.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

function variantStyles(c: Palette): Record<Variant, { bg: string; pressed: string; fg: string; border: string }> {
  return {
    primary: { bg: c.accent, pressed: c.accentPressed, fg: c.onAccent, border: 'transparent' },
    secondary: { bg: c.accentTint, pressed: c.surfaceAlt, fg: c.onAccentTint, border: c.accentInk },
    danger: { bg: c.dangerFill, pressed: c.dangerFillPressed, fg: c.onDangerFill, border: 'transparent' },
    ghost: { bg: 'transparent', pressed: c.accentTint, fg: c.accentInk, border: 'transparent' },
    light: { bg: fixed.onEmergency, pressed: fixed.onEmergencySoft, fg: fixed.emergency, border: 'transparent' },
    outlineLight: { bg: 'transparent', pressed: 'rgba(255,255,255,0.16)', fg: fixed.onEmergency, border: fixed.onEmergency },
  };
}

/**
 * Provenance chip. Said / inferred differ by text, by a filled vs hollow dot and by a solid vs dashed
 * outline, so colour is never the only signal.
 */
export function ProvenanceChip({ label, stated }: { label: string; stated: boolean }) {
  const { c, s } = useStyles();
  const fg = stated ? c.onAccentTint : c.amberInk;
  return (
    <View
      style={[
        s.chip,
        stated
          ? { backgroundColor: c.accentTint, borderColor: c.accentTint, borderStyle: 'solid' }
          : { backgroundColor: c.amberBg, borderColor: c.amberBorder, borderStyle: 'dashed' },
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[s.dot, { borderColor: fg }, stated && { backgroundColor: fg }]}
      />
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Neutral outlined chip (for "missing" items). */
export function Chip({ label }: { label: string }) {
  const { c, s } = useStyles();
  return (
    <View style={[s.chip, { backgroundColor: c.surface, borderColor: c.fieldBorder, borderStyle: 'solid' }]}>
      <Text style={[s.chipText, { color: c.ink }]}>{label}</Text>
    </View>
  );
}

/** Always visible when the app runs on the offline mock, so screenshots never mislead. */
export function DemoBadge() {
  const { s } = useStyles();
  return (
    <View accessibilityRole="alert" style={s.demo}>
      <Text style={s.demoText}>Demo mode — no AI</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const { c, s } = useStyles();
  return (
    <View accessibilityRole="alert" style={s.errorRow}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.errorMark, { borderColor: c.dangerText }]}>
        <Text style={[s.errorMarkText, { color: c.dangerText }]}>!</Text>
      </View>
      <Text style={s.errorText}>{children}</Text>
    </View>
  );
}

/** Text input with a visible boundary (3:1) and a focus state. */
export function Field({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const { c, s } = useStyles();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={c.muted}
      selectionColor={c.accent}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[s.field, focused && { borderColor: c.focus, ...focusStyle(c) }, style]}
    />
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    pageContent: { flexGrow: 1, alignItems: 'center', padding: space.lg, paddingBottom: space.xxl },
    column: { width: '100%', gap: space.lg },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.hairline,
      padding: space.lg,
      gap: space.md,
    },
    h1: { ...type.title },
    h2: { ...type.heading, color: c.ink },
    body: { ...type.body, color: c.ink },
    caption: { ...type.caption },
    notice: {
      backgroundColor: c.amberBg,
      borderColor: c.amberBorder,
      borderWidth: 1,
      borderRadius: radius.md,
      borderCurve: 'continuous',
      padding: space.md,
    },
    noticeText: { ...type.body, color: c.amberInk },
    button: {
      minHeight: TAP + 4,
      paddingHorizontal: space.xl,
      paddingVertical: space.sm,
      borderRadius: radius.md,
      borderCurve: 'continuous',
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonGhost: { minHeight: TAP, paddingHorizontal: space.md },
    buttonLarge: { minHeight: 72 },
    buttonText: { ...type.bodyStrong, textAlign: 'center' },
    buttonTextLarge: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      alignSelf: 'flex-start',
    },
    chipText: { ...type.chip },
    dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
    demo: {
      alignSelf: 'flex-start',
      backgroundColor: fixed.demoBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    demoText: { color: fixed.demoInk, fontWeight: '700', fontSize: 15, lineHeight: 20 },
    errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
    errorMark: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    errorMarkText: { fontSize: 14, lineHeight: 16, fontWeight: '800' },
    errorText: { ...type.bodyStrong, color: c.dangerText, flex: 1 },
    field: {
      minHeight: TAP + 4,
      borderWidth: 2,
      borderColor: c.fieldBorder,
      borderRadius: radius.md,
      borderCurve: 'continuous',
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      fontSize: type.body.fontSize,
      color: c.ink,
      backgroundColor: c.surface,
    },
  });
}
