import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DoctorLanguage, PatientLanguage } from '../../contract/types';
import { LANGUAGE_NAMES } from '../i18n';
import { Body, Button, Card, DemoBadge, H1, H2, Notice, Page, focusStyle, useFocusRing } from '../components/Primitives';
import { radius, space, TAP, type, useTheme } from '../theme';
import type { Palette } from '../theme';

export interface SetupResult {
  patientLanguage: PatientLanguage;
  doctorLanguage: DoctorLanguage;
}

const PATIENT_OPTIONS: PatientLanguage[] = ['pl', 'en', 'uk'];
const DOCTOR_OPTIONS: { id: DoctorLanguage; label: string }[] = [
  { id: 'pl', label: 'Polski' },
  { id: 'en', label: 'English' },
];

/** One radio option. Selected = filled dot + tinted fill + accent border; unselected = hollow dot. */
function Option({
  label,
  selected,
  onPress,
  c,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  c: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { focused, handlers } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      {...handlers}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && { backgroundColor: c.accentTint },
        focused && focusStyle(c),
      ]}
    >
      <View style={[styles.radio, selected && { borderColor: c.accentInk }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: c.accentInk }]} /> : null}
      </View>
      <Text style={[styles.optionText, selected && { color: c.onAccentTint }]}>{label}</Text>
    </Pressable>
  );
}

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
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.segment}>
      {options.map((o) => (
        <Option key={o.id} label={o.label} selected={o.id === value} onPress={() => onChange(o.id)} c={c} styles={styles} />
      ))}
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
      {notice ? <Notice>{notice}</Notice> : null}
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
      <Body>Test data only. Nothing is saved after the session.</Body>
      <Body muted>
        This tool collects an intake summary for the doctor. It does not diagnose or give medical advice. In an
        emergency call 112.
      </Body>
      <Button label="Start interview" onPress={() => onStart({ patientLanguage, doctorLanguage })} />
      <Button label="Back" variant="ghost" onPress={onBack} />
    </Page>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    segment: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    option: {
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm,
      minHeight: TAP + 4,
      paddingHorizontal: space.lg,
      borderRadius: radius.md,
      borderCurve: 'continuous',
      borderWidth: 2,
      borderColor: c.fieldBorder,
      backgroundColor: c.surface,
    },
    optionSelected: { borderColor: c.accentInk, backgroundColor: c.accentTint },
    optionText: { ...type.bodyStrong, color: c.ink },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.fieldBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioDot: { width: 10, height: 10, borderRadius: 5 },
  });
}
