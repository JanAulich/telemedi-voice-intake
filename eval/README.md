# Evaluation set

Scripted, invented patients and the tests that score the voice intake against the PRD success metrics
(`docs/prd/voice-intake.prd.md`). Only `src/engine/core` and `src/contract` are imported; no expo modules.

## Run

```bash
# Offline (deterministic red-flag rules, scenario shape). No key, no network.
npx vitest run eval

# Offline plus the LLM summary eval (20 Groq chat calls: 10 scenarios x 2 summary models).
GROQ_API_KEY=gsk_... npx vitest run eval
```

Call budget (proof of concept): scenarios run sequentially, one summary call per scenario per model, no
eval-level re-runs (the engine itself retries once on 429/5xx). Speech-to-text is never called (answers go in via
`submitText`). The test prints the total number of HTTP requests to Groq at the end and `results.md` lists them
by endpoint. `EVAL_COMPARE_MODELS` (comma separated, default `openai/gpt-oss-20b`, empty string for none)
changes the comparison models; each one costs 10 more calls.

Without `GROQ_API_KEY`, `eval/summary.test.ts` is skipped (`describe.skipIf`) and `eval/results.md` is not touched.
With the key, it overwrites `eval/results.md` (aggregate vs targets, then one table per scenario).
Use test keys only; scenarios contain invented data, never real patient data.

## Layout

| Path | Purpose |
|---|---|
| `eval/scenarios/*.json` | 10 patients: id, languages, persona, 8 answers keyed by `QuestionId`, `expected` |
| `eval/redflags.test.ts` | Offline: `checkRedFlags` on every scenario answer plus 32 single utterances (pl/en/uk, positives and negations) |
| `eval/summary.test.ts` | LLM: `createCoreEngine` + `submitText`, scoring, writes `results.md` |
| `eval/lib/` | Scenario loader/types, scoring and quote audit, report renderer |

## Scenario mix

| Id | Patient -> doctor | Case |
|---|---|---|
| 01-pl-chest-pain-arm | pl -> pl | RED FLAG chest_pain (radiates to left arm) |
| 02-uk-stroke-signs | uk -> pl | RED FLAG stroke_signs (numb arm, drooping face, slurred speech) |
| 03-en-suicidal-statement | en -> en | RED FLAG suicidal_ideation (in the symptoms answer) |
| 04-pl-negation-headache | pl -> en | Negation: "nie mam bólu w klatce, nie mam duszności, nie zemdlałem" must not fire |
| 05-en-negation-sore-throat | en -> pl | Negation: "no chest pain, no shortness of breath, haven't fainted" must not fire |
| 06-uk-dont-know | uk -> en | "I don't know" to 5 of 8 questions; `missing` must list them |
| 07-en-allergy-multi-meds | en -> pl | Two allergies (penicillin, latex), three medications |
| 08-pl-skin-rash | pl -> pl | Routine; pollen allergy mention must not read as anaphylaxis |
| 09-uk-gastro-travel | uk -> en | Routine; penicillin allergy, two medications |
| 10-pl-sprained-ankle | pl -> en | Routine; self-corrected pain score (8, no, 7), aspirin allergy |

Languages: 4 pl, 3 uk, 3 en patients.

## Expected-field format

`expected` in each JSON file:

- `redFlag` / `redFlagQuestionId`: red flag id and the answer that carries it, or `null`.
- `chiefComplaint`, `onset`: any-of keyword lists, matched case-insensitively against the fact `value` plus its patient-language `quote`. `onset: null` means onset is expected in `missing`.
- `severityScore`: expected 0-10 `score`, or `null`.
- `allergies`, `medications`: one entry per expected item, each a list of any-of keywords. `[]` means "none reported", not scored beyond `missing`.
- `missing`: exact set of `QuestionId`s expected in `summary.missing`.

## Metrics

- Required-field capture = passed checks / total checks across all scenarios (chief complaint, onset, severity, each allergy, each medication, `missing` set). Target >= 90%.
- Red-flag recall: engine `submitText` raised the expected flag. Target 100%. False positives on non-urgent scenarios: target 0.
- Unsupported facts: independent check that every fact's `quote` is a normalised substring of some transcript turn (target 0 remaining). `droppedUnsupported` from the engine is reported separately as informational.
- Latency: `finish()` wall time per scenario; mean `submitText` turn latency. The PRD's 3 s target is speech-to-next-question and needs a real-audio run, since text mode skips Whisper.
- Model comparison (`results.md`, "Summary model comparison"): side by side field capture, severity / allergy / medication correctness, unsupported facts dropped and reaching the card, mean `finish()` latency, measured tokens, and cost per intake from `docs/research/cost.md` prices. Gate for a cheaper model: capture >= 90%, within 5 points of the larger model, zero unsupported facts on the card. The engine hard-codes `SUMMARY_MODEL`, so the comparison model is called through `summarize({ model })` + `verifyQuotes()` (the two steps `finish()` runs); the reference model goes through `createCoreEngine().finish()`.
- A scenario's red-flag expectation is scored per turn, but the interview is not stopped at the flag (the whole script is submitted so the summary can still be scored).

## Next experiment: speech-to-text model comparison (not run)

`whisper-large-v3-turbo` vs `whisper-large-v3` needs real recordings. This set has none, and synthesised
audio would not show how the models cope with accents, hesitation and noise, so it was not produced.

Method:

1. Have native speakers (at least 2 per language: pl, uk, en) record the 10 scenarios' answers as separate
   clips, in a quiet room and in a noisy one, on the phone they would use. Invented data only.
2. Transcribe every clip with each model through `transcribe()` (same language hint and vocabulary prompt), one
   call per clip per model: about 80 clips x 2 models x 2 conditions = 320 calls, so batch it or run it in stages.
3. Compute word error rate against the scripted text (normalised as in `eval/lib/score.ts`), per language and
   per model, plus the error rate on medication and allergy words alone.
4. Feed each transcript through the same summary step and score it with `scoreSummary`: downstream field
   capture, red-flag recall on the transcribed red-flag answers (the deterministic rules run on transcripts, so
   a mis-heard "klatka" matters), and unsupported facts.
5. Decision rule: use turbo only if downstream capture is >= 90% and within 5 points of v3, red-flag recall
   stays 100%, and no language regresses alone. Cost: turbo saves about 64% of speech-to-text (see
   `docs/research/cost.md`).
