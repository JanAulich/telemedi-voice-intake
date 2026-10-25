// Offline stand-in for the real engine so the UI can be built and demoed
// without API keys. Same interface, canned behaviour, memory only.
import type {
  CreateIntakeEngine,
  Fact,
  IntakeRecord,
  Question,
  QuestionId,
  RedFlagHit,
  Turn,
  TurnResult,
} from './types';

const ORDER: QuestionId[] = [
  'chief_complaint',
  'onset',
  'severity',
  'associated_symptoms',
  'medications',
  'allergies',
  'past_history',
  'events',
];

const TEXT_EN: Record<QuestionId, string> = {
  chief_complaint: 'What is bothering you most today?',
  onset: 'When did it start, and has it changed since?',
  severity: 'On a scale from 0 to 10, how strong is it?',
  associated_symptoms: 'Do you have any other symptoms?',
  medications: 'Are you taking any medicines?',
  allergies: 'Are you allergic to any medicines or foods?',
  past_history: 'Do you have any long-term illnesses?',
  events: 'When did you last eat or drink, and what happened before this started?',
};

export const createMockEngine: CreateIntakeEngine = (config) => {
  let turns: Turn[] = [];
  let redFlags: RedFlagHit[] = [];
  let index = 0;

  const question = (i: number): Question => ({ id: ORDER[i], text: TEXT_EN[ORDER[i]] });

  const check = (text: string, turnId: string): RedFlagHit | null => {
    const m = /chest pain|ból w klatce|біль у грудях/i.exec(text);
    return m ? { id: 'chest_pain', matched: m[0], turnId } : null;
  };

  const answer = async (text: string): Promise<TurnResult> => {
    await new Promise((r) => setTimeout(r, 400));
    const q = question(index);
    const turn: Turn = { id: `t${index + 1}`, questionId: q.id, questionText: q.text, answerText: text, latencyMs: 400 };
    turns.push(turn);
    const redFlag = check(text, turn.id);
    if (redFlag) redFlags.push(redFlag);
    index += 1;
    return { turn, redFlag, next: index < ORDER.length ? question(index) : null };
  };

  const fact = (t: Turn): Fact => ({ value: t.answerText, provenance: 'stated', quote: t.answerText, turnId: t.id });
  const byId = (id: QuestionId) => turns.find((t) => t.questionId === id);

  return {
    start: () => question(0),
    submitAudio: () => answer('(mock transcript) I have had a headache since yesterday.'),
    submitText: answer,
    editTurn(turnId, text) {
      const t = turns.find((x) => x.id === turnId);
      if (!t) return null;
      t.answerText = text;
      redFlags = redFlags.filter((r) => r.turnId !== turnId);
      const hit = check(text, turnId);
      if (hit) redFlags.push(hit);
      return hit;
    },
    async finish(): Promise<IntakeRecord> {
      const f = (id: QuestionId) => (byId(id) ? fact(byId(id)!) : null);
      const sev = f('severity');
      return {
        patientLanguage: config.patientLanguage,
        doctorLanguage: config.doctorLanguage,
        turns: [...turns],
        redFlags: [...redFlags],
        summary: {
          doctorLanguage: config.doctorLanguage,
          chiefComplaint: f('chief_complaint'),
          opqrst: {
            onset: f('onset'),
            provocation: null,
            quality: null,
            region: null,
            severity: sev ? { ...sev, score: Number(sev.value.match(/\d+/)?.[0] ?? NaN) || null } : null,
            time: null,
          },
          signsSymptoms: f('associated_symptoms') ? [f('associated_symptoms')!] : [],
          allergies: f('allergies') ? [f('allergies')!] : [],
          medications: f('medications') ? [f('medications')!] : [],
          pastHistory: f('past_history') ? [f('past_history')!] : [],
          lastIntake: null,
          events: f('events'),
          missing: ORDER.filter((id) => !byId(id)),
          droppedUnsupported: 0,
        },
        fhir: { resourceType: 'Bundle', type: 'collection', timestamp: new Date().toISOString(), entry: [] },
      };
    },
    dispose() {
      turns = [];
      redFlags = [];
      index = 0;
    },
  };
};
