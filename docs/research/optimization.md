# Optimization research: voice intake (checked 2026-10-25)

Sources are Groq console docs and Expo SDK 58 docs, fetched today. "Unverified" means the primary page did not state it.

## Facts the engine needs

### 1. Groq speech-to-text
Source: https://console.groq.com/docs/speech-to-text and https://console.groq.com/docs/models

| Model ID | Price/h | Speed factor | WER | Note |
|---|---|---|---|---|
| `whisper-large-v3-turbo` | $0.04 | 216x | 12% | best price-performance |
| `whisper-large-v3` | $0.111 | 189x | 10.3% | docs say use for error-sensitive multilingual work |

- Both multilingual. Default to `whisper-large-v3` for Polish/Ukrainian (short clips, speed gap is negligible); offer turbo as fallback.
- Formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm. Max upload 25 MB on free tier (100 MB dev tier). So webm (Chrome) and m4a/mp4 (Safari, iOS, Android) all work.
- Groq downsamples to 16 kHz mono itself. Minimum billed length 10 s.
- `language`: ISO-639-1 (`pl`, `en`, `uk`); docs say it improves accuracy and latency. Always send it.
- `prompt`: max 224 tokens; guides style, context and spelling of unfamiliar words; write it in the same language as the audio. A short in-language medical vocabulary list (drug and symptom names) is therefore the documented use. Gain for pl/uk is unverified: there are no published numbers, so treat it as a cheap, untested bonus.

### 2. Groq chat models for JSON extraction
Sources: https://console.groq.com/docs/models, https://console.groq.com/docs/structured-outputs, model pages under https://console.groq.com/docs/model/

| Model ID | Status | Structured outputs | Notes |
|---|---|---|---|
| `openai/gpt-oss-120b` | production | `json_schema` strict and best-effort, plus json_object | ~500 tps, "81+ languages", 81.3% MMMLU. Recommended default. |
| `openai/gpt-oss-20b` | production | strict `json_schema` | faster/cheaper fallback |
| `llama-3.3-70b-versatile` | production | json_object only (no json_schema) | page names no languages; Polish/Ukrainian support unverified |
| `llama-3.1-8b-instant` | production | json_object only | weak for pl/uk (unverified) |
| `qwen/qwen3.8-27b` | preview | strict `json_schema` | thinking on by default; `reasoning_effort: "none"` disables it. Preview models may vanish at short notice. |

- Syntax: `response_format: {type:"json_schema", json_schema:{name, strict:true, schema}}`, or `{type:"json_object"}` (then the prompt must say "JSON"). Structured outputs do not support streaming or tool use.
- Recommendation: `openai/gpt-oss-120b` with strict json_schema; on 400/schema error fall back to json_object plus client-side validation. Keep client validation (and quote verification) regardless.

### 3. Free-tier rate limits
Source: https://console.groq.com/docs/rate-limits
The public page shows only base **Developer-plan** limits (it has no Free column). Free-tier numbers are unverified; the user's own org Limits page is authoritative.

| Model | RPM | RPD | TPM | TPD | Audio s/hour | Audio s/day |
|---|---|---|---|---|---|---|
| whisper-large-v3 / turbo | 20 | 2K | - | - | 7.2K | 28.8K |
| openai/gpt-oss-120b / 20b | 30 | 1K | 8K | 200K | - | - |
| qwen/qwen3.8-27b | 30 | 1K | 8K | 200K | - | - |

- Demo math: 8 clips + 1 summary per session is far under 20 RPM. The 8K TPM cap on the chat model is the real ceiling: keep the summary prompt plus transcripts well under ~6K tokens, and set `max_completion_tokens` modestly.
- 429 responses carry `retry-after` (seconds); `x-ratelimit-*` headers appear on every response. Retry once honouring it; show a friendly message.
- llama-3.3-70b / 3.1-8b limits: unverified (not on the page).

### 4. expo-audio (SDK 58) recording, and deleting the file
Sources: https://docs.expo.dev/versions/v58.0.0/sdk/audio/ , https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/

Since Groq resamples to 16 kHz mono, record at that and a speech bitrate. Values below are recommendations; whether each platform honours them is unverified (check actual file size on a device).

