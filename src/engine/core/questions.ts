import type { PatientLanguage, Question, QuestionId } from '../../contract/types';

/** Fixed interview order (SAMPLE + OPQRST). */
export const QUESTION_ORDER: readonly QuestionId[] = [
  'chief_complaint',
  'onset',
  'severity',
  'associated_symptoms',
  'medications',
  'allergies',
  'past_history',
  'events',
] as const;

// Pre-written, short, plain wording. No LLM call per turn.
export const QUESTION_TEXT: Record<PatientLanguage, Record<QuestionId, string>> = {
  en: {
    chief_complaint: 'What is bothering you most today? Please describe it and where you feel it.',
    onset: 'When did it start, and has it changed since then?',
    severity: 'On a scale from 0 to 10, how strong is it right now?',
    associated_symptoms: 'Do you have any other symptoms, such as fever, nausea or dizziness?',
    medications: 'Are you taking any medicines, vitamins or supplements?',
    allergies: 'Are you allergic to any medicines, foods or anything else?',
    past_history: 'Do you have any long-term illnesses, or have you had surgery before?',
    events: 'When did you last eat or drink, and what happened just before this started?',
  },
  pl: {
    chief_complaint: 'Co dzisiaj najbardziej Pana/Panią niepokoi? Proszę opisać to i powiedzieć, gdzie to Pan/Pani czuje.',
    onset: 'Kiedy to się zaczęło i czy coś się od tamtej pory zmieniło?',
    severity: 'W skali od 0 do 10, jak silna jest ta dolegliwość teraz?',
    associated_symptoms: 'Czy występują inne objawy, na przykład gorączka, nudności lub zawroty głowy?',
    medications: 'Czy przyjmuje Pan/Pani jakieś leki, witaminy lub suplementy?',
    allergies: 'Czy ma Pan/Pani alergię na leki, jedzenie lub cokolwiek innego?',
    past_history: 'Czy choruje Pan/Pani przewlekle albo czy miał(a) Pan/Pani wcześniej operację?',
    events: 'Kiedy ostatnio Pan/Pani jadł(a) lub pił(a) i co się działo tuż przed początkiem dolegliwości?',
  },
  uk: {
    chief_complaint: 'Що вас сьогодні турбує найбільше? Опишіть, будь ласка, і скажіть, де саме ви це відчуваєте.',
    onset: 'Коли це почалося і чи щось змінилося відтоді?',
    severity: 'За шкалою від 0 до 10, наскільки сильно це зараз?',
    associated_symptoms: 'Чи є інші симптоми, наприклад температура, нудота або запаморочення?',
    medications: 'Чи приймаєте ви якісь ліки, вітаміни або добавки?',
    allergies: 'Чи є у вас алергія на ліки, їжу або щось інше?',
    past_history: 'Чи є у вас хронічні захворювання або чи були операції раніше?',
    events: 'Коли ви востаннє їли або пили і що відбувалося безпосередньо перед початком?',
  },
};

export function questionAt(language: PatientLanguage, index: number): Question | null {
  const id = QUESTION_ORDER[index];
  if (!id) return null;
  return { id, text: QUESTION_TEXT[language][id] };
}
