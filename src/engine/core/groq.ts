// Plain-fetch Groq client (no SDK). Verified against console.groq.com/docs
// (speech-to-text, structured-outputs, reasoning, deprecations) and GET /openai/v1/models on 2026-10-25.
//
// Errors are IntakeError with generic messages: they never contain the API key,
// request bodies, patient text, or text echoed back by the provider.

import type { PatientLanguage } from '../../contract/types';
import { IntakeError } from './errors';

// --- Model IDs and limits: change here (e.g. to A/B turbo vs v3, 120b vs 20b) ---
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const STT_MODEL = 'whisper-large-v3-turbo';
export const SUMMARY_MODEL = 'openai/gpt-oss-120b';
export const SUMMARY_FALLBACK_MODEL = 'openai/gpt-oss-20b';
export const STT_TIMEOUT_MS = 20_000;
export const CHAT_TIMEOUT_MS = 45_000;
/** Hard cap; gpt-oss reasoning tokens count against it. Typical summary uses ~1.2k. */
export const SUMMARY_MAX_TOKENS = 3_000;
const MAX_RETRY_WAIT_MS = 3_000;

/** Short vocabulary hint per language (<= 224 tokens). Biases spelling of medical words. */
export const STT_PROMPTS: Record<PatientLanguage, string> = {
  pl: 'Rozmowa pacjenta z lekarzem: ból, gorączka, nudności, ibuprofen, paracetamol, alergia, nadciśnienie, cukrzyca.',
  en: 'A patient talking to a doctor: pain, fever, nausea, ibuprofen, paracetamol, allergy, hypertension, diabetes.',
  uk: 'Розмова пацієнта з лікарем: біль, температура, нудота, ібупрофен, парацетамол, алергія, гіпертонія, діабет.',
};

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

