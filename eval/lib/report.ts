// Renders eval/results.md from LLM eval results. Pure string building, no I/O.
import type { RedFlagId } from '../../src/contract/types';
import type { Check } from './score';

/** One HTTP request to Groq. Never holds keys, prompts or patient text. */
export interface CallRecord {
  endpoint: string;
  status: number;
  ms: number;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  /** `${model}|${scenarioId}` while a scenario is running. */
  label: string;
}

export interface ScenarioResult {
  id: string;
  patientLanguage: string;
  doctorLanguage: string;
  expectedRedFlag: RedFlagId | null;
  firedRedFlags: { id: RedFlagId; questionId: string }[];
  checks: Check[];
  facts: number;
  unsupported: string[];
  turnMismatch: number;
  droppedByEngine: number;
  finishMs: number;
  meanTurnMs: number;
  promptTokens: number;
  completionTokens: number;
  error?: string;
}

export interface ModelRun {
  model: string;
  /** How the summary call was made. */
  via: string;
  results: ScenarioResult[];
}

/** USD per 1M tokens, from docs/research/cost.md (Groq console prices, checked 2026-10-25). */
export const PRICES: Record<string, { in: number; out: number }> = {
  'openai/gpt-oss-120b': { in: 0.15, out: 0.6 },
  'openai/gpt-oss-20b': { in: 0.075, out: 0.3 },
};
/** Speech-to-text per intake, turbo per clip, from docs/research/cost.md (an assumption there, not measured here). */
export const STT_TURBO_PER_INTAKE = 0.00116;

export interface Aggregate {
  captured: number;
  totalChecks: number;
  captureRate: number;
  fieldRate: Record<'severity' | 'allergy' | 'medication', number | null>;
  redFlagRecall: number | null;
  redFlagFalsePositives: number;
  unsupportedRemaining: number;
  droppedByEngine: number;
  factsTotal: number;
  errors: number;
  meanFinishMs: number;
  maxFinishMs: number;
  meanTurnMs: number;
  meanPromptTokens: number;
  meanCompletionTokens: number;
  llmCostPerIntake: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function aggregate(rs: ScenarioResult[], model?: string): Aggregate {
  const ok = rs.filter((r) => !r.error);
  const all = rs.flatMap((r) => r.checks);
  const captured = all.filter((c) => c.pass).length;
  const rate = (prefix: string) => {
    const cs = all.filter((c) => c.field.startsWith(prefix));
    return cs.length ? cs.filter((c) => c.pass).length / cs.length : null;
  };
  const urgent = rs.filter((r) => r.expectedRedFlag !== null);
  const caught = urgent.filter((r) => r.firedRedFlags.some((f) => f.id === r.expectedRedFlag));
  const finish = ok.map((r) => r.finishMs);
  const price = model ? PRICES[model] : undefined;
  const pIn = mean(ok.map((r) => r.promptTokens));
  const pOut = mean(ok.map((r) => r.completionTokens));
  return {
    captured,
    totalChecks: all.length,
    captureRate: all.length ? captured / all.length : 0,
    fieldRate: { severity: rate('severity'), allergy: rate('allergy'), medication: rate('medication') },
    redFlagRecall: urgent.length ? caught.length / urgent.length : null,
    redFlagFalsePositives: rs.filter((r) => r.expectedRedFlag === null && r.firedRedFlags.length > 0).length,
    unsupportedRemaining: rs.reduce((n, r) => n + r.unsupported.length, 0),
    droppedByEngine: rs.reduce((n, r) => n + r.droppedByEngine, 0),
    factsTotal: rs.reduce((n, r) => n + r.facts, 0),
    errors: rs.filter((r) => r.error).length,
    meanFinishMs: mean(finish),
    maxFinishMs: finish.length ? Math.max(...finish) : 0,
    meanTurnMs: mean(ok.map((r) => r.meanTurnMs)),
    meanPromptTokens: pIn,
    meanCompletionTokens: pOut,
    llmCostPerIntake: price ? (pIn * price.in + pOut * price.out) / 1_000_000 : null,
  };
}

/** Quality gate for a cheaper model vs the reference: >= 90% capture, within 5 points, zero unsupported facts on the card. */
export function gateVerdict(candidate: Aggregate, reference: Aggregate): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (candidate.errors > 0) reasons.push(`${candidate.errors} scenario(s) failed to produce a summary`);
  if (candidate.captureRate < 0.9) reasons.push(`capture ${pct(candidate.captureRate)} is below 90%`);
  const gap = reference.captureRate - candidate.captureRate;
  if (gap > 0.05) reasons.push(`capture is ${(gap * 100).toFixed(1)} points below the larger model (limit 5)`);
  if (candidate.unsupportedRemaining > 0) reasons.push(`${candidate.unsupportedRemaining} unsupported fact(s) reached the card`);
  return { ok: reasons.length === 0, reasons };
}

