import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { engineIsReal, keyStore } from '../engineSource';
import { Body, Button, Card, DemoBadge, Field, H1, Page } from '../components/Primitives';
import { space, TAP, type, useTheme } from '../theme';
import type { Palette } from '../theme';

export interface KeysResult {
  groqKey: string;
}

// Optional local test key from .env.local (git-ignored). Expo inlines EXPO_PUBLIC_* at build time,
// so never set it for a build you publish.
const LOCAL_TEST_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';

export function KeysScreen({ onContinue }: { onContinue: (r: KeysResult) => void }) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [groqKey, setGroqKey] = useState(LOCAL_TEST_KEY);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);

  // Pre-fill a previously remembered key (native keychain only; never on web).
  useEffect(() => {
    let alive = true;
    keyStore
      .load()
      .then((k) => {
        if (alive && k.groq) {
          setGroqKey(k.groq);
          setRemember(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const proceed = async (useKey: boolean) => {
    setBusy(true);
    const key = useKey ? groqKey.trim() : '';
    try {
      if (key) await keyStore.save({ groq: key }, remember);
      else await keyStore.clear();
    } catch {
      // Key persistence is best effort; the session still works with the in-memory key.
    }
    setBusy(false);
    onContinue({ groqKey: key });
  };

  const hasKey = groqKey.trim().length > 0;

  return (
    <Page>
      <View style={styles.header}>
        <Text style={styles.brand}>Voice pre-consultation intake</Text>
        {!hasKey || !engineIsReal ? <DemoBadge /> : null}
      </View>
      <H1>Connect your Groq key</H1>
      <Body muted>
        Speech-to-text and the doctor summary use Groq. Paste your own API key to run the real AI pipeline, or continue
        without a key to try the screens with canned answers.
      </Body>
      <Card>
        <Text style={styles.label} nativeID="groqLabel">
          Groq API key
        </Text>
        <Field
          accessibilityLabel="Groq API key"
          accessibilityLabelledBy="groqLabel"
          value={groqKey}
          onChangeText={setGroqKey}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          placeholder="gsk_…"
        />
        <View style={styles.row}>
          {/* Tapping the words toggles too (bigger target); the Switch carries the accessible name. */}
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.rowLabel}
            onPress={() => setRemember((v) => !v)}
          >
            Remember keys on this device
          </Text>
          <Switch
            accessibilityLabel="Remember keys on this device"
            value={remember}
            onValueChange={setRemember}
            trackColor={{ true: c.accent, false: c.fieldBorder }}
            thumbColor="#FFFFFF"
          />
        </View>
        <Body muted>
          {Platform.OS === 'web'
            ? 'Your key stays in this browser tab and is sent only to api.groq.com. On the web it is never saved.'
            : 'Your key stays on this device. If you tick the box it is stored in the secure keychain; otherwise it lives in memory until you close the app. It is sent only to api.groq.com.'}
        </Body>
        <Text
          accessibilityRole="link"
          style={styles.link}
          onPress={() => Linking.openURL('https://console.groq.com/keys').catch(() => {})}
        >
          Get a free Groq key
        </Text>
      </Card>
      <Button label="Continue" onPress={() => proceed(true)} disabled={!hasKey} loading={busy} />
      <Button label="Continue without a key (demo mode)" variant="secondary" onPress={() => proceed(false)} disabled={busy} />
      {!engineIsReal && hasKey ? (
        <Body muted>The real engine is not wired into this build yet, so the demo engine will run.</Body>
      ) : null}
    </Page>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    header: { gap: space.sm, paddingTop: space.md },
    brand: { ...type.label, color: c.accentInk, textTransform: 'uppercase' },
    label: { ...type.bodyStrong, color: c.ink },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: TAP + 4 },
    rowLabel: { ...type.body, color: c.ink, flex: 1 },
    link: {
      ...type.body,
      color: c.accentInk,
      textDecorationLine: 'underline',
      paddingVertical: space.md,
      minHeight: TAP,
    },
  });
}
