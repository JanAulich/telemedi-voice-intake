import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import type { PatientLanguage, RedFlagHit } from '../../contract/types';
import { PATIENT } from '../i18n';
import { Button, Page } from '../components/Primitives';
import { fixed, radius, space } from '../theme';

/**
 * Full-screen red emergency screen. Shown immediately when a red flag is detected: no entrance
 * animation, no transition, and the same red and white in light and dark appearance.
 * Order: what is happening, the one action (call 112), what was detected, then the way on.
 */
export function EscalationScreen({
  lang,
  hits,
  onContinue,
}: {
  lang: PatientLanguage;
  hits: RedFlagHit[];
  onContinue: () => void;
}) {
  const t = PATIENT[lang];
  const call = () => {
    if (Platform.OS === 'web') window.location.href = 'tel:112';
    else Linking.openURL('tel:112').catch(() => {});
  };

  return (
    <Page background={fixed.emergency}>
      <View accessibilityRole="alert" style={{ gap: space.md, paddingTop: space.xl }}>
        <Text accessibilityRole="header" style={styles.title}>
          {t.emergencyTitle}
        </Text>
        <Text style={styles.body}>{t.emergencyBody}</Text>
      </View>

      <Button label={t.call112} variant="light" large onPress={call} />

      <View style={styles.detected}>
        <Text style={styles.detectedTitle}>{t.detected}</Text>
        {hits.map((h) => (
          <View key={`${h.id}-${h.turnId}-${h.matched}`} style={{ gap: 2 }}>
            <Text style={styles.flag}>{t.flags[h.id]}</Text>
            <Text style={styles.matched}>“{h.matched}”</Text>
          </View>
        ))}
      </View>

      <Text style={styles.hint}>{t.continueHint}</Text>
      <Button label={t.continueAnyway} variant="outlineLight" onPress={onContinue} />
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { color: fixed.onEmergency, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.3 },
  body: { color: fixed.onEmergency, fontSize: 20, lineHeight: 28, fontWeight: '500' },
  detected: { backgroundColor: fixed.emergencyDeep, borderRadius: radius.lg, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  detectedTitle: { color: fixed.onEmergency, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  flag: { color: fixed.onEmergency, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  matched: { color: fixed.onEmergencySoft, fontSize: 17, lineHeight: 24, fontStyle: 'italic' },
  hint: { color: fixed.onEmergency, fontSize: 17, lineHeight: 24 },
});
