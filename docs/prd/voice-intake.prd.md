# Voice Pre-Consultation Intake

## Problem
Patients of teleconsultation providers that serve insurers and assistance companies are often abroad, stressed, and speak a different language from the doctor. Doctors spend part of a short slot gathering basic facts (complaint, onset, severity, medications, allergies) with no history and possibly through a language barrier. Leaving it unsolved costs doctor minutes per case, which the paying insurer feels, and risks missed facts.

## Evidence
- Assumption — needs validation via interviews with Telemedi doctors and ops: share of a consultation slot spent on intake (working guess 2–4 of ~10 minutes).
- Assumption — needs validation via Telemedi partner data: how often a language barrier forces an interpreter or a rebooking.
- Observed (third-party directories, unverified): Telemedi sells to insurers and assistance firms and serves patients in 8 languages.

## Users
- **Primary**: a patient who has just contacted an insurer or assistance line while abroad or outside their native language, with an acute but non-emergency complaint.
- **Secondary**: the teleconsultation doctor, who needs a trustworthy summary at the start of the slot.
- **Not for**: emergencies (the product must hand them off, not handle them), diagnosis or triage decisions, and chronic-care follow-up.

## Hypothesis
We believe **a voice intake in the patient's own language that ends in a structured, provenance-tagged summary in the doctor's language** will **cut time spent on fact gathering and reduce missed facts** for **teleconsultation patients and doctors**.
We'll know we're right when **summaries capture at least 90% of required fields correctly on scripted scenarios, every scripted urgent case is escalated, and no summary fact is absent from the transcript**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Required-field capture | ≥ 90% | Scripted scenario set, scored against expected fields |
| Red-flag recall | 100% | Scripted urgent scenarios |
| Unsupported facts in summary | 0 | Check each summary fact against the transcript |
| Turn latency (speech to next question) | ≤ ~3 s | Timed on the scenario set |
| Intake minutes saved per case | TBD — needs validation via a pilot with real doctors | Not measured in this task |

## Scope
**MVP** — One end-to-end flow. The user brings their own API keys. They choose a language, answer a short fixed interview by voice, and see an automatic escalation screen if an urgent symptom is mentioned. The answers are stored as structured data in a standard clinical exchange format, and the doctor sees them rendered as a familiar clinical intake card in which each fact is marked as stated by the patient or inferred, plus an editable transcript.

**Out of scope**
- Diagnosis, urgency scoring, treatment advice — the product is intake only, and anything else raises regulatory risk.
- Accounts, a hosted backend, real patient data — not needed to test the hypothesis.
- Integration with Telemedi systems — cannot be validated from outside.
- Other voice flows (reminders, symptom diary, results) — one finished flow beats several started ones.
- Spoken output from the interviewer — nice to have, cut first if time runs short.

## Delivery Milestones
| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Working intake flow | A person can complete the interview by voice and receive the summary | pending | — |
| 2 | Safety layer | Urgent symptoms trigger the escalation screen on every turn | pending | — |
| 3 | Evidence | A scenario set and results show the metrics above | pending | — |
| 4 | Write-up | Documented why-this, what was cut, and screenshots | pending | — |

## Open Questions
- [ ] Which languages must be supported for the demo — two or three, and which?
- [ ] Is the summary language fixed (Polish or English) or chosen by the doctor?
- [ ] Which exact symptoms count as red flags, and who signs off the list?
- [ ] Can the app run as a web build if a phone is not available for the demo?

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Summary invents or omits a symptom | Medium | High | Provenance tags, editable transcript, zero-unsupported-facts check |
| Perceived as a diagnostic device | Medium | High | Intake only, stated in the write-up |
| Speech recognition fails on medical terms or accents | Medium | Medium | Transcript visible and editable; test with non-Polish samples |
| Sensitive data sent to third-party providers | Medium | Medium | Test data only; note production needs a data-processing agreement |
| Scope creep inside two hours | High | Medium | One flow; spoken output optional |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
