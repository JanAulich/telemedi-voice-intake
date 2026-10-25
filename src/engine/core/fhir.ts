// Deterministic FHIR R4 subset (Bundle type=collection) built from the verified summary.
// No terminology codes (no ICD/SNOMED): clinical content is free text in CodeableConcept.text.
// Not a validated profile. Contains no patient identifiers.

import type {
  DoctorLanguage,
  Fact,
  FhirBundle,
  IntakeSummary,
  PatientLanguage,
  RedFlagHit,
  Turn,
} from '../../contract/types';
import { isNoneReported } from './summarize';

type Resource = { resourceType: string; [k: string]: unknown };

export interface FhirInput {
  patientLanguage: PatientLanguage;
  doctorLanguage: DoctorLanguage;
  turns: Turn[];
  redFlags: RedFlagHit[];
  summary: IntakeSummary;
}

export interface FhirOptions {
  now?: Date;
  newId?: () => string;
}

const EXT_BASE = 'https://telemedi.example/fhir/StructureDefinition';

const LABEL: Record<DoctorLanguage, Record<string, string>> = {
  en: {
    onset: 'Onset', provocation: 'Provocation', quality: 'Quality', region: 'Region', time: 'Time course',
    severity: 'Patient-rated severity', redFlag: 'Red flag raised during intake',
  },
  pl: {
    onset: 'Początek', provocation: 'Czynniki nasilające/łagodzące', quality: 'Charakter', region: 'Lokalizacja',
    time: 'Przebieg w czasie', severity: 'Nasilenie wg pacjenta', redFlag: 'Sygnał alarmowy podczas wywiadu',
  },
};

function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Not security relevant: only needs to be unique inside one bundle.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function buildFhir(input: FhirInput, opts: FhirOptions = {}): FhirBundle {
  const now = (opts.now ?? new Date()).toISOString();
  const newId = opts.newId ?? uuid;
  const { summary: s, doctorLanguage: dl } = input;
  const L = LABEL[dl];

  const entries: FhirBundle['entry'] = [];
  const add = (resource: Resource): string => {
    const fullUrl = `urn:uuid:${newId()}`;
    entries.push({ fullUrl, resource });
    return fullUrl;
  };

  // Patient: anonymous, only the spoken language.
  const patientRef = add({
    resourceType: 'Patient',
    communication: [
      { language: { coding: [{ system: 'urn:ietf:bcp:47', code: input.patientLanguage }] }, preferred: true },
    ],
  });
  const subject = { reference: patientRef };

  // QuestionnaireResponse: the transcript as asked and answered.
  const qrRef = add({
    resourceType: 'QuestionnaireResponse',
    language: input.patientLanguage,
    status: 'completed',
    authored: now,
    subject,
    source: subject,
    item: input.turns.map((t) => ({
      linkId: t.questionId,
      text: t.questionText,
      answer: [{ valueString: t.answerText }],
    })),
  });

  const provenanceFor = (targetRef: string, fact: Fact) => {
    const stated = fact.provenance === 'stated';
    add({
      resourceType: 'Provenance',
      target: [{ reference: targetRef }],
      recorded: now,
      agent: [
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
                code: stated ? 'author' : 'assembler',
              },
            ],
          },
          who: stated ? subject : { display: 'Automated summariser (LLM), not a clinician' },
        },
      ],
      entity: [{ role: 'source', what: { reference: qrRef } }],
      extension: [
        { url: `${EXT_BASE}/fact-provenance`, valueCode: fact.provenance },
        { url: `${EXT_BASE}/source-quote`, valueString: fact.quote },
        { url: `${EXT_BASE}/source-item`, valueString: fact.turnId },
      ],
    });
  };

  const condition = (fact: Fact, extra: Record<string, unknown> = {}): string => {
    const ref = add({
      resourceType: 'Condition',
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
      },
      verificationStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'unconfirmed' }],
      },
      code: { text: fact.value },
      subject,
      recordedDate: now,
      ...extra,
    });
    provenanceFor(ref, fact);
    return ref;
  };

  // Condition: chief complaint with onset and severity (+ other OPQRST items as notes).
  if (s.chiefComplaint) {
    const notes: { text: string }[] = [];
    const o = s.opqrst;
    for (const [key, f] of [['provocation', o.provocation], ['quality', o.quality], ['time', o.time]] as const) {
      if (f) notes.push({ text: `${L[key]}: ${f.value}` });
    }
    condition(s.chiefComplaint, {
      category: [{ text: 'chief-complaint' }],
      ...(o.onset ? { onsetString: o.onset.value } : {}),
      ...(o.region ? { bodySite: [{ text: o.region.value }] } : {}),
      ...(o.severity
        ? { severity: { text: o.severity.score !== null ? `${o.severity.score}/10` : o.severity.value } }
        : {}),
      ...(notes.length ? { note: notes } : {}),
    });
  }
  // Other reported symptoms: unconfirmed Conditions.
  for (const f of s.signsSymptoms) {
    if (!isNoneReported(f.value)) condition(f, { category: [{ text: 'symptom' }] });
  }
  for (const f of s.pastHistory) {
    if (!isNoneReported(f.value)) condition(f, { category: [{ text: 'past-history' }] });
  }

  for (const f of s.allergies) {
    if (isNoneReported(f.value)) continue; // a denial is kept in the QuestionnaireResponse, not as an allergy
    const ref = add({
      resourceType: 'AllergyIntolerance',
      verificationStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'unconfirmed' }],
      },
      code: { text: f.value },
      patient: subject,
      recordedDate: now,
    });
    provenanceFor(ref, f);
  }

  for (const f of s.medications) {
    if (isNoneReported(f.value)) continue;
    const ref = add({
      resourceType: 'MedicationStatement',
      status: 'unknown',
      medicationCodeableConcept: { text: f.value },
      subject,
      dateAsserted: now,
      informationSource: subject,
    });
    provenanceFor(ref, f);
  }

  // Red flags raised by the deterministic rules (not by the model).
  for (const r of input.redFlags) {
    add({
      resourceType: 'Flag',
      status: 'active',
      code: { text: `${L.redFlag}: ${r.id}` },
      subject,
      period: { start: now },
    });
  }

  return { resourceType: 'Bundle', type: 'collection', timestamp: now, entry: entries };
}
