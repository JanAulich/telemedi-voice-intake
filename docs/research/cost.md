# Cost at scale (checked 2026-10-25)

Prices: https://console.groq.com/docs/models (groq.com/pricing returned only a marketing page, so it could not be used). Batch and caching: https://console.groq.com/docs/batch , https://console.groq.com/docs/prompt-caching . STT billing: https://console.groq.com/docs/speech-to-text .

## 1. Cost model

Published prices: whisper-large-v3 $0.111/h; turbo $0.04/h; gpt-oss-120b $0.15 in / $0.60 out per 1M tokens; gpt-oss-20b $0.075 / $0.30 (cached input $0.037).

Assumptions (mine, not measured): 8 clips, mean 12 s actual speech (6 clips of 14 s, 2 short clips of 6 s) = 96 s actual. Summary call: about 1,700 input tokens (900 system prompt + schema, 800 transcript and questions, pl/uk tokenise heavily) and about 900 output tokens (JSON with quotes plus some reasoning tokens).

| Variant | Audio billed | STT | LLM | Per intake | Per 1,000 | Per 100,000 |
|---|---|---|---|---|---|---|
| Current: v3 per clip + 120b | 104 s | $0.00321 | $0.00080 | $0.0040 | $4.00 | $400 |
| turbo per clip + 120b | 104 s | $0.00116 | $0.00080 | $0.0020 | $1.95 | $195 |
| turbo per clip + 20b | 104 s | $0.00116 | $0.00040 | $0.0016 | $1.56 | $156 |
| turbo, one 96 s clip + 20b | 96 s | $0.00107 | $0.00040 | $0.0015 | $1.47 | $147 |

STT is about 80% of today's cost; the LLM call is minor.

## 2. Whisper billing rule

Verified: **minimum billed length is 10 seconds per request** (docs say shorter requests are still billed for 10 s; minimum file length 0.01 s). Source: https://console.groq.com/docs/speech-to-text .

- With my mix, 8 clips bill 104 s vs 96 s concatenated: only 8% (about $0.0001). If answers are mostly under 10 s (all 6 s), per-clip bills 80 s vs 48 s, i.e. 67% more.
- Concatenating means waiting for all 8 answers: transcripts appear only at the end, so per-turn red-flag checks and live transcript editing are lost. Latency trade is large, saving is tiny. Not recommended; at most batch two adjacent short answers (unverified benefit).
- Whether failed (429/5xx) requests are billed: unverified (billing FAQ https://console.groq.com/docs/billing-faqs is silent).

## 3. Levers ranked

| Lever | Saving | Effort | Latency | Quality risk |
|---|---|---|---|---|
| Turbo instead of v3 | about 64% of STT (about 50% of total) | 1 line | faster | WER 12% vs 10.3% (English figures); pl/uk gap unverified, so measure with eval |
| Cap clip length (e.g. 45 s, auto-stop) | bounds worst case | low | none | low |
| Trim leading/trailing silence on device | small (only above the 10 s floor) | medium on web | none | VAD can clip speech |
| Skip STT when user types | 100% of that turn | already free (edit path) | none | none |
| gpt-oss-20b for summary | about 50% of LLM (about 10% of total) | 1 line | faster (about 1,000 tok/s) | pl/uk extraction quality unverified; quote verification catches fabricated quotes but not omissions |
| Compact prompt and schema | under 5% of total | low | slightly faster | low |
| Prompt caching | gpt-oss models only, 50% off cached input, prefix 128 to 1024 tokens (varies), 2 h expiry, automatic. Applies to about 900 static tokens, about $0.00007 per intake | free if static text goes first | none | none |
| `max_completion_tokens` cap (about 1,500) | prevents runaway cost | 1 line | none | truncated JSON if too low |
| Batch API (50% off) | 50%, supports whisper and gpt-oss; windows 24 h to 7 d; does not stack with caching | medium | not real time | none |
| Avoid double-billing retries | unknown | low | none | none |
| Do not re-summarise on edits | avoids repeat call | low | none | none |

Batch tier availability (free vs developer): unverified.

## 4. Recommendation

(a) Apply now (cheap, no quality risk): put the static system prompt and schema first (caching, free); set `max_completion_tokens`; cap clip length; never re-summarise on edit; retry at most once and only on 429/5xx. Keep whisper-large-v3 as default until eval shows turbo is acceptable on pl/uk, then switch (the biggest single saving). Expose the model as a config constant.

(b) At scale: turbo plus 20b if the eval harness shows no extraction regression; run eval and regression suites through the Batch API at half price; add on-device silence trimming; get negotiated pricing and ZDR; move to the Developer tier (free-tier limits do not fit volume).

(c) Not worth it: concatenating clips, custom STT, self-hosting, or hand-compressing prompts for sub-cent gains.

Insurer B2B: at about $0.0015 to $0.004 per intake of raw model cost, API spend is negligible next to clinician time, support, compliance (DPA, EU processing; Groq stores in the US per https://console.groq.com/docs/your-data) and liability. A price per intake of even a few euros leaves large margin; the cost to protect is quality (missed red flags), not tokens. A per-intake price should be tied to completed intakes, with failed or abandoned sessions capped.
