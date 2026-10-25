// Scoring helpers for the LLM summary eval. Independent of the engine's own verifyQuotes,
// so the "unsupported facts" metric is an external check, not the engine grading itself.
import type { Fact, IntakeSummary, Turn } from '../../src/contract/types';
import type { Scenario } from './scenarios';

export interface Check {
  field: string;
  pass: boolean;
  detail: string;
}

export function normalise(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const haystack = (f: Fact | null | undefined): string => (f ? normalise(`${f.value} ${f.quote}`) : '');
const hasAny = (hay: string, keywords: string[]): boolean => keywords.some((k) => hay.includes(normalise(k)));

export function scoreSummary(s: Scenario, summary: IntakeSummary): Check[] {
  const e = s.expected;
  const checks: Check[] = [];

  checks.push({
    field: 'chiefComplaint',
    pass: hasAny(haystack(summary.chiefComplaint), e.chiefComplaint),
    detail: summary.chiefComplaint?.value ?? 'null',
  });

  if (e.onset) {
    checks.push({
      field: 'onset',
      pass: hasAny(haystack(summary.opqrst.onset), e.onset),
      detail: summary.opqrst.onset?.value ?? 'null',
    });
  }

  const sev = summary.opqrst.severity;
  checks.push({
    field: 'severity',
    pass: e.severityScore === null ? sev === null || sev.score === null : sev?.score === e.severityScore,
    detail: sev ? `score=${sev.score}` : 'null',
  });

  e.allergies.forEach((group, i) => {
    checks.push({
      field: `allergy[${i}] ${group[0]}`,
      pass: summary.allergies.some((f) => hasAny(haystack(f), group)),
      detail: summary.allergies.map((f) => f.value).join('; ') || 'none',
    });
  });

  e.medications.forEach((group, i) => {
    checks.push({
      field: `medication[${i}] ${group[0]}`,
      pass: summary.medications.some((f) => hasAny(haystack(f), group)),
      detail: summary.medications.map((f) => f.value).join('; ') || 'none',
    });
  });

  const got = [...summary.missing].sort();
  const want = [...e.missing].sort();
  checks.push({
    field: 'missing',
    pass: got.length === want.length && got.every((x, i) => x === want[i]),
    detail: `got [${got.join(', ')}] want [${want.join(', ')}]`,
  });

  return checks;
}

export function allFacts(summary: IntakeSummary): Fact[] {
  const o = summary.opqrst;
  const single = [summary.chiefComplaint, o.onset, o.provocation, o.quality, o.region, o.severity, o.time, summary.lastIntake, summary.events];
  return [
    ...single.filter((f): f is Fact => f !== null),
    ...summary.signsSymptoms,
    ...summary.allergies,
    ...summary.medications,
    ...summary.pastHistory,
  ];
}

export interface QuoteAudit {
  total: number;
  /** Quote not a substring of any turn's normalised answer (or empty). Target: 0. */
  unsupported: Fact[];
  /** Quote exists in the transcript but not in the turn the fact points to. Informational. */
  turnMismatch: number;
}

export function auditQuotes(summary: IntakeSummary, turns: Turn[]): QuoteAudit {
  const norm = turns.map((t) => ({ id: t.id, text: normalise(t.answerText) }));
  const facts = allFacts(summary);
  const unsupported: Fact[] = [];
  let turnMismatch = 0;
  for (const f of facts) {
    const q = normalise(f.quote);
    if (!q || !norm.some((t) => t.text.includes(q))) {
      unsupported.push(f);
      continue;
    }
    const own = norm.find((t) => t.id === f.turnId);
    if (!own || !own.text.includes(q)) turnMismatch++;
  }
  return { total: facts.length, unsupported, turnMismatch };
}
