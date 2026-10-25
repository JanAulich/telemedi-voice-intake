# PRODUCT-BRIEF: Voice pre-consultation intake (Telemedi task)

Status: hypothesis. Telemedi facts come from third-party directories, not their site. Verify before citing.

## 1. Who is this for?
- Primary user: a patient who has just called an insurer or assistance hotline while abroad or outside Polish, is stressed, and speaks a language other than the doctor's. Example: a Ukrainian-speaking traveler in Poland with a child who has a fever.
- Buyer: the insurer or assistance partner (AXA, Allianz, Generali, PZU class). They pay per case and want lower handling cost and lower liability.
- Second user: the Telemedi doctor, who has a short slot and no patient history.

## 2. What is the pain?
- Doctor minutes in a teleconsultation go to basic fact gathering (onset, severity, meds, allergies).
- A language barrier makes this slower and less reliable.
- Today the patient fills a form or repeats everything live. Hypothesis, not measured: 2-4 minutes of a roughly 10-minute slot.
- Unknown and worth asking Telemedi: how much of the slot intake takes, and how often a language barrier forces an interpreter or a rebooking.

## 3. Why now?
- Speech-to-text handles many languages well and is cheap (Groq/Whisper, Deepgram free tiers).
- LLMs can run a constrained interview and write a structured summary.
- Telemedi's multilingual B2B positioning fits, and they appear to be hiring AI roles.

## 4. 10-star version
Patient speaks in any language, gets a safe adaptive interview, urgent cases are escalated within seconds, and the doctor opens a consultation to a verified summary already in the EHR. It uses patient history, learns per-insurer protocols, and logs outcomes for audit.

## 5. MVP (this task)
One end-to-end flow:
1. User enters their own API keys (stored on device).
2. Pick a language. Push-to-talk answers to 6-8 fixed interview topics.
3. A deterministic red-flag check runs on every turn (chest pain, stroke signs, suicidal statements, severe breathing trouble, anaphylaxis) and shows a "call 112" screen.
4. Final screen: structured summary in the doctor's language, with each fact marked "patient said" or "model inferred", plus the editable transcript.

Proof of thesis: on 5-10 scripted scenarios (two red-flag cases, one non-Polish language), the summary captures the required fields and every red flag fires.

## 6. Anti-goals
- No diagnosis, no urgency score, no treatment advice.
- No accounts, backend or real patient data.
- No integration with Telemedi systems.
- No second flow (reminders, diary, results).
- Voice synthesis for the interviewer is optional and cut first.

## 7. How do we know it works?
Use measurable checks on the scenario set, not impressions:
- Field capture rate: share of required fields (complaint, onset, severity, meds, allergies) present and correct. Target at least 90%.
- Red-flag recall on the scripted urgent cases: 100%, with no model dependency.
- Hallucination check: zero facts in the summary that are absent from the transcript.
- Turn latency under about 3 s (speech-to-text plus LLM).
Production metrics, if it were real: doctor intake minutes saved per case, completion rate, escalation false-negative rate.

## Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Model misses or invents a symptom | High | Provenance tags; the doctor confirms; rule-based red flags |
| Seen as a diagnostic or triage device (regulatory) | High | Intake only, no assessment, stated plainly in the write-up |
| Poor recognition of medical terms or accents | Medium | Transcript shown and editable; test on non-Polish samples |
| Sensitive data sent to third-party APIs | Medium | Test data only; keys on device; note that production needs a DPA and EU processing |
| Scope creep in 2 hours | Medium | One flow, TTS optional |

## Recommendation: GO, with narrow scope
The idea fits the buyer, is feasible in the time, and the safety layer shows judgment. The biggest unknown is the real intake time and how Telemedi handles language today, so state it as an assumption in the write-up.

Next step: hand off to `product-capability` or go straight to scaffolding (Expo, Groq for speech-to-text and LLM) and write `WHY.md` from sections 2, 5 and 6.
