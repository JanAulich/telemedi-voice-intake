# Why this, what I built, what I cut

## The problem I picked
**Voice pre-consultation intake in the patient's own language, ending in a structured card for the doctor.**

Telemedi (from public sources, not verified with the company) sells teleconsultations to insurers and assistance companies and serves patients in several languages, many of them abroad. That combination produces a specific cost: the doctor's short slot starts with basic fact gathering, sometimes across a language barrier, with no history on screen. The insurer pays for those minutes.

A voice intake attacks that cost directly:
- The patient talks in Polish, Ukrainian or English, in whatever state they are in. No form to type on a phone while unwell.
- The doctor opens the call to a SAMPLE + OPQRST card in Polish or English, a layout clinicians already read at a glance, plus a FHIR R4 bundle that a real system could ingest.

Assumption to validate with Telemedi: how many minutes of a consultation go to intake today, and how often language is a problem. I did not have that data.

## Options I rejected
| Idea | Why not |
|---|---|
| Medication reminders by voice | Generic, crowded, little link to Telemedi's B2B model |
| Symptom diary | Useful for chronic care, not where Telemedi's paying customers are |
| Test-result navigation | Needs real results and carries privacy and regulatory weight |
| Voice triage with urgency scoring | Telemedi's core business and medical-device territory; not something to fake in two hours |

## What I built
One flow, end to end: enter your Groq key → pick languages → answer 8 short questions by voice → (emergency screen if a red flag is heard) → doctor card with FHIR JSON.

Decisions that matter:
- **Safety does not depend on the model.** Red flags (chest pain, stroke signs, breathing difficulty, anaphylaxis, suicidal statements, severe bleeding, loss of consciousness) are deterministic rules per language, checked on every answer and every edit.
- **No invented facts reach the doctor.** Every fact carries a verbatim quote from the transcript and a "patient said / inferred" tag. Facts whose quote cannot be found are dropped and counted on the card.
- **Fast turns.** Questions are pre-written per language, so a turn waits only for speech-to-text. The LLM runs once, at the end.
- **Nothing is kept.** Patient data lives in memory only, audio is deleted right after transcription, and the session is wiped on finish, reset or after two minutes in the background. Only the API key may be stored, in the device keychain, and only if the user opts in.
- **Measured, not eyeballed.** Ten scripted patients (Polish, Ukrainian, English, including red-flag and negation cases) with offline red-flag tests and scored LLM tests against the PRD targets.

## What I cut and why
- **Diagnosis, urgency score, advice.** Intake only. Anything more turns this into a medical device.
- **Accounts, backend, database.** Not needed to test the idea, and storing nothing is the strongest privacy answer.
- **Spoken questions (text-to-speech).** Nice, but adds a provider and latency; the question is shown large on screen.
- **Adaptive follow-up questions by the LLM.** Better interviews, but per-turn model latency and harder safety review. Fixed questions first.
- **Strict FHIR validation and medical coding (ICD/SNOMED).** Coding is the doctor's job; validation is a production task.
- **More languages.** Three show the point; adding more is data, not architecture.

## Cost vs quality
This is a proof of concept, so API use is hard-capped: one summary call per session, at most 12 transcriptions, clips over 60 s rejected, one retry per call.

For a real product, cost only matters if quality holds: an intake that is often wrong costs the doctor more time than it saves. So cheaper models are behind a quality gate, measured on the same scenario set:
- Red-flag detection is deterministic and model-independent, so it never degrades with a cheaper model.
- A cheaper summary model is acceptable only if field capture stays at least 90% and within 5 points of the larger model, with zero unsupported facts reaching the doctor.
- Speech-to-text (Whisper turbo vs large-v3) cannot be judged on scripted text; it needs recordings from native Polish and Ukrainian speakers, scored by word error rate and by downstream field capture. That is the next experiment, not something to guess.

Measured on the 10 scripted patients (typed text, so speech-to-text is excluded):

| Summary model | Field capture | Severity / allergies / meds correct | Unsupported facts reaching the card | Mean summary time | LLM cost per intake |
|---|---|---|---|---|---|
| openai/gpt-oss-120b | 93.0% | 90% / 100% / 100% | 0 of 108 | 3.2 s | ~$0.0011 |
| openai/gpt-oss-20b | 94.7% | 90% / 100% / 100% | 0 of 104 | 1.3 s | ~$0.0004 |

The smaller model passes the gate on this set, at 2.5× faster and ~60% cheaper. Ten scenarios is a coarse signal, so the product keeps 120b until a larger set confirms it. Part of the capture loss on both models came from a grounding bug (Polish filler "no" read as a negation, dropping valid facts), fixed after this run; capture should be somewhat higher on a re-run.

Whole intake today is roughly $0.004 (speech-to-text is ~80% of it, billed at a 10 s minimum per answer); about $0.0015 with the cheaper models. I kept one transcription per answer anyway: batching would save only ~8% and remove the per-answer red-flag check.

## What production would need
A data-processing agreement and EU-hosted processing for speech and LLM calls (Groq processes in the US and, without zero-data-retention enabled, may keep request logs for up to 30 days for abuse monitoring — fine for test data, not for patients), clinician sign-off on the red-flag list, a pilot measuring intake minutes saved, and integration with Telemedi's consultation system.

## How it was built
With Claude Code, as a coordinated team rather than one long chat:
- The coordinating session (Sonnet at first, switched to Opus once the plan was set) wrote the product brief, the PRD, a shared typed contract, a mock engine and a file-ownership plan, so four agents could work in parallel without touching the same files.
- Four Sonnet agents: UI, engine, evaluation set, and research (current Groq model IDs, recording settings, data retention, then API cost).
- Research changed decisions: the cheaper Whisper model, strict JSON-schema output, smaller recordings, and keeping one transcription per answer despite the 10 s minimum billing.
- The engine agent stalled before wiring its platform layer; the coordinator finished those four files.
- The evaluation set caught a real safety miss ("thinking about ending my life" did not fire) and several false alarms on denials, plus a grounding bug with the Polish filler "no". The coordinator fixed all three and added regression tests, including a guard so "I'm not sure, maybe chest pain" is never read as a denial.

Full logs of the coordinator and all four agents are attached.

## Verified
- Speech-to-text: one live Polish clip sent through the engine's own Groq client; transcript correct.
- Full flow run in the browser with a real Groq key (answers typed, since the test browser had no microphone): Polish patient, 8 answers, one summary call, doctor card with every SAMPLE/OPQRST field grounded in the patient's words, FHIR bundle, wipe. After the wipe, localStorage, sessionStorage, cookies and IndexedDB were empty.
- Ukrainian chest-pain answer → emergency screen immediately, with no API call.
- 178 offline tests pass (red-flag recall and negation in pl/en/uk, quote grounding, call limits); the LLM eval above ran against Groq.
- Models: `whisper-large-v3-turbo` for speech-to-text, `openai/gpt-oss-120b` with strict JSON schema for the summary.

## Known limitations
- Not verified: real microphone recording (the test browser had no mic) and iOS/Android devices. The code paths exist; they need a manual run.
- Speech-to-text quality on Polish/Ukrainian medical vocabulary is unmeasured (needs native-speaker recordings).
- Red-flag rules are keyword-based; they were tested on ~50 phrasings, not validated by a clinician.
- The model sometimes produces a severity value for "I don't know"; it is shown with its quote, so the doctor sees the source.

Screenshots: `docs/screenshots/`.
