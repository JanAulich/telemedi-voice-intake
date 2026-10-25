// Grounding check: every fact on the card must quote the patient's own words.
// Facts whose quote cannot be found in the transcript are dropped and counted.

import type { Fact, IntakeSummary, QuestionId, Turn } from '../../contract/types';

/** Lowercase, NFC, apostrophes removed, other punctuation -> space, whitespace collapsed. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/['’ʼ`]/g, '')
    .replace(/[^A-Za-z0-9\u00C0-\u024F\u0400-\u052F\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Secondary key: strips diacritics (the model sometimes "corrects" Polish letters). */
function foldDiacritics(normalized: string): string {
  return normalized
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
}

const NEGATORS = new Set([
  'nie', 'bez', 'brak', 'braku', 'ani', 'nigdy', 'no', 'not', 'never', 'without', 'none', 'dont', 'doesnt', 'didnt',
  'havent', 'hasnt', 'не', 'без', 'ні', 'немає', 'нема', 'ніколи',
]);

/** Minimum share of quote tokens that must appear in order for a fuzzy match. */
const FUZZY_RATIO = 0.8;

function lcsLength(a: string[], b: string[]): number {
  const prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = tmp;
    }
  }
  return prev[b.length];
}

function matchNormalized(nq: string, na: string): boolean {
  if (!nq || !na) return false;
  const qt = nq.split(' ');
  const at = na.split(' ');

  // 1) contiguous token substring
  const padded = ` ${na} `;
  const needle = ` ${nq} `;
  let from = 0;
  for (;;) {
    const idx = padded.indexOf(needle, from);
    if (idx === -1) break;
    // number of tokens before the match -> check a negator the quote left out
    const before = padded.slice(0, idx + 1).trim();
    const prevTokens = before ? before.split(' ').slice(-2) : [];
    const quoteHasNeg = NEGATORS.has(qt[0]);
    if (quoteHasNeg || !prevTokens.some((t) => NEGATORS.has(t))) return true;
    from = idx + 1;
  }
  if (padded.includes(needle)) return false; // only found right after a negator the quote omitted

  // 2) fuzzy: >= 80% of the quote tokens in order inside a window of at most 2x the quote length
  const need = Math.ceil(FUZZY_RATIO * qt.length - 1e-9);
  if (qt.length < 3) return false; // short quotes must match exactly
  const win = Math.min(at.length, qt.length * 2);
  for (let s = 0; s + 1 <= at.length; s++) {
    const w = at.slice(s, s + win);
    if (w.length < need) break;
    if (lcsLength(qt, w) >= need) {
      const prevTokens = at.slice(Math.max(0, s - 2), s);
      if (NEGATORS.has(qt[0]) || !prevTokens.some((t) => NEGATORS.has(t)) || lcsLength(qt, w) === qt.length) {
        return true;
      }
    }
  }
  return false;
}

/** True if `quote` is supported by `answer` (exact substring or >= 80% in-order tokens). */
export function quoteSupported(quote: string, answer: string): boolean {
  const nq = normalizeText(quote);
  const na = normalizeText(answer);
  if (!nq || !na) return false;
  if (matchNormalized(nq, na)) return true;
  const fq = foldDiacritics(nq);
  const fa = foldDiacritics(na);
  return fq !== nq || fa !== na ? matchNormalized(fq, fa) : false;
}

type OneFact = Fact | null;

function checkFact<T extends Fact>(fact: T | null | undefined, turns: Turn[]): { fact: T | null; dropped: boolean } {
  if (!fact) return { fact: null, dropped: false };
  const value = typeof fact.value === 'string' ? fact.value.trim() : '';
  const quote = typeof fact.quote === 'string' ? fact.quote.trim() : '';
  if (!value || !quote) return { fact: null, dropped: true };

  const claimed = turns.find((t) => t.id === fact.turnId);
  const ordered = claimed ? [claimed, ...turns.filter((t) => t !== claimed)] : turns;
  const support = ordered.find((t) => quoteSupported(quote, t.answerText));
  if (!support) return { fact: null, dropped: true };

  return {
    fact: {
      ...fact,
      value,
      quote,
      turnId: support.id,
      provenance: fact.provenance === 'stated' ? 'stated' : 'inferred',
    },
    dropped: false,
  };
}

/**
 * Returns a copy of `summary` that only contains facts grounded in the transcript.
 * Fills `droppedUnsupported` (added to any existing count) and `missing`.
 */
export function verifyQuotes(summary: IntakeSummary, turns: Turn[]): IntakeSummary {
  let dropped = 0;

  const one = (f: OneFact): OneFact => {
    const r = checkFact(f, turns);
    if (r.dropped) dropped += 1;
    return r.fact;
  };
  const many = (list: Fact[] | null | undefined): Fact[] => {
    const out: Fact[] = [];
    const seen = new Set<string>();
    for (const f of list ?? []) {
      const r = checkFact(f, turns);
      if (r.dropped) dropped += 1;
      if (!r.fact) continue;
      const key = normalizeText(r.fact.value);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r.fact);
    }
    return out;
  };

  let severity: IntakeSummary['opqrst']['severity'] = null;
  if (summary.opqrst.severity) {
    const r = checkFact(summary.opqrst.severity, turns);
    if (r.dropped) dropped += 1;
    if (r.fact) {
      let score: number | null = summary.opqrst.severity.score;
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 10) score = null;
      // a numeric score must be visible in the quote when the quote has digits
      const digits = r.fact.quote.match(/\d+/g);
      if (score !== null && digits && !digits.map(Number).includes(score)) score = null;
      severity = { ...r.fact, score };
    }
  }

  const base: Omit<IntakeSummary, 'missing' | 'droppedUnsupported'> = {
    doctorLanguage: summary.doctorLanguage,
    chiefComplaint: one(summary.chiefComplaint),
    opqrst: {
      onset: one(summary.opqrst.onset),
      provocation: one(summary.opqrst.provocation),
      quality: one(summary.opqrst.quality),
      region: one(summary.opqrst.region),
      severity,
      time: one(summary.opqrst.time),
    },
    signsSymptoms: many(summary.signsSymptoms),
    allergies: many(summary.allergies),
    medications: many(summary.medications),
    pastHistory: many(summary.pastHistory),
    lastIntake: one(summary.lastIntake),
    events: one(summary.events),
  };

  return {
    ...base,
    missing: computeMissing(base),
    droppedUnsupported: (summary.droppedUnsupported ?? 0) + dropped,
  };
}

/** A topic is missing when no grounded fact survived for it (unanswered, "don't know", or all dropped). */
export function computeMissing(s: Omit<IntakeSummary, 'missing' | 'droppedUnsupported'>): QuestionId[] {
  const has: Record<QuestionId, boolean> = {
    chief_complaint: !!s.chiefComplaint,
    onset: !!(s.opqrst.onset || s.opqrst.time),
    severity: !!s.opqrst.severity,
    associated_symptoms: s.signsSymptoms.length > 0,
    medications: s.medications.length > 0,
    allergies: s.allergies.length > 0,
    past_history: s.pastHistory.length > 0,
    events: !!(s.events || s.lastIntake),
  };
  return (Object.keys(has) as QuestionId[]).filter((id) => !has[id]);
}
