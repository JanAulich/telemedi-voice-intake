# Eval results

Generated 2026-10-25T14:11:44.538Z by `eval/summary.test.ts`. 10 scenarios, invented data, text input (`submitText`, no speech-to-text), live Groq calls.

> Note (2026-10-25): the red-flag rows (recall 66.7%, 2 false positives) were measured against an earlier `redFlags.ts` and are stale. The offline suite (`eval/redflags.test.ts`) passes 94/94 on the current engine, i.e. 100% recall and 0 false positives. Summary, cost and latency metrics are unaffected (red flags are local, no LLM). Capture is depressed by one engine bug: `verifyQuotes` treats the Polish filler "no" as an English negator and drops valid quotes that follow it (scenario 01 scores 3/6 on both models). Call count: this table is the third run; two earlier runs (35 requests, mostly 429s, then 20) were discarded for rate-limit pacing and latency-timing fixes, so about 75 requests were made in total.

## API call budget

One summary call per scenario per model, scenarios run sequentially, no eval-level re-runs. **Total HTTP requests to Groq: 20** (20 x /openai/v1/chat/completions). Non-2xx responses: 0. The engine itself retries once on 429/5xx, so the count can exceed scenarios x models.

## Aggregate vs PRD targets (reference model)

Reference: `openai/gpt-oss-120b`, called through `createCoreEngine().finish()`.

| Metric | Target | Result | Status |
|---|---|---|---|
| Required-field capture | >= 90% | 93.0% (53/57) | PASS |
| Red-flag recall (engine, per turn) | 100% | 66.7% | FAIL |
| Red-flag false positives (non-urgent scenarios) | 0 | 2 | FAIL |
| Unsupported facts remaining in summary (independent check) | 0 | 0 of 108 facts | PASS |
| Facts dropped by the engine as unsupported | informational | 4 | n/a |
| Per-turn latency, text mode | <= ~3 s (speech to next question) | mean 0.00 s (local only, excludes speech-to-text) | PASS |

Per-turn latency excludes Whisper, so the PRD latency target needs a real-audio run to confirm.

## Summary model comparison

Cost uses measured token usage from the API responses and the prices in docs/research/cost.md. The engine hard-codes `SUMMARY_MODEL` and does not expose a per-session model option, so the non-reference models are called with `summarize({ model })` followed by `verifyQuotes()`, the same two steps the engine runs inside `finish()`.

| Metric | `gpt-oss-120b` | `gpt-oss-20b` |
|---|---|---|
| Call path | `createCoreEngine().finish()` | `summarize({ model })` + `verifyQuotes()` |
| Scenarios with a summary | 10/10 | 10/10 |
| Field capture | 93.0% (53/57) | 94.7% (54/57) |
| Severity correct | 90.0% | 90.0% |
| Allergies correct | 100.0% | 100.0% |
| Medications correct | 100.0% | 100.0% |
| Unsupported facts dropped by engine | 4 | 5 |
| Unsupported facts reaching the card | 0 of 108 | 0 of 104 |
| Mean finish() latency | 3.15 s | 1.31 s |
| Max finish() latency | 4.44 s | 1.92 s |
| Mean tokens in / out | 2166 / 1264 | 2166 / 843 |
| LLM cost per intake | $0.00108 | $0.00042 |
| LLM + STT (turbo) per intake | $0.00224 | $0.00158 |

STT cost per intake (`whisper-large-v3-turbo`, $0.00116) is the cost.md assumption, not measured here.

Quality gate for a cheaper model: field capture >= 90%, within 5 points of the larger model, zero unsupported facts reaching the card.

- `gpt-oss-120b` (reference): meets the absolute gate (capture 93.0%, 0 unsupported on the card).
- `gpt-oss-20b`: **ACCEPTABLE** vs `gpt-oss-120b`.

10 scenarios give a coarse signal: one missed field moves capture by roughly 2 points. Treat a pass as "no evidence of a regression", not proof, and re-run on more scenarios before switching.

## Scenario overview

### `gpt-oss-120b`

| Scenario | Lang (patient -> doctor) | Capture | Red flag expected / fired | Facts | Unsupported on card | Dropped | finish() |
|---|---|---|---|---|---|---|---|
| 01-pl-chest-pain-arm | pl -> pl | 3/6 | chest_pain / chest_pain@chief_complaint | 9 | 0 | 3 | 4.44 s |
| 02-uk-stroke-signs | uk -> pl | 6/6 | stroke_signs / stroke_signs@chief_complaint | 14 | 0 | 0 | 3.88 s |
| 03-en-suicidal-statement | en -> en | 5/5 | suicidal_ideation / none | 9 | 0 | 0 | 2.09 s |
| 04-pl-negation-headache | pl -> en | 5/5 | none / loss_of_consciousness@associated_symptoms | 12 | 0 | 0 | 2.74 s |
| 05-en-negation-sore-throat | en -> pl | 5/5 | none / loss_of_consciousness@associated_symptoms | 9 | 0 | 0 | 2.59 s |
| 06-uk-dont-know | uk -> en | 2/3 | none / none | 6 | 0 | 0 | 2.27 s |
| 07-en-allergy-multi-meds | en -> pl | 9/9 | none / none | 17 | 0 | 0 | 3.75 s |
| 08-pl-skin-rash | pl -> pl | 5/5 | none / none | 12 | 0 | 1 | 3.52 s |
| 09-uk-gastro-travel | uk -> en | 7/7 | none / none | 10 | 0 | 0 | 3.05 s |
| 10-pl-sprained-ankle | pl -> en | 6/6 | none / none | 10 | 0 | 0 | 3.14 s |

