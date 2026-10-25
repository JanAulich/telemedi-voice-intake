import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DoctorLanguage, PatientLanguage } from '../../contract/types';
import { LANGUAGE_NAMES } from '../i18n';
import { Body, Button, Card, DemoBadge, H1, H2, Page } from '../components/Primitives';
import { colors, radius, space, TAP } from '../theme';

export interface SetupResult {
  patientLanguage: PatientLanguage;
  doctorLanguage: DoctorLanguage;
}

const PATIENT_OPTIONS: PatientLanguage[] = ['pl', 'en', 'uk'];
const DOCTOR_OPTIONS: { id: DoctorLanguage; label: string }[] = [
  { id: 'pl', label: 'Polski' },
  { id: 'en', label: 'English' },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.segment}>
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.id)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SetupScreen({
  demo,
  notice,
  initial,
  onStart,
  onBack,
}: {
  demo: boolean;
  notice?: string | null;
  initial: SetupResult;
  onStart: (r: SetupResult) => void;
  onBack: () => void;
}) {
  const [patientLanguage, setPatientLanguage] = useState<PatientLanguage>(initial.patientLanguage);
  const [doctorLanguage, setDoctorLanguage] = useState<DoctorLanguage>(initial.doctorLanguage);

  return (
    <Page>
      {demo ? <DemoBadge /> : null}
      {notice ? (
        <View style={styles.consent}>
          <Body small>{notice}</Body>
        </View>
      ) : null}
      <H1>Choose languages</H1>
      <Card>
        <H2>Patient speaks</H2>
        <Segmented
          label="Patient language"
          options={PATIENT_OPTIONS.map((id) => ({ id, label: LANGUAGE_NAMES[id] }))}
          value={patientLanguage}
          onChange={setPatientLanguage}
        />
        <H2>Doctor summary in</H2>
        <Segmented label="Doctor summary language" options={DOCTOR_OPTIONS} value={doctorLanguage} onChange={setDoctorLanguage} />
      </Card>
      <View style={styles.consent}>
        <Body small>Test data only. Nothing is saved after the session.</Body>
      </View>
      <Body small muted>
        This tool collects an intake summary for the doctor. It does not diagnose or give medical advice. In an
        emergency call 112.
      </Body>
      <Button label="Start interview" onPress={() => onStart({ patientLanguage, doctorLanguage })} />
      <Button label="Back" variant="ghost" onPress={onBack} />
    </Page>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    flexGrow: 1,
    minHeight: TAP + 4,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { fontSize: 17, fontWeight: '700', color: colors.ink },
  optionTextSelected: { color: colors.onPrimary },
  consent: {
    backgroundColor: colors.warnBg,
    borderRadius: radius.md,
    padding: space.md,
  },
});
