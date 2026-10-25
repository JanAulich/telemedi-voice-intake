// Offline red-flag eval: deterministic rules only, no network, no API key.
// PRD metric: red-flag recall 100% on scripted urgent cases; negations must not fire.
import { describe, expect, it } from 'vitest';
import { checkRedFlags } from '../src/engine/core';
import type { RedFlagId } from '../src/contract/types';
import { loadScenarios, QUESTION_IDS } from './lib/scenarios';

const scenarios = loadScenarios();

describe('scenario set shape', () => {
  it('has 10 scenarios with all 8 answers', () => {
    expect(scenarios).toHaveLength(10);
    for (const s of scenarios) {
      expect(Object.keys(s.answers).sort(), s.id).toEqual([...QUESTION_IDS].sort());
      for (const q of QUESTION_IDS) expect(s.answers[q].length, `${s.id}.${q}`).toBeGreaterThan(0);
    }
  });

  it('covers the required language and case mix', () => {
    const count = (l: string) => scenarios.filter((s) => s.patientLanguage === l).length;
    expect(count('pl')).toBeGreaterThanOrEqual(4);
    expect(count('uk')).toBeGreaterThanOrEqual(3);
    expect(count('en')).toBeGreaterThanOrEqual(3);
    expect(scenarios.filter((s) => s.expected.redFlag !== null)).toHaveLength(3);
    expect(scenarios.filter((s) => s.tags.includes('negation')).length).toBeGreaterThanOrEqual(2);
    expect(scenarios.filter((s) => s.tags.includes('dont_know')).length).toBeGreaterThanOrEqual(1);
    expect(scenarios.some((s) => s.expected.allergies.length > 0 && s.expected.medications.length > 1)).toBe(true);
  });
});

describe('red-flag recall on urgent scenarios', () => {
  for (const s of scenarios.filter((x) => x.expected.redFlag !== null)) {
    it(`${s.id}: raises ${s.expected.redFlag} on ${s.expected.redFlagQuestionId}`, () => {
      const q = s.expected.redFlagQuestionId!;
      const text = s.answers[q];
      const hit = checkRedFlags(text, `${s.id}:${q}`);
      expect(hit, `no hit for: ${text}`).not.toBeNull();
      expect(hit!.id).toBe(s.expected.redFlag);
      expect(hit!.turnId).toBe(`${s.id}:${q}`);
      // Contract: `matched` is an exact substring of the answer.
      expect(text).toContain(hit!.matched);
    });
  }
});

describe('no false positives on non-urgent scenarios (every answer)', () => {
  for (const s of scenarios.filter((x) => x.expected.redFlag === null)) {
    const kind = s.tags.includes('negation') ? 'negation' : 'routine';
    for (const q of QUESTION_IDS) {
      it(`${s.id} [${kind}] ${q}`, () => {
        const hit = checkRedFlags(s.answers[q], `${s.id}:${q}`);
        expect(hit, hit ? `fired ${hit.id} on "${hit.matched}"` : '').toBeNull();
      });
    }
  }
});

interface Utterance {
  lang: 'pl' | 'en' | 'uk';
  text: string;
  expected: RedFlagId | null;
}