### `gpt-oss-20b`

| Scenario | Lang (patient -> doctor) | Capture | Red flag expected / fired | Facts | Unsupported on card | Dropped | finish() |
|---|---|---|---|---|---|---|---|
| 01-pl-chest-pain-arm | pl -> pl | 3/6 | chest_pain / chest_pain@chief_complaint | 9 | 0 | 4 | 1.92 s |
| 02-uk-stroke-signs | uk -> pl | 6/6 | stroke_signs / stroke_signs@chief_complaint | 10 | 0 | 0 | 1.47 s |
| 03-en-suicidal-statement | en -> en | 5/5 | suicidal_ideation / none | 9 | 0 | 0 | 1.54 s |
| 04-pl-negation-headache | pl -> en | 5/5 | none / loss_of_consciousness@associated_symptoms | 15 | 0 | 0 | 0.92 s |
| 05-en-negation-sore-throat | en -> pl | 5/5 | none / loss_of_consciousness@associated_symptoms | 11 | 0 | 0 | 1.46 s |
| 06-uk-dont-know | uk -> en | 3/3 | none / none | 5 | 0 | 0 | 1.25 s |
| 07-en-allergy-multi-meds | en -> pl | 9/9 | none / none | 11 | 0 | 0 | 1.50 s |
| 08-pl-skin-rash | pl -> pl | 5/5 | none / none | 11 | 0 | 0 | 0.82 s |
| 09-uk-gastro-travel | uk -> en | 7/7 | none / none | 10 | 0 | 0 | 1.08 s |
| 10-pl-sprained-ankle | pl -> en | 6/6 | none / none | 13 | 0 | 1 | 1.14 s |

## gpt-oss-120b / 01-pl-chest-pain-arm

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | FAIL | null |
| onset | PASS | godzinę temu podczas wchodzenia po schodach |
| severity | FAIL | null |
| medication[0] enalapril | PASS | enalapril, atorwastatyna |
| medication[1] atorwastatyn | PASS | enalapril, atorwastatyna |
| missing | FAIL | got [chief_complaint, severity] want [] |

## gpt-oss-120b / 02-uk-stroke-signs

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | Nagle zdrętwiała prawa ręka, twarz jest przekrzywiona, mowa jest niewyraźna, język nie słucha się |
| onset | PASS | Pół godziny temu, podczas przygotowywania obiadu |
| severity | PASS | score=3 |
| medication[0] losartan | PASS | lозартан, aspiryna rano |
| medication[1] aspiryn | PASS | lозартан, aspiryna rano |
| missing | PASS | got [] want [] |

## gpt-oss-120b / 03-en-suicidal-statement

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | can't sleep |
| onset | PASS | about three weeks ago after losing job |
| severity | PASS | score=7 |
| medication[0] melatonin | PASS | melatonin |
| missing | PASS | got [] want [] |

## gpt-oss-120b / 04-pl-negation-headache

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | headache, dull pain in front |
| onset | PASS | started yesterday evening after a day at the computer |
| severity | PASS | score=3 |
| medication[0] ibuprofen | PASS | ibuprofen 2 tablets |
| missing | PASS | got [] want [] |

## gpt-oss-120b / 05-en-negation-sore-throat

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | bardzo ból gardła i lekki kaszel |
| onset | PASS | około trzy dni temu |
| severity | PASS | score=4 |
| medication[0] paracetamol | PASS | paracetamol, kilka razy dziennie |
| missing | PASS | got [] want [] |

## gpt-oss-120b / 06-uk-dont-know

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | Abdominal pain, lower region |
| severity | PASS | score=null |
| missing | FAIL | got [associated_symptoms, medications, onset, past_history] want [associated_symptoms, medications, onset, past_history, severity] |

## gpt-oss-120b / 07-en-allergy-multi-meds

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | ból w dolnej części pleców |
| onset | PASS | tydzień temu podczas podnoszenia pudełek przy przeprowadzce |
| severity | PASS | score=6 |
| allergy[0] penicylin | PASS | penicylina – wysypka; lateks – swędzenie |
| allergy[1] lateks | PASS | penicylina – wysypka; lateks – swędzenie |
| medication[0] metformin | PASS | metformin, dwa razy dziennie; lisinopril; ibuprofen, trzy razy dziennie |
| medication[1] lizynopryl | PASS | metformin, dwa razy dziennie; lisinopril; ibuprofen, trzy razy dziennie |
| medication[2] ibuprofen | PASS | metformin, dwa razy dziennie; lisinopril; ibuprofen, trzy razy dziennie |
| missing | PASS | got [] want [] |

