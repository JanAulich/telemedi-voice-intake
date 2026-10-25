# Coordination plan

Coordinator: the main session (Opus). Workers: four parallel Sonnet agents.
Requirements: `docs/prd/voice-intake.prd.md`. Brief: `docs/PRODUCT-BRIEF.md`.

## Hard requirements (from the Telemedi brief)
1. React Native + Expo (SDK 58, TypeScript). Must run with `npx expo start --web` for the demo; iOS/Android via Expo Go is a bonus.
2. At least one external AI service: Groq (Whisper speech-to-text + chat LLM), called with plain `fetch`, no SDK.
3. The user enters their own API key in the app.
4. One end-to-end flow: keys → language → voice interview → (red-flag escalation) → doctor card.
5. Documented "why this" and "what was cut" (coordinator writes `docs/WHY.md`).

## Data rule: nothing patient-related outlives the session
- Turns, transcripts, summary and FHIR bundle live in memory only (engine instance + React state).
- Every audio file is deleted right after transcription, including on failure.
- No AsyncStorage, files, SecureStore, `console.log` or analytics for patient data.
- `engine.dispose()` runs when the user finishes, resets, or the app is in the background for more than 2 minutes.
- API keys are the only thing persisted, in the keychain via `expo-secure-store`, and only when the user ticks "Remember keys" (default off). On web, keys are never persisted.
- Production note for WHY.md: real use needs a data-processing agreement and EU processing; Groq is used here with test data only.

## File ownership (no one edits another owner's files)
| Owner | Paths | Notes |
|---|---|---|
| Coordinator | `src/contract/**`, `docs/COORDINATION.md`, `docs/WHY.md`, `docs/prd/**` | Contract changes go through the coordinator |
| UI worker | `src/app/**`, `src/ui/**`, `App.tsx`, `index.ts`, `app.json`, `package.json` deps, `assets/**` | Only worker allowed to add dependencies (`npx expo install`) |
| Engine worker | `src/engine/**` | No new dependencies: uses `fetch`, `expo-file-system`, `expo-secure-store` |
| Eval worker | `eval/**` | Uses vitest (installed). Imports only `src/engine/index.ts` and `src/contract/**` |
| Research worker | `docs/research/**` | Writes no code |

## Shared interfaces
- `src/contract/types.ts`: all types, `IntakeEngine`, `KeyStore`.
- `src/contract/mockEngine.ts`: offline engine the UI uses until the real one exists.
- The engine worker exports from `src/engine/index.ts`:
  - `createIntakeEngine: CreateIntakeEngine`
  - `keyStore: KeyStore`
  - `checkRedFlags(text: string, turnId: string): RedFlagHit | null` (pure, no network; used by eval)
- The UI imports the engine only from `src/engine` (falling back to the mock when no key is set) and never reaches into engine internals.

## Engine design decisions (fixed)
- Interview questions are fixed and pre-written per language (pl, en, uk). No LLM call per turn, so per-turn latency is speech-to-text only.
- Red flags are deterministic keyword/regex rules per language, run on every answer and edit. No model involved.
- One LLM call at the end: JSON output that fills `IntakeSummary` in the doctor's language with a verbatim `quote` per fact. The engine then drops any fact whose quote is not found in the transcript and counts it in `droppedUnsupported`.
- FHIR R4 subset built deterministically from the summary: QuestionnaireResponse, Condition, AllergyIntolerance, MedicationStatement, Provenance. No ICD/SNOMED coding.

## Done means
- `npx tsc --noEmit` passes. `npm test` passes.
- Each worker reports what they built, what they skipped, and anything that needs a contract change.
