import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AccessibilityState } from 'react-native';
import { focusStyle, useFocusRing } from './Primitives';
import { font, useTheme } from '../theme';
import type { Palette } from '../theme';

export type MicPhase = 'idle' | 'preparing' | 'recording' | 'processing';

const STAGE = 232;
const DISC = 136;
const RING_1 = 176;
const RING_2 = 216;

/** Follows the system "Reduce Motion" setting, live. */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduce(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/**
 * The product's signature control: a disc inside two listening rings.
 * Each phase differs by glyph first (mic / spinner / stop square), by label second (rendered by the
 * caller) and by colour last. Only the "recording" phase animates, and not under Reduce Motion.
 *
 * The caller owns the behaviour: it passes the exact onPress, disabled and accessibility values.
 */
export function MicButton({
  phase,
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityState,
}: {
  phase: MicPhase;
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
  accessibilityState: AccessibilityState;
}) {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { focused, handlers } = useFocusRing();
  const reduceMotion = useReduceMotion();
  const recording = phase === 'recording';

  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;

  // The ripple loop runs only while recording and is stopped on every phase change and on unmount.
  useEffect(() => {
    if (!recording || reduceMotion) {
      ripple1.setValue(0);
      ripple2.setValue(0);
      return;
    }
    const native = Platform.OS !== 'web';
    const loop = (v: Animated.Value) =>
      Animated.loop(
        Animated.timing(v, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      );
    const a1 = loop(ripple1);
    const a2 = Animated.sequence([Animated.delay(1000), loop(ripple2)]);
    a1.start();
    a2.start();
    return () => {
      a1.stop();
      a2.stop();
      ripple1.setValue(0);
      ripple2.setValue(0);
    };
  }, [recording, reduceMotion, ripple1, ripple2]);

  const rippleStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
  });

  const busy = phase === 'preparing' || phase === 'processing';
  const discBg = recording ? c.recordDisc : phase === 'processing' ? c.muted : c.accent;
  const glyph = recording ? c.onRecordDisc : phase === 'processing' ? c.bg : c.onAccent;

  return (
    <View style={s.stage}>
      {/* Static listening rings. Stronger while recording so the state also reads without motion. */}
      <View pointerEvents="none" style={[s.ring, { width: RING_2, height: RING_2, borderRadius: RING_2 / 2, opacity: recording ? 1 : 0.55 }]} />
      <View pointerEvents="none" style={[s.ring, { width: RING_1, height: RING_1, borderRadius: RING_1 / 2, opacity: recording ? 1 : 0.8 }]} />
      {recording && !reduceMotion ? (
        <>
          <Animated.View pointerEvents="none" style={[s.ripple, rippleStyle(ripple1)]} />
          <Animated.View pointerEvents="none" style={[s.ripple, rippleStyle(ripple2)]} />
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        disabled={disabled}
        onPress={onPress}
        {...handlers}
        style={({ pressed }) => [
          s.disc,
          { backgroundColor: pressed && !busy ? (recording ? c.ink : c.accentPressed) : discBg },
          phase === 'preparing' && { opacity: 0.75 },
          focused && focusStyle(c),
        ]}
      >
        {busy ? (
          <ActivityIndicator color={glyph} size="large" />
        ) : recording ? (
          <View style={[s.stop, { backgroundColor: glyph }]} />
        ) : (
          <MicGlyph color={glyph} />
        )}
      </Pressable>
    </View>
  );
}

/** Elapsed time against the engine's 60 s limit, so a long answer is never a surprise. Decorative for screen readers. */
export function RecordingTimer({ active, maxSeconds }: { active: boolean; maxSeconds: number }) {
  const { c } = useTheme();
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!active) {
      setSec(0);
      return;
    }
    const t0 = Date.now();
    setSec(0);
    const id = setInterval(() => setSec(Math.min(maxSeconds, Math.floor((Date.now() - t0) / 1000))), 250);
    return () => clearInterval(id);
  }, [active, maxSeconds]);
  if (!active) return null;
  const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ fontFamily: font.mono, fontSize: 17, lineHeight: 24, color: c.muted, fontVariant: ['tabular-nums'] }}
    >
      {fmt(sec)} / {fmt(maxSeconds)}
    </Text>
  );
}

/** Simple microphone drawn with views so no icon package is needed. */
function MicGlyph({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 28, height: 48, borderRadius: 14, backgroundColor: color }} />
      <View
        style={{
          width: 48,
          height: 24,
          marginTop: -14,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          borderWidth: 4,
          borderTopWidth: 0,
          borderColor: color,
        }}
      />
      <View style={{ width: 4, height: 10, backgroundColor: color }} />
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    stage: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
    ring: { position: 'absolute', backgroundColor: c.accentRing },
    ripple: {
      position: 'absolute',
      width: DISC,
      height: DISC,
      borderRadius: DISC / 2,
      borderWidth: 2,
      borderColor: c.accent,
    },
    disc: {
      width: DISC,
      height: DISC,
      borderRadius: DISC / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stop: { width: 40, height: 40, borderRadius: 8 },
  });
}
