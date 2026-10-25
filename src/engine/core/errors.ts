// Error type for the engine. Messages are generic on purpose: they never contain
// API keys, transcripts, or anything a provider echoed back.

export type IntakeErrorCode =
  | 'missing_key'
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'server'
  | 'bad_request'
  | 'invalid_response'
  | 'empty_transcript'
  | 'empty_answer'
  | 'interview_complete'
  | 'busy'
  | 'disposed'
  | 'audio_unsupported'
  | 'audio_read_failed'
  | 'audio_too_long'
  | 'stt_limit'
  | 'llm_limit';

const MESSAGES: Record<IntakeErrorCode, string> = {
  missing_key: 'No Groq API key is set. Add one in the key settings.',
  auth: 'Groq rejected the API key. Check that it is correct and active.',
  rate_limit: 'Groq rate limit reached. Wait a few seconds and try again.',
  timeout: 'The request to Groq timed out. Check the connection and try again.',
  network: 'Could not reach Groq. Check the connection and try again.',
  server: 'Groq had a temporary problem. Try again in a moment.',
  bad_request: 'Groq could not process the request.',
  invalid_response: 'The model returned an unusable response. Try again.',
  empty_transcript: 'No speech was recognised. Please try again or type the answer.',
  empty_answer: 'The answer is empty.',
  interview_complete: 'The interview is already complete.',
  busy: 'Another answer is still being processed.',
  disposed: 'This interview has ended.',
  audio_unsupported: 'Audio input is not available in this engine.',
  audio_read_failed: 'The recording could not be read.',
  audio_too_long: 'The recording is too long. Keep each answer under 60 seconds or type it.',
  stt_limit: 'Voice limit reached for this demo session. Please type your answer.',
  llm_limit: 'The summary limit for this demo session has been reached.',
};

export class IntakeError extends Error {
  readonly code: IntakeErrorCode;
  readonly status?: number;

  constructor(code: IntakeErrorCode, status?: number) {
    super(MESSAGES[code]);
    this.name = 'IntakeError';
    this.code = code;
    this.status = status;
  }
}

export const isIntakeError = (e: unknown): e is IntakeError => e instanceof IntakeError;