function mapStatus(status: number): IntakeError {
  if (status === 401 || status === 403) return new IntakeError('auth', status);
  if (status === 429) return new IntakeError('rate_limit', status);
  if (status >= 500) return new IntakeError('server', status);
  return new IntakeError('bad_request', status);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** One attempt with timeout; throws IntakeError. */
async function attempt(url: string, init: RequestInit, opts: RequestOptions): Promise<Response> {
  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, opts.timeoutMs ?? CHAT_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  try {
    if (opts.signal?.aborted) throw new IntakeError('disposed');
    return await doFetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof IntakeError) throw e;
    if (opts.signal?.aborted) throw new IntakeError('disposed');
    if (timedOut) throw new IntakeError('timeout');
    throw new IntakeError('network');
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

/** POST with at most ONE retry, only on 429/5xx or a network failure. Never retries other 4xx or timeouts. */
async function post(url: string, init: RequestInit, opts: RequestOptions): Promise<Response> {
  let lastError: IntakeError | null = null;
  for (let n = 0; n < 2; n++) {
    let wait = 400;
    try {
      const res = await attempt(url, init, opts);
      if (res.ok) return res;
      lastError = mapStatus(res.status);
      if (res.status !== 429 && res.status < 500) throw lastError;
      const ra = Number(res.headers.get('retry-after'));
      if (Number.isFinite(ra) && ra > 0) wait = Math.min(ra * 1000, MAX_RETRY_WAIT_MS);
      // release the body without reading it
      res.body?.cancel?.().catch(() => undefined);
    } catch (e) {
      if (!(e instanceof IntakeError)) throw new IntakeError('network');
      if (e.code !== 'network' && e.code !== 'rate_limit' && e.code !== 'server') throw e;
      lastError = e;
    }
    if (n === 0) await sleep(wait);
  }
  throw lastError ?? new IntakeError('network');
}

const EXT_BY_MIME: Record<string, string> = {
  webm: 'webm', ogg: 'ogg', opus: 'ogg', wav: 'wav', 'x-wav': 'wav', wave: 'wav', mpeg: 'mp3', mp3: 'mp3',
  mp4: 'm4a', 'x-m4a': 'm4a', m4a: 'm4a', aac: 'm4a', flac: 'flac', '3gpp': 'm4a', 'x-caf': 'm4a',
};

/** 'audio/webm;codecs=opus' -> 'webm'. Groq infers the format from the file name. */
export function extensionForMime(mime: string): string {
  const sub = (mime.split(';')[0].split('/')[1] ?? '').trim().toLowerCase();
  return EXT_BY_MIME[sub] ?? 'webm';
}

/** Whisper sometimes "hears" these on silence. Treated as an empty transcript. */
const HALLUCINATIONS = [
  'napisy stworzone przez społeczność amara',
  'napisy stworzone przez spolecznosc amara',
  'amara.org',
  'dziękuję za oglądanie',
  'dzięki za oglądanie',
  'dziękuję za uwagę',
  'thanks for watching',
  'thank you for watching',
  'subtitles by',
  'дякую за перегляд',
  'дякуємо за перегляд',
  'субтитри створено',
  'субтитри зроблено',
  'продовження наступне',
];

export function isLikelyHallucination(text: string, language: PatientLanguage): boolean {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (t === STT_PROMPTS[language].toLowerCase()) return true;
  return t.length < 120 && HALLUCINATIONS.some((h) => t.includes(h));
}

/**
 * Speech-to-text. `input` is either a Blob (web) or a FormData that already holds the `file` part
 * (native {uri,name,type}). Returns trimmed transcript text; throws 'empty_transcript' on silence.
 */
export async function transcribe(
  input: Blob | FormData,
  apiKey: string,
  language: PatientLanguage,
  opts: RequestOptions & { model?: string } = {},
): Promise<string> {
  if (!apiKey) throw new IntakeError('missing_key');
  let form: FormData;
  if (typeof FormData !== 'undefined' && input instanceof FormData) {
    form = input;
  } else {
    form = new FormData();
    const blob = input as Blob;
    form.append('file', blob, `audio.${extensionForMime(blob.type || '')}`);
  }
  form.append('model', opts.model ?? STT_MODEL);
  form.append('language', language);
  form.append('response_format', 'json');
  form.append('temperature', '0');
  form.append('prompt', STT_PROMPTS[language]);

  const res = await post(
    `${GROQ_BASE_URL}/audio/transcriptions`,
    { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form },
    { timeoutMs: STT_TIMEOUT_MS, ...opts },
  );
  let text: unknown;
  try {
    text = ((await res.json()) as { text?: unknown }).text;
  } catch {
    throw new IntakeError('invalid_response');
  }
  if (typeof text !== 'string') throw new IntakeError('invalid_response');
  const clean = text.trim();
  if (isLikelyHallucination(clean, language)) throw new IntakeError('empty_transcript');
  return clean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatJsonRequest extends RequestOptions {
  apiKey: string;
  messages: ChatMessage[];
  model?: string;
  /** JSON schema for strict structured output. Omit to use plain json_object mode. */
  schema?: { name: string; schema: Record<string, unknown> };
  maxTokens?: number;
}

/** Chat completion with JSON output. Returns the raw JSON string of the first choice. */
export async function chatJson(req: ChatJsonRequest): Promise<string> {
  if (!req.apiKey) throw new IntakeError('missing_key');
  const model = req.model ?? SUMMARY_MODEL;
  const body = {
    model,
    messages: req.messages,
    temperature: 0,
    max_completion_tokens: req.maxTokens ?? SUMMARY_MAX_TOKENS,
    ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low', include_reasoning: false } : {}),
    response_format: req.schema
      ? { type: 'json_schema', json_schema: { name: req.schema.name, strict: true, schema: req.schema.schema } }
      : { type: 'json_object' },
  };
  const res = await post(
    `${GROQ_BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${req.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    req,
  );
  try {
    const data = (await res.json()) as {
      choices?: { message?: { content?: unknown }; finish_reason?: string }[];
    };
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== 'string' || !content.trim() || choice?.finish_reason === 'length') {
      throw new IntakeError('invalid_response');
    }
    return content;
  } catch (e) {
    if (e instanceof IntakeError) throw e;
    throw new IntakeError('invalid_response');
  }
}