const utterances: Utterance[] = [
  // --- positives: Polish ---
  { lang: 'pl', text: 'Mam silny ból w klatce piersiowej, który promieniuje do ręki.', expected: 'chest_pain' },
  { lang: 'pl', text: 'Nie mogę oddychać, duszę się.', expected: 'breathing_difficulty' },
  { lang: 'pl', text: 'Mój mąż przed chwilą stracił przytomność.', expected: 'loss_of_consciousness' },
  { lang: 'pl', text: 'Nie chcę już żyć, chcę się zabić.', expected: 'suicidal_ideation' },
  { lang: 'pl', text: 'Krwawię bardzo mocno i nie mogę zatrzymać krwotoku.', expected: 'severe_bleeding' },
  { lang: 'pl', text: 'Po ugryzieniu osy puchnie mi język i gardło, trudno mi przełykać.', expected: 'anaphylaxis' },
  { lang: 'pl', text: 'Opadł mi kącik ust i mam bełkotliwą mowę, nie czuję lewej ręki.', expected: 'stroke_signs' },
  // --- positives: English ---
  { lang: 'en', text: "I think I'm having a heart attack, there is crushing pain in my chest.", expected: 'chest_pain' },
  { lang: 'en', text: "I can't breathe properly and my lips are turning blue.", expected: 'breathing_difficulty' },
  { lang: 'en', text: 'My face is drooping on one side and my speech is slurred.', expected: 'stroke_signs' },
  { lang: 'en', text: 'I want to kill myself.', expected: 'suicidal_ideation' },
  { lang: 'en', text: 'My throat is closing up after I ate peanuts and my face is swelling.', expected: 'anaphylaxis' },
  { lang: 'en', text: "I'm bleeding heavily and it won't stop.", expected: 'severe_bleeding' },
  { lang: 'en', text: 'I fainted a few minutes ago and I am still dizzy.', expected: 'loss_of_consciousness' },
  // --- positives: Ukrainian ---
  { lang: 'uk', text: 'Сильно болить у грудях, віддає в ліву руку.', expected: 'chest_pain' },
  { lang: 'uk', text: 'Не можу дихати, задихаюсь.', expected: 'breathing_difficulty' },
  { lang: 'uk', text: 'Раптово оніміла половина обличчя, і я не можу говорити.', expected: 'stroke_signs' },
  { lang: 'uk', text: 'Я хочу покінчити з життям.', expected: 'suicidal_ideation' },
  { lang: 'uk', text: 'Втратив свідомість на кілька хвилин.', expected: 'loss_of_consciousness' },
  { lang: 'uk', text: 'Кров ллється, не можу зупинити кровотечу.', expected: 'severe_bleeding' },
  // --- negations and neutral: must NOT fire ---
  { lang: 'pl', text: 'Nie mam bólu w klatce piersiowej.', expected: null },
  { lang: 'pl', text: 'Nie mam duszności i nie zemdlałem.', expected: null },
  { lang: 'pl', text: 'Nigdy nie myślałem o samobójstwie, to nie ten przypadek.', expected: null },
  { lang: 'pl', text: 'Boli mnie ząb od trzech dni.', expected: null },
  { lang: 'en', text: 'I have no chest pain and no trouble breathing.', expected: null },
  { lang: 'en', text: "I haven't fainted and I'm not bleeding.", expected: null },
  { lang: 'en', text: 'No thoughts of suicide or self harm, I feel fine.', expected: null },
  { lang: 'en', text: 'I have a mild headache since this morning.', expected: null },
  { lang: 'uk', text: 'Болю в грудях немає.', expected: null },
  { lang: 'uk', text: 'Задишки немає, свідомість не втрачав.', expected: null },
  { lang: 'uk', text: 'Думок про самогубство в мене немає.', expected: null },
  { lang: 'uk', text: 'У мене болить зуб.', expected: null },
];

describe('single-utterance red flags and negations (pl / en / uk)', () => {
  for (const u of utterances) {
    const label = u.expected ? `[${u.lang}] fires ${u.expected}: ${u.text}` : `[${u.lang}] no hit: ${u.text}`;
    it(label, () => {
      const hit = checkRedFlags(u.text, 'u1');
      if (u.expected) {
        expect(hit, 'expected a red-flag hit').not.toBeNull();
        expect(hit!.id).toBe(u.expected);
        expect(u.text).toContain(hit!.matched);
      } else {
        expect(hit, hit ? `fired ${hit.id} on "${hit.matched}"` : '').toBeNull();
      }
    });
  }

  it('recall over positive utterances is 100% (aggregate)', () => {
    const positives = utterances.filter((u) => u.expected);
    const missed = positives.filter((u) => checkRedFlags(u.text, 'u1')?.id !== u.expected);
    expect(missed.map((u) => u.text)).toEqual([]);
  });
});
