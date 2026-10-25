import { describe, expect, it } from 'vitest';
import { checkRedFlags, findRedFlags } from '../redFlags';
import type { RedFlagId } from '../../../contract/types';

const hit = (text: string): RedFlagId | null => checkRedFlags(text, 't1')?.id ?? null;

describe('red flags: positives', () => {
  const cases: [string, RedFlagId][] = [
    ['I have crushing chest pain since an hour', 'chest_pain'],
    ['my chest hurts and my left arm is numb', 'chest_pain'],
    ['Mam silny ból w klatce piersiowej', 'chest_pain'],
    ['bol w klatce od rana', 'chest_pain'],
    ['ucisk za mostkiem', 'chest_pain'],
    ['Болить у грудях і тисне', 'chest_pain'],
    ['сильний біль у грудях', 'chest_pain'],
    ['I think I am having a heart attack', 'chest_pain'],
    ["I can't breathe properly", 'breathing_difficulty'],
    ['shortness of breath when I walk', 'breathing_difficulty'],
    ['Mam duszności i nie mogę oddychać', 'breathing_difficulty'],
    ['duszę się', 'breathing_difficulty'],
    ['Не можу дихати', 'breathing_difficulty'],
    ['задишка і важко дихати', 'breathing_difficulty'],
    ['my face is drooping and my speech is slurred', 'stroke_signs'],
    ['Opada mi kącik ust i bełkoczę', 'stroke_signs'],
    ['drętwieje mi lewa ręka i twarz', 'stroke_signs'],
    ['обличчя перекосило, заплітається язик', 'stroke_signs'],
    ['I want to kill myself', 'suicidal_ideation'],
    ['nie chcę już żyć', 'suicidal_ideation'],
    ['Chcę się zabić', 'suicidal_ideation'],
    ['не хочу більше жити', 'suicidal_ideation'],
    ['my throat is swelling after the peanuts', 'anaphylaxis'],
    ['puchnie mi język i gardło', 'anaphylaxis'],
    ['набрякло горло, горло стискається', 'anaphylaxis'],
    ['the bleeding will not stop', 'severe_bleeding'],
    ['krew leci i nie przestaje', 'severe_bleeding'],
    ['Wymiotuję krwią', 'severe_bleeding'],
    ['сильна кровотеча', 'severe_bleeding'],
    ['I passed out this morning', 'loss_of_consciousness'],
    ['zemdlałem w pracy', 'loss_of_consciousness'],
    ['втратив свідомість', 'loss_of_consciousness'],
    ['he had a seizure', 'loss_of_consciousness'],
  ];
  for (const [text, id] of cases) {
    it(`${id}: ${text}`, () => {
      expect(hit(text)).toBe(id);
    });
  }
});

describe('red flags: no punctuation must still fire (recall-critical)', () => {
  it('"nie wiem chyba duszności"', () => expect(hit('nie wiem chyba duszności')).toBe('breathing_difficulty'));
  it('"I dont know sometimes I want to die"', () =>
    expect(hit('I dont know sometimes I want to die')).toBe('suicidal_ideation'));
  it('"nie mam gorączki nie mogę oddychać"', () =>
    expect(hit('nie mam gorączki nie mogę oddychać')).toBe('breathing_difficulty'));
  it('negation of one symptom does not hide another', () => {
    const ids = findRedFlags('no chest pain but I fainted', 't1').map((h) => h.id);
    expect(ids).toEqual(['loss_of_consciousness']);
  });
});

describe('red flags: negations and false positives', () => {
  const none = [
    'no chest pain',
    'I do not have chest pain',
    'nie mam bólu w klatce',
    'nie mam bólu w klatce piersiowej ani duszności',
    'brak duszności',
    'немає болю у грудях',
    'не маю болю в грудях',
    'this headache is killing me',
    'Od wczoraj boli mnie głowa',
    'I have a headache and a mild fever',
    'I had a heart attack in 2019',
    'my father had a stroke',
    'miałem zawał 5 lat temu',
    'I do not want to hurt myself',
    'No suicidal thoughts',
    'Mam katar i kaszel',
    'У мене болить голова',
  ];
  for (const text of none) {
    it(`no hit: ${text}`, () => {
      expect(hit(text)).toBeNull();
    });
  }
});

describe('red flags: result shape', () => {
  it('returns the exact substring of the original text', () => {
    const text = 'Mam silny Ból w klatce piersiowej od rana';
    const h = checkRedFlags(text, 't7');
    expect(h?.turnId).toBe('t7');
    expect(text.includes(h!.matched)).toBe(true);
    expect(h!.matched.toLowerCase()).toContain('klatce');
  });
});