## gpt-oss-120b / 08-pl-skin-rash

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | wysypka na przedramieniu, silne swędzenie |
| onset | PASS | 2 dni temu po pobycie w lesie na grzybach |
| severity | PASS | score=5 |
| allergy[0] pyłk | PASS | pyłki; brzoza |
| missing | PASS | got [] want [] |

## gpt-oss-120b / 09-uk-gastro-travel

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | Nausea and watery stool |
| onset | PASS | Evening before yesterday after dinner at a restaurant |
| severity | PASS | score=4 |
| allergy[0] penicillin | PASS | Penicillin allergy |
| medication[0] charcoal | PASS | Activated charcoal and contraceptive pills |
| medication[1] contracept | PASS | Activated charcoal and contraceptive pills |
| missing | PASS | got [] want [] |

## gpt-oss-120b / 10-pl-sprained-ankle

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | Sprained ankle, swollen and painful when walking |
| onset | PASS | Yesterday evening after tripping while returning home |
| severity | PASS | score=7 |
| allergy[0] aspirin | PASS | Allergic to aspirin (causes rash) |
| medication[0] ketonal | PASS | Ketonal (taken twice) |
| missing | PASS | got [] want [] |

## gpt-oss-20b / 01-pl-chest-pain-arm

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | FAIL | null |
| onset | PASS | Zaczęło się jakieś, yyy, godzinę temu, jak szedłem po schodach do hotelu. |
| severity | FAIL | null |
| medication[0] enalapril | PASS | enalapril; atorwastatynę |
| medication[1] atorwastatyn | PASS | enalapril; atorwastatynę |
| missing | FAIL | got [chief_complaint, severity] want [] |

## gpt-oss-20b / 02-uk-stroke-signs

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | Zawroty w prawej ręce, obniżone oblicze, niejasna mowa, język nie reaguje |
| onset | PASS | Pół godziny temu, gotowałam obiad |
| severity | PASS | score=3 |
| medication[0] losartan | PASS | Lozartan, aspiryna rano |
| medication[1] aspiryn | PASS | Lozartan, aspiryna rano |
| missing | PASS | got [] want [] |

## gpt-oss-20b / 03-en-suicidal-statement

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | Can't sleep |
| onset | PASS | Three weeks ago |
| severity | PASS | score=7 |
| medication[0] melatonin | PASS | Melatonin |
| missing | PASS | got [] want [] |

## gpt-oss-20b / 04-pl-negation-headache

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | headache |
| onset | PASS | since yesterday evening |
| severity | PASS | score=3 |
| medication[0] ibuprofen | PASS | ibuprofen 2 tablets |
| missing | PASS | got [] want [] |

## gpt-oss-20b / 05-en-negation-sore-throat

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | bóle gardła i kaszel |
| onset | PASS | począł się trzy dni temu |
| severity | PASS | score=4 |
| medication[0] paracetamol | PASS | paracetamol, kilka razy dziennie |
| missing | PASS | got [] want [] |

## gpt-oss-20b / 06-uk-dont-know

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | Abdominal pain |
| severity | PASS | null |
| missing | PASS | got [associated_symptoms, medications, onset, past_history, severity] want [associated_symptoms, medications, onset, past_history, severity] |

## gpt-oss-20b / 07-en-allergy-multi-meds

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | ból w dolnej części pleców |
| onset | PASS | około tygodnia temu, podnosiłem pudełka podczas przeprowadzki |
| severity | PASS | score=6 |
| allergy[0] penicylin | PASS | penicylina, lateks |
| allergy[1] lateks | PASS | penicylina, lateks |
| medication[0] metformin | PASS | metformina, lisinopril, ibuprofen |
| medication[1] lizynopryl | PASS | metformina, lisinopril, ibuprofen |
| medication[2] ibuprofen | PASS | metformina, lisinopril, ibuprofen |
| missing | PASS | got [] want [] |

## gpt-oss-20b / 08-pl-skin-rash

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | wysypka na przedramieniu |
| onset | PASS | Od dwóch dni |
| severity | PASS | score=5 |
| allergy[0] pyłk | PASS | Na pyłki trochę, na brzozę, ale na leki nie |
| missing | PASS | got [] want [] |

## gpt-oss-20b / 09-uk-gastro-travel

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | Nausea and loose stool for two days |
| onset | PASS | Two days ago evening after dinner at a restaurant |
| severity | PASS | score=4 |
| allergy[0] penicillin | PASS | Penicillin |
| medication[0] charcoal | PASS | Activated charcoal and ongoing contraceptive pills |
| medication[1] contracept | PASS | Activated charcoal and ongoing contraceptive pills |
| missing | PASS | got [] want [] |

## gpt-oss-20b / 10-pl-sprained-ankle

| Field | Result | Summary value |
|---|---|---|
| chiefComplaint | PASS | ankle sprain |
| onset | PASS | Yesterday evening |
| severity | PASS | score=7 |
| allergy[0] aspirin | PASS | aspirin |
| medication[0] ketonal | PASS | ketonal twice; ice |
| missing | PASS | got [] want [] |
