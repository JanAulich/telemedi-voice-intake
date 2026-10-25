/// <reference types="node" />
// LLM eval. Budget: one summary call per scenario per model, scenarios run sequentially, no re-runs
// (default 2 models x 10 scenarios = 20 calls). Skips cleanly without GROQ_API_KEY.
//
// Reference model: createCoreEngine + submitText + finish() (the real product path).
// Comparison model(s): the engine hard-codes SUMMARY_MODEL, so these call summarize({ model }) and
// verifyQuotes() directly on the same turns, which are the two steps finish() performs.
// Writes eval/results.md when it runs. The API key is never logged or written.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCoreEngine } from '../src/engine/core';
import { SUMMARY_MODEL } from '../src/engine/core/groq';
import { summarize } from '../src/engine/core/summarize';
import { verifyQuotes } from '../src/engine/core/verifyQuotes';
import type { IntakeSummary, Question, Turn } from '../src/contract/types';
import { loadScenarios, type Scenario } from './lib/scenarios';
import { auditQuotes, scoreSummary } from './lib/score';
import { aggregate, renderReport, type CallRecord, type ModelRun, type ScenarioResult } from './lib/report';

const apiKey = process.env.GROQ_API_KEY;
const scenarios = loadScenarios();
const resultsPath = join(dirname(fileURLToPath(import.meta.url)), 'results.md');

/** Reference first. Override the comparison list with EVAL_COMPARE_MODELS=a,b (comma separated), or "" for none. */
const REFERENCE_MODEL = SUMMARY_MODEL;
const COMPARE_MODELS = (process.env.EVAL_COMPARE_MODELS ?? 'openai/gpt-oss-20b').split(',').map((m: string) => m.trim()).filter(Boolean);

/** Free-tier pacing: wait for the token bucket when fewer than this many tokens are left (a call needs ~3.5k). */
const LOW_TOKENS = 6_000;
const MAX_WAIT_S = 120;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Groq reset headers look like "7.66s", "2m59.56s", "120ms". */
function parseDurationMs(v: string | null): number | null {
  if (!v) return null;
  let total = 0;
  let matched = false;
  for (const m of v.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    matched = true;
    const n = Number(m[1]);
    total += m[2] === 'ms' ? n : m[2] === 'h' ? n * 3_600_000 : m[2] === 'm' ? n * 60_000 : n * 1000;
  }
  return matched ? total : null;
}

let pauseUntil = 0;
const calls: CallRecord[] = [];
let label = '';
const runs: ModelRun[] = [
  { model: REFERENCE_MODEL, via: '`createCoreEngine().finish()`', results: [] },
  ...COMPARE_MODELS.map((m: string) => ({ model: m, via: '`summarize({ model })` + `verifyQuotes()`', results: [] })),
];

const tokenSum = (lbl: string, key: 'promptTokens' | 'completionTokens') =>
  calls.filter((c) => c.label === lbl).reduce((n, c) => n + (c[key] ?? 0), 0);

