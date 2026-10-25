# Voice pre-consultation intake

A patient answers a short intake by voice in Polish, Ukrainian or English. Urgent symptoms trigger an emergency screen immediately. The doctor receives a SAMPLE + OPQRST card in Polish or English, where every fact is tied to the patient's own words, plus a FHIR R4 bundle.

React Native + Expo (SDK 58, TypeScript). AI: Groq (Whisper speech-to-text, gpt-oss summary), with your own API key.

**Why this problem, what I built and what I cut:** [docs/WHY.md](docs/WHY.md)

## Run
```bash
npm install
npx expo start --web
```
Open the page, paste a Groq API key (free at console.groq.com), or continue without a key to see the flow in demo mode. For repeated local testing, copy `.env.example` to `.env.local` (git-ignored) and set the key there to pre-fill the field; do not use this for a published build. iOS/Android: `npx expo start` and open in Expo Go.

## Test
```bash
npm test
```
Offline tests (red flags, quote grounding, call limits). The LLM eval needs a key: `GROQ_API_KEY=... npx vitest run eval` (see [eval/README.md](eval/README.md)).

## Privacy
Patient data lives only in memory for the session. Recordings are deleted right after transcription. Nothing is written to storage, files or logs. The API key is kept in the device keychain only if you tick "Remember keys", and never on the web.

## Layout
| Path | What |
|---|---|
| `src/contract/` | Shared types and the engine interface |
| `src/engine/core/` | Interview, red-flag rules, Groq client, summary, quote grounding, FHIR (pure TS, runs in Node) |
| `src/engine/platform/` | Audio upload and deletion, key storage |
| `src/ui/` | Screens: keys, setup, interview, escalation, doctor card |
| `eval/` | 10 scripted patients, red-flag tests, LLM eval and model comparison |
| `docs/` | Brief, PRD, coordination plan, research, screenshots |
