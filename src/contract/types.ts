// Shared contract between UI, engine and eval. Owned by the coordinator.
// Workers must not edit this file; ask the coordinator for changes.

/** Languages the patient can speak. Doctor-facing output is 'pl' or 'en'. */
export type PatientLanguage = 'pl' | 'en' | 'uk';
export type DoctorLanguage = 'pl' | 'en';

/** Fixed interview topics, asked in this order. Based on SAMPLE + OPQRST. */
export type QuestionId =
  | 'chief_complaint' // S, and OPQRST region/quality
  | 'onset' // O, T
  | 'severity' // S of OPQRST, 0-10
  | 'associated_symptoms' // S of SAMPLE
  | 'medications' // M
  | 'allergies' // A
  | 'past_history' // P
  | 'events'; // L + E: last intake, what led up to it

export interface Question {
  id: QuestionId;
  /** Question text in the patient's language. */
  text: string;
}

/** Audio captured by the UI. `uri` is a file URI on native, a blob: URL on web. */
export interface AudioInput {
  uri: string;
  mimeType: string;
}

export interface Turn {
  id: string;
  questionId: QuestionId;
  questionText: string;
  /** What the patient said, in their language, as transcribed (or corrected by the patient). */
  answerText: string;
  /** Milliseconds from submitting the answer to the engine returning. */
  latencyMs: number;
}

export type RedFlagId =
  | 'chest_pain'
  | 'breathing_difficulty'
  | 'stroke_signs'
  | 'suicidal_ideation'
  | 'anaphylaxis'
  | 'severe_bleeding'
  | 'loss_of_consciousness';

export interface RedFlagHit {
  id: RedFlagId;
  /** Exact substring of the answer that matched. */
  matched: string;
  turnId: string;
}

/** 'stated' = the patient said it; 'inferred' = the model derived it. */
export type Provenance = 'stated' | 'inferred';

export interface Fact {
  /** Value in the doctor's language. */
  value: string;
  provenance: Provenance;
  /** Verbatim span from the transcript (patient's language) supporting the fact. */
  quote: string;
  turnId: string;
}

/** Doctor-facing clinical card: SAMPLE history with OPQRST for the chief complaint. */
export interface IntakeSummary {
  doctorLanguage: DoctorLanguage;
  chiefComplaint: Fact | null;
  opqrst: {
    onset: Fact | null;
    provocation: Fact | null;
    quality: Fact | null;
    region: Fact | null;
    /** 0-10 when the patient gave a number. */
    severity: (Fact & { score: number | null }) | null;
    time: Fact | null;
  };
  signsSymptoms: Fact[];
  allergies: Fact[];
  medications: Fact[];
  pastHistory: Fact[];
  lastIntake: Fact | null;
  events: Fact | null;
  /** Topics the patient did not answer or said they don't know. */
  missing: QuestionId[];
  /** Facts the model produced whose quote was not found in the transcript; removed from the card. */
  droppedUnsupported: number;
}

/** Minimal FHIR R4 Bundle shape (collection). Not a validated FHIR profile. */
export interface FhirBundle {
  resourceType: 'Bundle';
  type: 'collection';
  timestamp: string;
  entry: { fullUrl: string; resource: { resourceType: string; [k: string]: unknown } }[];
}

export interface IntakeRecord {
  patientLanguage: PatientLanguage;
  doctorLanguage: DoctorLanguage;
  turns: Turn[];
  redFlags: RedFlagHit[];
  summary: IntakeSummary;
  fhir: FhirBundle;
}

export type ProviderId = 'groq';

/** Result of submitting one answer. */
export interface TurnResult {
  turn: Turn;
  /** Set when an answer matched a red flag. The UI must show the escalation screen. */
  redFlag: RedFlagHit | null;
  /** Next question, or null when the interview is complete. */
  next: Question | null;
}

export interface IntakeEngineConfig {
  patientLanguage: PatientLanguage;
  doctorLanguage: DoctorLanguage;
  apiKeys: Partial<Record<ProviderId, string>>;
}

/**
 * One interview. Holds all patient data in memory only.
 * Never writes patient data to disk, storage or logs.
 */
export interface IntakeEngine {
  start(): Question;
  /** Transcribes the audio, deletes the audio file, runs red-flag checks, returns the next question. */
  submitAudio(audio: AudioInput): Promise<TurnResult>;
  /** Same as submitAudio but for typed text or an edited transcript (also used by eval). */
  submitText(text: string): Promise<TurnResult>;
  /** Replaces the answer text of an earlier turn (patient corrected the transcript). Re-runs red flags. */
  editTurn(turnId: string, text: string): RedFlagHit | null;
  /** Builds the summary and FHIR bundle. */
  finish(): Promise<IntakeRecord>;
  /** Clears all in-memory patient data. Safe to call more than once. */
  dispose(): void;
}

export type CreateIntakeEngine = (config: IntakeEngineConfig) => IntakeEngine;

/** API keys in the device keychain. Only persisted when the user opts in. */
export interface KeyStore {
  load(): Promise<Partial<Record<ProviderId, string>>>;
  save(keys: Partial<Record<ProviderId, string>>, remember: boolean): Promise<void>;
  clear(): Promise<void>;
}