describe.skipIf(!apiKey)('LLM summary eval (live Groq)', () => {
  const realFetch = globalThis.fetch;

  beforeAll(() => {
    // Counts every HTTP request to Groq (including engine-internal retries) and paces them for the free-tier
    // token-per-minute limit: it sleeps until the token bucket refills when little is left, and on a 429 it
    // waits the advertised retry-after once and re-sends. Records only metadata and token usage.
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const send = async () => {
        const t0 = performance.now();
        const res = await realFetch(input, init);
        const rec: CallRecord = {
          endpoint: new URL(url).pathname,
          status: res.status,
          ms: performance.now() - t0,
          model: null,
          promptTokens: null,
          completionTokens: null,
          label,
        };
        if (rec.endpoint.endsWith('/chat/completions')) {
          try {
            rec.model = (JSON.parse(String(init?.body)) as { model?: string }).model ?? null;
            if (res.ok) {
              const u = ((await res.clone().json()) as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
              rec.promptTokens = u?.prompt_tokens ?? null;
              rec.completionTokens = u?.completion_tokens ?? null;
            }
          } catch {
            /* metadata only */
          }
        }
        calls.push(rec);
        return res;
      };
      let res = await send();
      if (res.status === 429) {
        const wait = Number(res.headers.get('retry-after'));
        if (Number.isFinite(wait) && wait > 0 && wait <= MAX_WAIT_S) {
          await sleep((wait + 1) * 1000);
          res = await send();
        }
      } else if (res.ok) {
        const left = Number(res.headers.get('x-ratelimit-remaining-tokens'));
        const reset = parseDurationMs(res.headers.get('x-ratelimit-reset-tokens'));
        // Pause is served at the start of the next test, outside any latency timer.
        if (Number.isFinite(left) && left < LOW_TOKENS && reset !== null && reset <= MAX_WAIT_S * 1000) pauseUntil = Date.now() + reset + 1000;
      }
      return res;
    }) as typeof fetch;
  });

  /** Plays the scripted answers through the engine (local, no API call). Returns turns and red-flag hits. */
  async function interview(s: Scenario) {
    const engine = createCoreEngine({
      patientLanguage: s.patientLanguage,
      doctorLanguage: s.doctorLanguage,
      apiKeys: { groq: apiKey },
    });
    const fired: ScenarioResult['firedRedFlags'] = [];
    const turns: Turn[] = [];
    let q: Question | null = engine.start();
    for (let i = 0; q && i < 20; i++) {
      const res = await engine.submitText(s.answers[q.id]);
      turns.push(res.turn);
      if (res.redFlag) fired.push({ id: res.redFlag.id, questionId: res.turn.questionId });
      q = res.next;
    }
    return { engine, fired, turns };
  }

  function toResult(s: Scenario, model: string, summary: IntakeSummary, turns: Turn[], fired: ScenarioResult['firedRedFlags'], finishMs: number): ScenarioResult {
    const audit = auditQuotes(summary, turns);
    const lbl = `${model}|${s.id}`;
    return {
      id: s.id,
      patientLanguage: s.patientLanguage,
      doctorLanguage: s.doctorLanguage,
      expectedRedFlag: s.expected.redFlag,
      firedRedFlags: fired,
      checks: scoreSummary(s, summary),
      facts: audit.total,
      unsupported: audit.unsupported.map((f) => f.quote),
      turnMismatch: audit.turnMismatch,
      droppedByEngine: summary.droppedUnsupported,
      // HTTP time of the successful summary request (excludes pacing sleeps and 429 waits); falls back to wall time.
      finishMs: calls.filter((c) => c.label === lbl && c.status === 200 && c.endpoint.endsWith('/chat/completions')).at(-1)?.ms ?? finishMs,
      meanTurnMs: turns.length ? turns.reduce((a, t) => a + t.latencyMs, 0) / turns.length : 0,
      promptTokens: tokenSum(lbl, 'promptTokens'),
      completionTokens: tokenSum(lbl, 'completionTokens'),
    };
  }

  runs.forEach((run, runIndex) => {
    for (const s of scenarios) {
      it(
        `${run.model} / ${s.id}`,
        async () => {
          await sleep(Math.max(0, pauseUntil - Date.now()));
          label = `${run.model}|${s.id}`;
          const { engine, fired, turns } = await interview(s);
          try {
            let summary: IntakeSummary;
            let finishMs: number;
            const t0 = performance.now();
            if (runIndex === 0) {
              const record = await engine.finish();
              summary = record.summary;
            } else {
              const raw = await summarize({
                apiKey: apiKey!,
                turns,
                patientLanguage: s.patientLanguage,
                doctorLanguage: s.doctorLanguage,
                model: run.model,
              });
              summary = verifyQuotes(raw, turns, s.patientLanguage);
            }
            finishMs = performance.now() - t0;
            run.results.push(toResult(s, run.model, summary, turns, fired, finishMs));
          } catch (err) {
            run.results.push({
              id: s.id,
              patientLanguage: s.patientLanguage,
              doctorLanguage: s.doctorLanguage,
              expectedRedFlag: s.expected.redFlag,
              firedRedFlags: fired,
              checks: [],
              facts: 0,
              unsupported: [],
              turnMismatch: 0,
              droppedByEngine: 0,
              finishMs: 0,
              meanTurnMs: 0,
              promptTokens: 0,
              completionTokens: 0,
              error: err instanceof Error ? err.message : String(err),
            });
            // A failing comparison model is a result, not a test failure. The reference model must work.
            if (runIndex === 0) throw err;
          } finally {
            engine.dispose();
            label = '';
          }
        },
        300_000,
      );
    }
  });

  it('reference model meets PRD targets', () => {
    const a = aggregate(runs[0].results, runs[0].model);
    expect(runs[0].results).toHaveLength(scenarios.length);
    expect(a.redFlagRecall, 'red-flag recall').toBe(1);
    expect(a.redFlagFalsePositives, 'red-flag false positives').toBe(0);
    expect(a.unsupportedRemaining, 'unsupported facts remaining in summaries').toBe(0);
    expect(a.captureRate, 'required-field capture rate').toBeGreaterThanOrEqual(0.9);
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
    if (runs[0].results.length) {
      writeFileSync(resultsPath, renderReport(runs.filter((r) => r.results.length), calls, new Date()));
      console.log(`Groq API calls made by this eval run: ${calls.length} (results written to eval/results.md)`);
    }
  });
});
