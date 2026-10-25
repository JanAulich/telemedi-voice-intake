/// <reference types="node" />
// Loads and types the scripted patient scenarios in eval/scenarios/*.json.
// Node-only (uses fs); imports only the shared contract, never expo modules.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DoctorLanguage, PatientLanguage, QuestionId, RedFlagId } from '../../src/contract/types';

export const QUESTION_IDS: QuestionId[] = [
  'chief_complaint',
  'onset',
  'severity',
  'associated_symptoms',
  'medications',
  'allergies',
  'past_history',
  'events',
];

export interface ScenarioExpected {
  /** Red flag the scenario must raise, or null when it must NOT escalate. */
  redFlag: RedFlagId | null;
  /** Question whose answer carries the red-flag statement. */
  redFlagQuestionId: QuestionId | null;
  /** Any-of keywords (lowercase, matched against fact value + quote) for the chief complaint. */
  chiefComplaint: string[];
  /** Any-of keywords for the OPQRST onset; null = onset is expected to be missing. */
  onset: string[] | null;
  /** Expected 0-10 score; null = patient gave no number. */
  severityScore: number | null;
  /** One entry per expected allergy; each entry is a list of any-of keywords. [] = none reported. */
  allergies: string[][];
  /** One entry per expected medication; each entry is a list of any-of keywords. [] = none reported. */
  medications: string[][];
  /** Exact set of topics expected in summary.missing. */
  missing: QuestionId[];
}

export interface Scenario {
  id: string;
  patientLanguage: PatientLanguage;
  doctorLanguage: DoctorLanguage;
  persona: string;
  tags: string[];
  answers: Record<QuestionId, string>;
  expected: ScenarioExpected;
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'scenarios');

export function loadScenarios(): Scenario[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Scenario);
}