```ts
const OPTIONS: RecordingOptions = {
  extension: '.m4a', sampleRate: 16000, numberOfChannels: 1, bitRate: 32000,
  android: { extension: '.m4a', outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { extension: '.m4a', outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM, sampleRate: 16000 },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
};
```
- Docs' custom example uses these exact field names. The presets are 44.1 kHz stereo 128 kbps (about 16 KB/s, 4x larger than needed), so do not use `HIGH_QUALITY`.
- Web: options go straight to `MediaRecorder` and vary by browser; the presets use `audio/webm`. Safari support is not mentioned in the docs (unverified), so at runtime pick the first `MediaRecorder.isTypeSupported` of `audio/webm;codecs=opus`, `audio/mp4`, and name the upload file with the matching extension. Chrome webm may lack duration metadata (Groq did not need it; unverified). Needs HTTPS or localhost for the mic.
- Call `setAudioModeAsync({allowsRecording:true, playsInSilentMode:true})` and request permission before `prepareToRecordAsync()`; `record()` is sync, `await stop()`, then read `recorder.uri` (`string | null`).
- Default directory is `'cache'` (OS may purge); fine, since we delete explicitly.
- Delete (native, SDK 58 object API): `import { File } from 'expo-file-system'; const f = new File(uri); if (f.exists) f.delete();` (`delete()` is synchronous, `exists` is a property; no idempotent option, so guard with `exists` and try/catch inside `finally`). Legacy fallback: `import * as FS from 'expo-file-system/legacy'; await FS.deleteAsync(uri, {idempotent:true})` (the `idempotent` field name there is unverified in the docs; do not rely on it without a try/catch).
- Web: no file; `fetch(recorder.uri)` -> Blob, then `URL.revokeObjectURL`.

### 5. Groq data retention and region
Source: https://console.groq.com/docs/your-data (the /docs/legal/your-data URL is a 404)
- By default Groq "does not retain customer data for inference requests"; usage metadata (not inputs/outputs) is always collected.
- Exception: inputs/outputs may be logged temporarily for reliability troubleshooting or suspected-abuse investigation, kept up to 30 days. Batch files up to 30 days.
- Zero Data Retention (ZDR): any customer can enable it under Data Controls; it removes the 30-day reliability/abuse logging.
- Location: stored in Google Cloud Platform buckets in the **United States**; EU transfers rely on standard contractual clauses. Whether data is used for training: not stated on the page (unverified).
- Privacy note wording: demo uses test data only; production needs a DPA, ZDR enabled, and ideally EU processing (not offered per this page).

## 6. Latency tips, ranked by impact
1. **Fast transcription call**: send one request per answer right on stop; set `language`; use the m4a/webm at 16 kHz mono 32 kbps (about 4 KB/s, a 20 s answer is about 80 KB). Upload size is small, so this beats any other tweak.
2. **Skip the LLM per turn** (already decided): per-turn cost is only STT.
3. **Show the transcript the moment it returns**, and advance to the next question and start TTS-free prompt display immediately; run red-flag rules synchronously on the text.
4. **Pre-warm the summary**: when the last answer's transcript arrives, fire the summary call immediately (do not wait for a "Finish" tap); keep the prompt short and use `reasoning_effort` low (if the model exposes it).
5. **Keep the recorder prepared**: call `prepareToRecordAsync()` for the next question while the current one is transcribing, so tap-to-record is instant.
6. Reuse the HTTP connection (same origin; browsers do this automatically).

## 7. Not worth optimising in 2 hours
- Streaming STT or streaming the LLM summary (structured outputs do not support streaming; the summary call is one short call).
- Client-side transcoding/compression libraries (ffmpeg.wasm, FLAC): 16 kHz mono AAC/Opus is already tiny.
- Retry/queue/offline logic, multi-model routing, and prompt-tuning the Whisper `prompt` per specialty.

## Unverified summary
Free-tier limits for exact org; llama language support for pl/uk; Whisper prompt gain for pl/uk; whether iOS/Android honour 16 kHz and 32 kbps; Safari webm support; Groq training use.
