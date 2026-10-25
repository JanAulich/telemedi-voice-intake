// The interview engine. Pure TypeScript: audio transcription is injected, so this runs in Node.
// Patient data lives only in this closure (memory). dispose() wipes it and aborts in-flight requests.

import type {
  AudioInput,
  IntakeEngine,
  IntakeEngineConfig,
  IntakeRecord,
  PatientLanguage,
  Question,
  RedFlagHit,
  Turn,
  TurnResult,
} from '../../contract/types';
import { IntakeError } from './errors';
import { buildFhir } from './fhir';
import { SUMMARY_MODEL } from './groq';
import {
  MAX_AUDIO_MS,
  MAX_LLM_ATTEMPTS,
  MAX_LLM_CALLS,
  MAX_STT_CALLS,
} from './limits';
import { QUESTION_ORDER, questionAt } from './questions';
import { findRedFlags } from './redFlags';
import { summarize } from './summarize';
import { verifyQuotes } from './verifyQuotes';
import type { IntakeSummary } from '../../contract/types';

/** Audio input the UI may annotate with its own measured duration. */
export type TimedAudioInput = AudioInput & { durationMs?: number };

export interface TranscribeContext {
  apiKey: string;
  language: PatientLanguage;
  signal: AbortSignal;
}
/** Turns audio into text and MUST delete the audio afterwards (also on failure). */
export type TranscribeFn = (audio: AudioInput, ctx: TranscribeContext) => Promise<string>;

export interface CoreDeps {
  fetchImpl?: typeof fetch;
  /** Deletes an audio file without uploading it (used when a submission is rejected early). */
  discardAudio?: (audio: AudioInput) => Promise<void>;
  now?: () => Date;
  newId?: () => string;
}

export interface EngineUsage {
  /** Speech-to-text requests started in this session. */
  sttCalls: number;
  /** Summary requests started in this session. */
  llmCalls: number;
  sttLimit: number;
  llmLimit: number;
}

export type CoreEngine = IntakeEngine & { usage(): EngineUsage };

const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

