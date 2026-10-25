// Hard limits for the proof of concept. One place to change them.

/** 8 interview questions + 4 re-records. Typed answers (submitText) are not counted. */
export const MAX_STT_CALLS = 12;
/** One summary per session; a second attempt is allowed only after the first one failed. */
export const MAX_LLM_CALLS = 1;
export const MAX_LLM_ATTEMPTS = 2;
/** Reject recordings longer than this before uploading. */
export const MAX_AUDIO_MS = 60_000;
/** Backstop when the duration is unknown (about 60 s of 16-bit mono WAV at 24 kHz). */
export const MAX_AUDIO_BYTES = 3_000_000;
