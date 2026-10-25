import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Fact, IntakeRecord } from '../../contract/types';
import { DOCTOR, RED_FLAG_DOCTOR, type DoctorStrings } from '../i18n';
import {
  Body,
  Button,
  Card,
  Chip,
  DemoBadge,
  H1,
  H2,
  Page,
  ProvenanceChip,
  focusStyle,
  useFocusRing,
} from '../components/Primitives';
import { fixed, font, radius, space, TAP, type, useTheme } from '../theme';
import type { Palette } from '../theme';

type Styles = ReturnType<typeof makeStyles>;

/**
 * One row of the ledger. The gutter holds the OPQRST / SAMPLE letter (decorative: the label already
 * says the same thing to a screen reader). Tap or hover reveals the patient's own words.
 */
function FactRow({
  label,
  letter,
  fact,
  extra,
  t,
  c,
  s,
}: {
  label: string;
  letter?: string;
  fact: Fact | null;
  extra?: string;
  t: DoctorStrings;
  c: Palette;
  s: Styles;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const { focused, handlers } = useFocusRing();

  const gutter = (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.gutter}>
      {letter ? <Text style={s.letter}>{letter}</Text> : null}
    </View>
  );

  if (!fact) {
    return (
      <View accessible accessibilityLabel={label ? `${label}: ${t.none}` : t.none} style={s.factRow}>
        {gutter}
        <View style={s.factBody}>
          {label ? <Text style={s.factLabel}>{label}</Text> : null}
          <Text style={s.empty}>—</Text>
        </View>
      </View>
    );
  }
  const stated = fact.provenance === 'stated';
  const showQuote = open || hover;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label}: ${fact.value}. ${stated ? t.stated : t.inferred}. ${t.tapForQuote}`}
      onPress={() => setOpen((o) => !o)}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      {...handlers}
      style={({ pressed }) => [s.factRow, (pressed || hover) && { backgroundColor: c.surfaceAlt }, focused && focusStyle(c)]}
    >
      {gutter}
      <View style={s.factBody}>
        {label ? <Text style={s.factLabel}>{label}</Text> : null}
        <View style={s.factMain}>
          <Text style={s.factValue}>
            {fact.value}
            {extra ? `  (${extra})` : ''}
          </Text>
          <ProvenanceChip label={stated ? t.stated : t.inferred} stated={stated} />
        </View>
        {showQuote ? (
          <View style={s.quote}>
            <Text style={s.quoteLabel}>{t.patientSaid}</Text>
            <Text style={s.quoteText}>“{fact.quote}”</Text>
          </View>
        ) : null}
      </View>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[s.chevron, showQuote && { transform: [{ rotate: '90deg' }] }]}
      >
        ›
      </Text>
    </Pressable>
  );
}

function FactList({
  label,
  letter,
  facts,
  t,
  c,
  s,
}: {
  label: string;
  letter: string;
  facts: Fact[];
  t: DoctorStrings;
  c: Palette;
  s: Styles;
}) {
  if (facts.length === 0) return <FactRow label={label} letter={letter} fact={null} t={t} c={c} s={s} />;
  return (
    <>
      {facts.map((f, i) => (
        <FactRow
          key={`${label}-${i}`}
          label={i === 0 ? label : ''}
          letter={i === 0 ? letter : undefined}
          fact={f}
          t={t}
          c={c}
          s={s}
        />
      ))}
    </>
  );
}

function Collapsible({
  openLabel,
  closeLabel,
  children,
}: {
  openLabel: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space.md }}>
      <Button label={open ? closeLabel : openLabel} variant="secondary" onPress={() => setOpen((o) => !o)} />
      {open ? children : null}
    </View>
  );
}

export function DoctorCardScreen({
  record,
  demo,
  onWipe,
}: {
  record: IntakeRecord;
  demo: boolean;
  onWipe: () => void;
}) {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = DOCTOR[record.doctorLanguage];
  const flagNames = RED_FLAG_DOCTOR[record.doctorLanguage];
  const sum = record.summary;
  const fhirJson = useMemo(() => JSON.stringify(record.fhir, null, 2), [record.fhir]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(fhirJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (e.g. insecure web origin); the JSON stays selectable.
    }
  };

  const row = (label: string, letter: string, fact: Fact | null, extra?: string) => (
    <FactRow label={label} letter={letter} fact={fact} extra={extra} t={t} c={c} s={s} />
  );

  return (
    <Page maxWidth={720}>
      <View style={{ gap: space.sm }}>
        {demo ? <DemoBadge /> : null}
        <H1>{t.cardTitle}</H1>
        <Body muted>{t.disclaimer}</Body>
        <Text style={s.hintRow}>
          {t.tapForQuote}
        </Text>
      </View>

      {record.redFlags.length > 0 ? (
        <View accessibilityRole="alert" style={s.redBanner}>
          <View style={s.redHead}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.redMark}>
              <Text style={s.redMarkText}>!</Text>
            </View>
            <Text style={s.redTitle}>{t.redFlags}</Text>
          </View>
          {record.redFlags.map((h, i) => (
            <Text key={`${h.id}-${i}`} style={s.redItem}>
              {flagNames[h.id]} — “{h.matched}”
            </Text>
          ))}
        </View>
      ) : null}

      <Card style={s.ledger}>
        <View style={s.ledgerHead}>
          <H2>{t.opqrst}</H2>
        </View>
        {row(t.chiefComplaint, 'CC', sum.chiefComplaint)}
        {row(t.onset, 'O', sum.opqrst.onset)}
        {row(t.provocation, 'P', sum.opqrst.provocation)}
        {row(t.quality, 'Q', sum.opqrst.quality)}
        {row(t.region, 'R', sum.opqrst.region)}
        {row(
          t.severity,
          'S',
          sum.opqrst.severity,
          sum.opqrst.severity?.score != null ? `${sum.opqrst.severity.score}/10` : undefined,
        )}
        {row(t.time, 'T', sum.opqrst.time)}
      </Card>

      <Card style={s.ledger}>
        <View style={s.ledgerHead}>
          <H2>{t.sample}</H2>
        </View>
        <FactList label={t.signsSymptoms} letter="S" facts={sum.signsSymptoms} t={t} c={c} s={s} />
        <FactList label={t.allergies} letter="A" facts={sum.allergies} t={t} c={c} s={s} />
        <FactList label={t.medications} letter="M" facts={sum.medications} t={t} c={c} s={s} />
        <FactList label={t.pastHistory} letter="P" facts={sum.pastHistory} t={t} c={c} s={s} />
        {row(t.lastIntake, 'L', sum.lastIntake)}
        {row(t.events, 'E', sum.events)}
      </Card>

      <Card>
        <H2>{t.missing}</H2>
        {sum.missing.length === 0 ? (
          <Body muted>{t.missingNone}</Body>
        ) : (
          <View style={s.chips}>
            {sum.missing.map((id) => (
              <Chip key={id} label={t.questionNames[id]} />
            ))}
          </View>
        )}
        <Body muted>{t.dropped(sum.droppedUnsupported)}</Body>
      </Card>

      <Collapsible openLabel={t.showFhir} closeLabel={t.hideFhir}>
        <Card>
          <H2>{t.fhir}</H2>
          <ScrollView horizontal style={s.json} nestedScrollEnabled>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 360 }}>
              <Text selectable style={s.jsonText}>
                {fhirJson}
              </Text>
            </ScrollView>
          </ScrollView>
          <Button label={copied ? t.copied : t.copy} variant="secondary" onPress={copy} />
        </Card>
      </Collapsible>

      <Button label={t.endWipe} variant="danger" onPress={onWipe} style={{ marginTop: space.sm }} />
    </Page>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    hintRow: { ...type.caption, color: c.muted },
    ledger: { gap: 0, paddingBottom: space.sm },
    ledgerHead: { paddingBottom: space.sm },
    factRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.md,
      paddingVertical: space.md,
      paddingHorizontal: space.sm,
      marginHorizontal: -space.sm,
      minHeight: TAP + space.md,
      borderTopWidth: 1,
      borderTopColor: c.hairline,
    },
    gutter: { width: 36, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
    letter: { fontSize: 13, lineHeight: 16, fontWeight: '800', color: c.accentInk, letterSpacing: 0.3 },
    factBody: { flex: 1, gap: space.xs },
    factLabel: { ...type.label, color: c.muted, textTransform: 'uppercase' },
    factMain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
    factValue: { ...type.bodyStrong, color: c.ink, flexShrink: 1 },
    empty: { ...type.body, color: c.muted },
    chevron: { fontSize: 24, lineHeight: 28, color: c.muted, width: 16, textAlign: 'center' },
    quote: {
      backgroundColor: c.surfaceAlt,
      borderLeftWidth: 3,
      borderLeftColor: c.accentInk,
      borderRadius: radius.sm,
      padding: space.md,
      gap: 2,
      marginTop: space.xs,
    },
    quoteLabel: { ...type.label, color: c.muted, textTransform: 'uppercase' },
    quoteText: { ...type.body, color: c.ink, fontStyle: 'italic' },
    redBanner: {
      backgroundColor: fixed.emergency,
      borderRadius: radius.lg,
      borderCurve: 'continuous',
      padding: space.lg,
      gap: space.sm,
    },
    redHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    redMark: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: fixed.onEmergency,
      alignItems: 'center',
      justifyContent: 'center',
    },
    redMarkText: { color: fixed.onEmergency, fontSize: 16, lineHeight: 18, fontWeight: '800' },
    redTitle: { color: fixed.onEmergency, fontSize: 18, lineHeight: 24, fontWeight: '700', flex: 1 },
    redItem: { color: fixed.onEmergency, ...type.body },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    json: { backgroundColor: c.codeBg, borderRadius: radius.sm, padding: space.md },
    jsonText: { color: c.codeInk, fontFamily: font.mono, fontSize: 13, lineHeight: 18 },
  });
}
