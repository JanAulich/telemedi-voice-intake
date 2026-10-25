import { describe, expect, it } from 'vitest';
import { quoteSupported, verifyQuotes } from '../verifyQuotes';
import type { Fact, IntakeSummary, Turn } from '../../../contract/types';

const turn = (id: string, questionId: Turn['questionId'], answerText: string): Turn => ({
  id,
  questionId,
  questionText: 'q',
  answerText,
  latencyMs: 1,
});

const fact = (value: string, quote: string, turnId: string, provenance: Fact['provenance'] = 'stated'): Fact => ({
  value,
  quote,
  turnId,
  provenance,
});

const emptySummary = (): IntakeSummary => ({
  doctorLanguage: 'en',
  chiefComplaint: null,
  opqrst: { onset: null, provocation: null, quality: null, region: null, severity: null, time: null },
  signsSymptoms: [],
  allergies: [],
  medications: [],
  pastHistory: [],
  lastIntake: null,
  events: null,
  missing: [],
  droppedUnsupported: 0,
});

describe('quoteSupported', () => {
  it('accepts a substring regardless of case and punctuation', () => {
    expect(quoteSupported('Boli mnie głowa', 'Od wczoraj, boli mnie głowa!')).toBe(true);
  });
  it('accepts a near-verbatim quote (>= 80% of tokens in order)', () => {
    expect(quoteSupported('od wczoraj bardzo boli mnie mocno głowa', 'Od wczoraj boli mnie mocno głowa')).toBe(true);
  });
  it('tolerates dropped Polish diacritics', () => {
    expect(quoteSupported('boli mnie glowa', 'Boli mnie głowa')).toBe(true);
  });
  it('rejects text that is not in the answer', () => {
    expect(quoteSupported('gorączka 39 stopni', 'Od wczoraj boli mnie głowa')).toBe(false);
  });
  it('rejects scattered tokens spread over a long answer', () => {
    const answer = 'boli ' + 'x '.repeat(30) + 'mnie ' + 'y '.repeat(30) + 'glowa ' + 'z '.repeat(30) + 'mocno';
    expect(quoteSupported('boli mnie glowa mocno', answer)).toBe(false);
  });
  it('rejects a quote that drops a preceding negation', () => {
    expect(quoteSupported('mam gorączkę', 'Nie mam gorączki, ale kaszlę')).toBe(false);
    expect(quoteSupported('mam gorączkę', 'nie mam gorączkę')).toBe(false);
    expect(quoteSupported('nie mam gorączki', 'Nie mam gorączki, ale kaszlę')).toBe(true);
  });
  it('does not match inside a longer word', () => {
    expect(quoteSupported('ból', 'wzbólenie')).toBe(false);
  });
});

describe('verifyQuotes', () => {
  const turns = [
    turn('t1', 'chief_complaint', 'Od wczoraj boli mnie głowa'),
    turn('t2', 'onset', 'Zaczęło się wczoraj wieczorem'),
    turn('t3', 'severity', 'Jakieś siedem na dziesięć, 7 z 10'),
    turn('t5', 'medications', 'Biorę ibuprofen'),
  ];

  it('keeps grounded facts, drops invented ones and counts them', () => {
    const s = emptySummary();
    s.chiefComplaint = fact('Headache', 'boli mnie głowa', 't1');
    s.signsSymptoms = [fact('Fever', 'mam gorączkę 39', 't1'), fact('Nausea', 'nudności', 't1')];
    s.medications = [fact('Ibuprofen', 'Biorę ibuprofen', 't5')];

    const v = verifyQuotes(s, turns);
    expect(v.chiefComplaint?.value).toBe('Headache');
    expect(v.signsSymptoms).toEqual([]);
    expect(v.medications).toHaveLength(1);
    expect(v.droppedUnsupported).toBe(2);
  });

  it('repairs a wrong turnId when the quote exists in another turn', () => {
    const s = emptySummary();
    s.medications = [fact('Ibuprofen', 'ibuprofen', 't1')];
    expect(verifyQuotes(s, turns).medications[0].turnId).toBe('t5');
  });

  it('drops facts with an empty quote or value', () => {
    const s = emptySummary();
    s.chiefComplaint = fact('Headache', '  ', 't1');
    const v = verifyQuotes(s, turns);
    expect(v.chiefComplaint).toBeNull();
    expect(v.droppedUnsupported).toBe(1);
  });

  it('validates the severity score against the quote', () => {
    const s = emptySummary();
    s.opqrst.severity = { ...fact('7/10', '7 z 10', 't3'), score: 8 };
    expect(verifyQuotes(s, turns).opqrst.severity?.score).toBeNull();
    s.opqrst.severity = { ...fact('7/10', '7 z 10', 't3'), score: 7 };
    expect(verifyQuotes(s, turns).opqrst.severity?.score).toBe(7);
  });

  it('fills missing topics', () => {
    const s = emptySummary();
    s.chiefComplaint = fact('Headache', 'boli mnie głowa', 't1');
    s.opqrst.onset = fact('Yesterday evening', 'wczoraj wieczorem', 't2');
    s.medications = [fact('Ibuprofen', 'ibuprofen', 't5')];
    const v = verifyQuotes(s, turns);
    expect(v.missing).toEqual(['severity', 'associated_symptoms', 'allergies', 'past_history', 'events']);
  });

  it('does not mutate its input', () => {
    const s = emptySummary();
    s.signsSymptoms = [fact('Fever', 'gorączka', 't1')];
    verifyQuotes(s, turns);
    expect(s.signsSymptoms).toHaveLength(1);
    expect(s.droppedUnsupported).toBe(0);
  });
});