const pct = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const usd = (x: number | null) => (x === null ? 'n/a' : `$${x.toFixed(5)}`);
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const mark = (b: boolean) => (b ? 'PASS' : 'FAIL');
const short = (m: string) => m.replace('openai/', '');

export function renderReport(runs: ModelRun[], calls: CallRecord[], when: Date): string {
  const [ref, ...others] = runs;
  const aggs = runs.map((r) => aggregate(r.results, r.model));
  const refAgg = aggs[0];
  const L: string[] = [];
  L.push('# Eval results');
  L.push('');
  L.push(
    `Generated ${when.toISOString()} by \`eval/summary.test.ts\`. ${ref.results.length} scenarios, invented data, text input (\`submitText\`, no speech-to-text), live Groq calls.`,
  );
  L.push('');
  L.push('## API call budget');
  L.push('');
  const byEndpoint = new Map<string, number>();
  for (const c of calls) byEndpoint.set(c.endpoint, (byEndpoint.get(c.endpoint) ?? 0) + 1);
  L.push(
    `One summary call per scenario per model, scenarios run sequentially, no eval-level re-runs. **Total HTTP requests to Groq: ${calls.length}** (${[...byEndpoint].map(([e, n]) => `${n} x ${e}`).join(', ') || 'none'}). Non-2xx responses: ${calls.filter((c) => c.status >= 400).length}. The engine itself retries once on 429/5xx, so the count can exceed scenarios x models.`,
  );
  L.push('');
  L.push('## Aggregate vs PRD targets (reference model)');
  L.push('');
  L.push(`Reference: \`${ref.model}\`, called through ${ref.via}.`);
  L.push('');
  L.push('| Metric | Target | Result | Status |');
  L.push('|---|---|---|---|');
  L.push(`| Required-field capture | >= 90% | ${pct(refAgg.captureRate)} (${refAgg.captured}/${refAgg.totalChecks}) | ${mark(refAgg.captureRate >= 0.9)} |`);
  L.push(`| Red-flag recall (engine, per turn) | 100% | ${pct(refAgg.redFlagRecall)} | ${mark(refAgg.redFlagRecall === 1)} |`);
  L.push(`| Red-flag false positives (non-urgent scenarios) | 0 | ${refAgg.redFlagFalsePositives} | ${mark(refAgg.redFlagFalsePositives === 0)} |`);
  L.push(`| Unsupported facts remaining in summary (independent check) | 0 | ${refAgg.unsupportedRemaining} of ${refAgg.factsTotal} facts | ${mark(refAgg.unsupportedRemaining === 0)} |`);
  L.push(`| Facts dropped by the engine as unsupported | informational | ${refAgg.droppedByEngine} | n/a |`);
  L.push(`| Per-turn latency, text mode | <= ~3 s (speech to next question) | mean ${secs(refAgg.meanTurnMs)} (local only, excludes speech-to-text) | ${mark(refAgg.meanTurnMs <= 3000)} |`);
  L.push('');
  L.push('Per-turn latency excludes Whisper, so the PRD latency target needs a real-audio run to confirm.');
  L.push('');
  L.push('## Summary model comparison');
  L.push('');
  L.push(
    `Cost uses measured token usage from the API responses and the prices in docs/research/cost.md. The engine hard-codes \`SUMMARY_MODEL\` and does not expose a per-session model option, so the non-reference models are called with \`summarize({ model })\` followed by \`verifyQuotes()\`, the same two steps the engine runs inside \`finish()\`.`,
  );
  L.push('');
  L.push(`| Metric | ${runs.map((r) => `\`${short(r.model)}\``).join(' | ')} |`);
  L.push(`|---|${runs.map(() => '---').join('|')}|`);
  const row = (name: string, f: (a: Aggregate, i: number) => string) => L.push(`| ${name} | ${aggs.map(f).join(' | ')} |`);
  row('Call path', (_, i) => runs[i].via);
  row('Scenarios with a summary', (a, i) => `${runs[i].results.length - a.errors}/${runs[i].results.length}`);
  row('Field capture', (a) => `${pct(a.captureRate)} (${a.captured}/${a.totalChecks})`);
  row('Severity correct', (a) => pct(a.fieldRate.severity));
  row('Allergies correct', (a) => pct(a.fieldRate.allergy));
  row('Medications correct', (a) => pct(a.fieldRate.medication));
  row('Unsupported facts dropped by engine', (a) => String(a.droppedByEngine));
  row('Unsupported facts reaching the card', (a) => `${a.unsupportedRemaining} of ${a.factsTotal}`);
  row('Mean finish() latency', (a) => secs(a.meanFinishMs));
  row('Max finish() latency', (a) => secs(a.maxFinishMs));
  row('Mean tokens in / out', (a) => `${a.meanPromptTokens.toFixed(0)} / ${a.meanCompletionTokens.toFixed(0)}`);
  row('LLM cost per intake', (a) => usd(a.llmCostPerIntake));
  row('LLM + STT (turbo) per intake', (a) => usd(a.llmCostPerIntake === null ? null : a.llmCostPerIntake + STT_TURBO_PER_INTAKE));
  L.push('');
  L.push(`STT cost per intake (\`whisper-large-v3-turbo\`, $${STT_TURBO_PER_INTAKE}) is the cost.md assumption, not measured here.`);
  L.push('');
  L.push('Quality gate for a cheaper model: field capture >= 90%, within 5 points of the larger model, zero unsupported facts reaching the card.');
  L.push('');
  const refGate = refAgg.captureRate >= 0.9 && refAgg.unsupportedRemaining === 0;
  L.push(`- \`${short(ref.model)}\` (reference): ${refGate ? 'meets' : 'does NOT meet'} the absolute gate (capture ${pct(refAgg.captureRate)}, ${refAgg.unsupportedRemaining} unsupported on the card).`);
  others.forEach((o, i) => {
    const v = gateVerdict(aggs[i + 1], refAgg);
    L.push(`- \`${short(o.model)}\`: **${v.ok ? 'ACCEPTABLE' : 'NOT ACCEPTABLE'}** vs \`${short(ref.model)}\`${v.ok ? '' : ': ' + v.reasons.join('; ')}.`);
  });
  L.push('');
  L.push(
    '10 scenarios give a coarse signal: one missed field moves capture by roughly 2 points. Treat a pass as "no evidence of a regression", not proof, and re-run on more scenarios before switching.',
  );
  L.push('');
  L.push('## Scenario overview');
  for (const run of runs) {
    L.push('');
    L.push(`### \`${short(run.model)}\``);
    L.push('');
    L.push('| Scenario | Lang (patient -> doctor) | Capture | Red flag expected / fired | Facts | Unsupported on card | Dropped | finish() |');
    L.push('|---|---|---|---|---|---|---|---|');
    for (const r of run.results) {
      const pass = r.checks.filter((c) => c.pass).length;
      const fired = r.firedRedFlags.map((f) => `${f.id}@${f.questionId}`).join(', ') || 'none';
      L.push(
        `| ${r.id} | ${r.patientLanguage} -> ${r.doctorLanguage} | ${r.error ? 'ERROR' : `${pass}/${r.checks.length}`} | ${r.expectedRedFlag ?? 'none'} / ${fired} | ${r.facts} | ${r.unsupported.length} | ${r.droppedByEngine} | ${r.error ? '-' : secs(r.finishMs)} |`,
      );
    }
  }
  for (const run of runs) {
    for (const r of run.results) {
      L.push('');
      L.push(`## ${short(run.model)} / ${r.id}`);
      L.push('');
      if (r.error) {
        L.push(`Error: ${esc(r.error)}`);
        continue;
      }
      L.push('| Field | Result | Summary value |');
      L.push('|---|---|---|');
      for (const c of r.checks) L.push(`| ${esc(c.field)} | ${mark(c.pass)} | ${esc(c.detail)} |`);
      if (r.unsupported.length) {
        L.push('');
        L.push(`Unsupported quotes on the card (not found in transcript): ${r.unsupported.map((q) => `"${esc(q)}"`).join(', ')}`);
      }
      if (r.turnMismatch) L.push(`\nFacts whose quote exists in the transcript but not in the cited turn: ${r.turnMismatch}`);
    }
  }
  L.push('');
  return L.join('\n');
}
