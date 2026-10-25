import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import type { PatientLanguage, RedFlagHit } from '../../contract/types';
import { PATIENT } from '../i18n';
import { Button, Page } from '../components/Primitives';
import { colors, radius, space } from '../theme';

/** Full-screen red emergency screen. Shown immediately when a red flag is detected. */
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
    <Page background={colors.danger}>
      <View accessibilityRole="alert" style={{ gap: space.md, paddingTop: space.xl }}>
        <Text accessibilityRole="header" style={styles.title}>
          {t.emergencyTitle}
        </Text>
        <Text style={styles.body}>{t.emergencyBody}</Text>
      </View>

      <Button label={t.call112} variant="light" onPress={call} style={styles.call} />

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
      <Button label={t.continueAnyway} variant="secondary" onPress={onContinue} />
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '900' },
  body: { color: '#FFFFFF', fontSize: 20, lineHeight: 28, fontWeight: '600' },
  call: { minHeight: 72 },
  detected: { backgroundColor: colors.dangerDark, borderRadius: radius.md, padding: space.lg, gap: space.md },
  detectedTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  flag: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  matched: { color: '#FFE3E6', fontSize: 16, fontStyle: 'italic' },
  hint: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
});
