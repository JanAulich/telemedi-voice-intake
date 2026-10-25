import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { engineIsReal, keyStore } from '../engineSource';
import { Body, Button, Card, DemoBadge, H1, Page } from '../components/Primitives';
import { colors, radius, space, TAP } from '../theme';

export interface KeysResult {
  groqKey: string;
}

export function KeysScreen({ onContinue }: { onContinue: (r: KeysResult) => void }) {
  const [groqKey, setGroqKey] = useState('');
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
        <TextInput
          accessibilityLabel="Groq API key"
          accessibilityLabelledBy="groqLabel"
          style={styles.input}
          value={groqKey}
          onChangeText={setGroqKey}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          placeholder="gsk_…"
          placeholderTextColor={colors.muted}
        />
        <View style={styles.row}>
          <Switch
            accessibilityLabel="Remember keys on this device"
            value={remember}
            onValueChange={setRemember}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
          <Text style={[styles.body, { flex: 1 }]}>Remember keys on this device</Text>
        </View>
        <Text style={styles.small}>
          {Platform.OS === 'web'
            ? 'Your key stays in this browser tab and is sent only to api.groq.com. On the web it is never saved.'
            : 'Your key stays on this device. If you tick the box it is stored in the secure keychain; otherwise it lives in memory until you close the app. It is sent only to api.groq.com.'}
        </Text>
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
        <Text style={styles.small}>The real engine is not wired into this build yet, so the demo engine will run.</Text>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm, paddingTop: space.md },
  brand: { color: colors.primaryDark, fontWeight: '800', fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
  label: { fontSize: 16, fontWeight: '700', color: colors.ink },
  input: {
    minHeight: TAP + 4,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: '#FFFFFF',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TAP },
  body: { fontSize: 17, color: colors.ink },
  small: { fontSize: 14, lineHeight: 20, color: colors.muted },
  link: { fontSize: 16, color: colors.primaryDark, textDecorationLine: 'underline', paddingVertical: space.sm },
});
