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

<!-- TODO: insert measured 120b vs 20b table from eval/results.md -->

## What production would need
A data-processing agreement and EU-hosted processing for speech and LLM calls (Groq processes in the US and, without zero-data-retention enabled, may keep request logs for up to 30 days for abuse monitoring — fine for test data, not for patients), clinician sign-off on the red-flag list, a pilot measuring intake minutes saved, and integration with Telemedi's consultation system.

## How it was built
Coordinated with Claude Code: one Opus session wrote the brief, PRD, shared contract and file-ownership plan, then four Sonnet agents worked in parallel on the engine, UI, evaluation set and a fact-checking research note. Full logs are attached.

<!-- TODO after integration: screenshots, eval numbers, model IDs, known limitations -->