export function createCoreEngine(
  config: IntakeEngineConfig,
  transcribe?: TranscribeFn,
  deps: CoreDeps = {},
): CoreEngine {
  const { patientLanguage, doctorLanguage } = config;
  let apiKey = config.apiKeys.groq ?? '';

  let turns: Turn[] = [];
  let redFlags: RedFlagHit[] = [];
  let index = 0;
  let version = 0; // bumped on every change to the transcript
  let busy = false;
  let disposed = false;
  let ctrl = new AbortController();

  let sttCalls = 0;
  let llmCalls = 0;
  let rawSummary: IntakeSummary | null = null; // unverified model output, kept so the LLM runs once
  let inflightFinish: Promise<IntakeRecord> | null = null;
  let cached: { version: number; record: IntakeRecord } | null = null;

  const alive = () => {
    if (disposed) throw new IntakeError('disposed');
  };

  const current = (): Question | null => questionAt(patientLanguage, index);

  async function answer(getText: () => Promise<string>): Promise<TurnResult> {
    alive();
    if (busy) throw new IntakeError('busy');
    const q = current();
    if (!q) throw new IntakeError('interview_complete');
    busy = true;
    const t0 = nowMs();
    try {
      const raw = await getText();
      alive();
      const text = raw.trim();
      if (!text) throw new IntakeError('empty_answer');

      const turn: Turn = {
        id: `t${index + 1}`,
        questionId: q.id,
        questionText: q.text,
        answerText: text,
        latencyMs: 0,
      };
      const hits = findRedFlags(text, turn.id);
      turns.push(turn);
      redFlags.push(...hits);
      index += 1;
      version += 1;
      turn.latencyMs = Math.round(nowMs() - t0);
      return { turn: { ...turn }, redFlag: hits[0] ? { ...hits[0] } : null, next: current() };
    } finally {
      busy = false;
    }
  }

  async function discard(audio: AudioInput) {
    try {
      await deps.discardAudio?.(audio);
    } catch {
      /* best effort */
    }
  }

  async function buildRecord(): Promise<IntakeRecord> {
    const answered = turns.filter((t) => t.answerText.trim());
    if (!rawSummary) {
      if (answered.length > 0) {
        if (!apiKey) throw new IntakeError('missing_key');
        if (llmCalls >= MAX_LLM_ATTEMPTS) throw new IntakeError('llm_limit');
        llmCalls += 1; // counted when started; at most one success is ever cached
        const snapshot = turns.map((t) => ({ ...t }));
        const result = await summarize({
          apiKey,
          turns: snapshot,
          patientLanguage,
          doctorLanguage,
          model: SUMMARY_MODEL,
          signal: ctrl.signal,
          fetchImpl: deps.fetchImpl,
        });
        alive();
        rawSummary = result;
      } else {
        rawSummary = (await summarize({ apiKey, turns: [], patientLanguage, doctorLanguage })) as IntakeSummary;
      }
    }
    // Deterministic from here: re-grounded against the CURRENT transcript (edits after the call stay safe).
    const tCopy = turns.map((t) => ({ ...t }));
    const summary = verifyQuotes(rawSummary, tCopy, patientLanguage);
    const flags = redFlags.map((r) => ({ ...r }));
    const fhir = buildFhir(
      { patientLanguage, doctorLanguage, turns: tCopy, redFlags: flags, summary },
      { now: deps.now?.(), newId: deps.newId },
    );
    return { patientLanguage, doctorLanguage, turns: tCopy, redFlags: flags, summary, fhir };
  }

  return {
    start: () => {
      alive();
      return current() ?? (questionAt(patientLanguage, QUESTION_ORDER.length - 1) as Question);
    },

    submitText: (text) => answer(async () => text),

    submitAudio(audio: TimedAudioInput) {
      return answer(async () => {
        if (!transcribe) {
          await discard(audio);
          throw new IntakeError('audio_unsupported');
        }
        if (typeof audio.durationMs === 'number' && audio.durationMs > MAX_AUDIO_MS) {
          await discard(audio);
          throw new IntakeError('audio_too_long');
        }
        if (sttCalls >= MAX_STT_CALLS) {
          await discard(audio);
          throw new IntakeError('stt_limit');
        }
        if (!apiKey) {
          await discard(audio);
          throw new IntakeError('missing_key');
        }
        sttCalls += 1;
        try {
          return await transcribe(audio, { apiKey, language: patientLanguage, signal: ctrl.signal });
        } catch (e) {
          // rejected locally before any upload: do not use up a call
          if (e instanceof IntakeError && e.code === 'audio_too_long') sttCalls -= 1;
          throw e;
        }
      });
    },

    editTurn(turnId, text) {
      if (disposed) return null;
      const t = turns.find((x) => x.id === turnId);
      if (!t) return null;
      t.answerText = text;
      redFlags = redFlags.filter((r) => r.turnId !== turnId);
      const hits = findRedFlags(text, turnId);
      redFlags.push(...hits);
      version += 1;
      return hits[0] ? { ...hits[0] } : null;
    },

    finish() {
      alive();
      if (busy) return Promise.reject(new IntakeError('busy'));
      if (cached && cached.version === version) return Promise.resolve(cached.record);
      if (inflightFinish) return inflightFinish;
      const myVersion = version;
      const p = buildRecord()
        .then((record) => {
          alive();
          cached = { version: myVersion, record };
          return record;
        })
        .finally(() => {
          inflightFinish = null;
        });
      inflightFinish = p;
      return p;
    },

    dispose() {
      disposed = true;
      ctrl.abort();
      turns = [];
      redFlags = [];
      index = 0;
      version += 1;
      rawSummary = null;
      cached = null;
      inflightFinish = null;
      apiKey = '';
    },

    usage: () => ({ sttCalls, llmCalls, sttLimit: MAX_STT_CALLS, llmLimit: MAX_LLM_CALLS }),
  };
}
