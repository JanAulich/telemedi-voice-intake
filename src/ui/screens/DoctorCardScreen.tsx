import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Fact, IntakeRecord } from '../../contract/types';
import { DOCTOR, RED_FLAG_DOCTOR, type DoctorStrings } from '../i18n';
import { Body, Button, Card, Chip, DemoBadge, H1, H2, Page } from '../components/Primitives';
import { colors, font, radius, space, TAP } from '../theme';

function FactRow({ label, fact, extra, t }: { label: string; fact: Fact | null; extra?: string; t: DoctorStrings }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  if (!fact) {
    return (
      <View style={styles.factRow}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.empty}>—</Text>
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
      style={({ pressed }) => [styles.factRow, pressed && { backgroundColor: colors.bg }]}
    >
      <Text style={styles.factLabel}>{label}</Text>
      <View style={styles.factMain}>
        <Text style={styles.factValue}>
          {fact.value}
          {extra ? `  (${extra})` : ''}
        </Text>
        <Chip
          label={stated ? t.stated : t.inferred}
          bg={stated ? colors.statedBg : colors.inferredBg}
          fg={stated ? colors.statedInk : colors.inferredInk}
        />
      </View>
      {showQuote ? (
        <View style={styles.quote}>
          <Text style={styles.quoteLabel}>{t.patientSaid}</Text>
          <Text style={styles.quoteText}>“{fact.quote}”</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function FactList({ label, facts, t }: { label: string; facts: Fact[]; t: DoctorStrings }) {
  if (facts.length === 0) return <FactRow label={label} fact={null} t={t} />;
  return (
    <>
      {facts.map((f, i) => (
        <FactRow key={`${label}-${i}`} label={i === 0 ? label : ''} fact={f} t={t} />
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
  const t = DOCTOR[record.doctorLanguage];
  const flagNames = RED_FLAG_DOCTOR[record.doctorLanguage];
  const s = record.summary;
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

  return (
    <Page>
      <View style={{ gap: space.sm }}>
        {demo ? <DemoBadge /> : null}
        <H1>{t.cardTitle}</H1>
        <Body small muted>
          {t.disclaimer}
        </Body>
      </View>

      {record.redFlags.length > 0 ? (
        <View accessibilityRole="alert" style={styles.redBanner}>
          <Text style={styles.redTitle}>{t.redFlags}</Text>
          {record.redFlags.map((h, i) => (
            <Text key={`${h.id}-${i}`} style={styles.redItem}>
              {flagNames[h.id]} — “{h.matched}”
            </Text>
          ))}
        </View>
      ) : null}

      <Card>
        <H2>{t.opqrst}</H2>
        <FactRow label={t.chiefComplaint} fact={s.chiefComplaint} t={t} />
        <FactRow label={t.onset} fact={s.opqrst.onset} t={t} />
        <FactRow label={t.provocation} fact={s.opqrst.provocation} t={t} />
        <FactRow label={t.quality} fact={s.opqrst.quality} t={t} />
        <FactRow label={t.region} fact={s.opqrst.region} t={t} />
        <FactRow
          label={t.severity}
          fact={s.opqrst.severity}
          extra={s.opqrst.severity?.score != null ? `${s.opqrst.severity.score}/10` : undefined}
          t={t}
        />
        <FactRow label={t.time} fact={s.opqrst.time} t={t} />
      </Card>

      <Card>
        <H2>{t.sample}</H2>
        <FactList label={t.signsSymptoms} facts={s.signsSymptoms} t={t} />
        <FactList label={t.allergies} facts={s.allergies} t={t} />
        <FactList label={t.medications} facts={s.medications} t={t} />
        <FactList label={t.pastHistory} facts={s.pastHistory} t={t} />
        <FactRow label={t.lastIntake} fact={s.lastIntake} t={t} />
        <FactRow label={t.events} fact={s.events} t={t} />
      </Card>

      <Card>
        <H2>{t.missing}</H2>
        {s.missing.length === 0 ? (
          <Body small muted>
            {t.missingNone}
          </Body>
        ) : (
          <View style={styles.chips}>
            {s.missing.map((id) => (
              <Chip key={id} label={t.questionNames[id]} bg={colors.warnBg} fg={colors.warnInk} />
            ))}
          </View>
        )}
        <Body small muted>
          {t.dropped(s.droppedUnsupported)}
        </Body>
      </Card>

      <Collapsible openLabel={t.showFhir} closeLabel={t.hideFhir}>
        <Card>
          <H2>{t.fhir}</H2>
          <ScrollView horizontal style={styles.json} nestedScrollEnabled>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 360 }}>
              <Text selectable style={styles.jsonText}>
                {fhirJson}
              </Text>
            </ScrollView>
          </ScrollView>
          <Button label={copied ? t.copied : t.copy} variant="secondary" onPress={copy} />
        </Card>
      </Collapsible>

      <Button label={t.endWipe} variant="danger" onPress={onWipe} />
    </Page>
  );
}

const styles = StyleSheet.create({
  factRow: { gap: space.xs, paddingVertical: space.sm, minHeight: TAP, borderTopWidth: 1, borderTopColor: colors.bg },
  factLabel: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  factMain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  factValue: { fontSize: 17, lineHeight: 24, color: colors.ink, flexShrink: 1 },
  empty: { fontSize: 17, color: colors.muted },
  quote: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: space.md, gap: 2 },
  quoteLabel: { fontSize: 12, fontWeight: '700', color: colors.muted },
  quoteText: { fontSize: 15, lineHeight: 21, color: colors.ink, fontStyle: 'italic' },
  redBanner: { backgroundColor: colors.danger, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  redTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  redItem: { color: '#FFFFFF', fontSize: 16, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  json: { backgroundColor: '#0F1E26', borderRadius: radius.sm, padding: space.md },
  jsonText: { color: '#E6F1F5', fontFamily: font.mono, fontSize: 12, lineHeight: 17 },
});
