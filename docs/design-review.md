# Design review and token system

Method: the `apple-design` skill, Design improvement mode. Platform: React Native + Expo (SDK 58), shown mainly on web, also iOS and Android. Apple's guidance is applied as principles (`references/cross-platform.md`), not as native components. Contrast figures are computed from the hex values (WCAG relative luminance); the script is not part of the repo.

References read: `accessibility.md`, `layout.md`, `typography.md`, `color.md`, `designing-for-ios.md`, `cross-platform.md`, `buttons.md`, `toggles.md`, `text-fields.md`, `entering-data.md`, `feedback.md`, `loading.md`, `progress-indicators.md`, `alerts.md`, `modality.md`, `dark-mode.md`, `privacy.md`, `writing.md`.

## 1. Context

- **Product:** voice pre-consultation intake for Telemedi. A patient (often unwell, possibly abroad) answers 8 questions by voice in Polish, Ukrainian or English. A red flag interrupts with a "call 112" screen. The doctor gets a SAMPLE + OPQRST card where every fact shows whether the patient said it or the model inferred it.
- **Single job per screen:** keys = start safely; setup = pick two languages; interview = answer this one question; emergency = get the patient to call 112; card = let the doctor scan facts and check where each came from.
- **Thesis:** a calm instrument. The patient should feel listened to; the doctor should feel the record is checkable.

## 2. Review of the UI before this pass

Rating before: **Needs work** (one Critical, several High).

### Critical
- **Control boundaries invisible.** Input, option and track borders were `#C9D6DC`: 1.49:1 on white (inputs, options) and 1.38:1 on the page (progress track). Required: 3:1 for the boundary of a control. `accessibility.md › Vision`: "Strive to meet color contrast minimum standards". Fix: control border `#6B7F89` (4.18:1 on white).
- **Reading text below 17 pt.** The patient's own answer (16), the error message (15), the emergency "continue" hint (15, safety text), privacy notes (14), quote (15). `accessibility.md › Vision`: "iOS, iPadOS 17 pt default". Fix: everything a patient or doctor reads is 17; only metadata (captions 15, chips 14, eyebrow labels 13) is smaller.

### High
- **One colour meant two things.** The recording state used the same red as the emergency screen. `color.md › Best practices`: "Avoid using the same color to mean different things." Fix: recording is the dark ink disc with a stop square and animated rings; red is reserved for emergency and the irreversible wipe.
- **No focus indicator and no dark appearance.** `dark-mode.md › Best practices`: "Ensure that your app looks good in both appearance modes." Fix: both palettes, follows the system, no in-app switch; visible focus ring on every pressable and field.
- **Templated look, no point of view.** Teal on pale blue-grey, white cards with 2 px outlines, a plain circle for the microphone. Nothing said "listening". Fix: see Signature.
- **Provenance was colour-led.** "Patient said" / "Inferred" had text but differed mainly by green vs orange, and the quote behind each fact was only discoverable by hover or an invisible tap. `accessibility.md › Vision`: "Convey information with more than color alone." Fix: filled dot + solid chip vs hollow dot + dashed chip, a visible "tap a fact to see the quote" line and a chevron on each row.

### Medium
- Emergency title at weight 900 shouts; panic needs calm, direct, large (`writing.md › Getting started`: "Match your tone to the context"). Now weight 700, 32 pt.
- Switch label sat after the switch; `toggles.md › Mobile`: label in the row, switch trailing.
- Wide screens: single 640 px column with cards of equal weight; the card was a flat list. Now a ledger with the OPQRST / SAMPLE letter in the gutter.
- Hard-coded `#FFFFFF` in inputs, options, the light button and the JSON block (no dark possible).

### Low
- Latency caption ("1.2 s") is a developer figure; kept because it supports the "fast turns" claim in `WHY.md`.

## 3. Token system

### Colour (light / dark, with contrast against the surface it sits on)

| Role | Token | Light | Dark | Contrast L / D |
| --- | --- | --- | --- | --- |
| Canvas | `bg` | `#F4F7F7` | `#0B1519` | |
| Surface | `surface` | `#FFFFFF` | `#13232A` | |
| Surface, quiet | `surfaceAlt` | `#E9F0F1` | `#1B2F37` | |
| Content | `ink` | `#0F2229` | `#E9F1F3` | on bg 15.22 / 16.15; on surface 16.39 / 14.09; on surfaceAlt 14.21 / 12.16 |
| Content, secondary | `muted` | `#4A5C66` | `#A6B8BF` | on bg 6.47 / 9.01; on surface 6.97 / 7.86; on surfaceAlt 6.04 / 6.78; on amber notice 6.21 |
| Control boundary | `fieldBorder` | `#6B7F89` | `#7F97A0` | on surface 4.18 / 5.25 (needs 3) |
| Accent (fill) | `accent` | `#0B6670` | `#5CC8D2` | label `onAccent` `#FFFFFF` / `#04252A`: 6.67 / 8.17 |
| Accent pressed | `accentPressed` | `#084B53` | `#3FB3BE` | label: 9.81 / 6.45 |
| Accent as text | `accentInk` | `#084B53` | `#7FD6DE` | on surface 9.81 / 9.66; on bg 9.10 / 11.07; on surfaceAlt 8.50 / 8.34 |
| Accent tint (stated chip, secondary button) | `accentTint` | `#DCEEF0` | `#17383E` | text `onAccentTint` `#084B53` / `#BFEAEE`: 8.19 / 9.70 |
| Focus ring | `focus` | `#0B6670` | `#7FD6DE` | on bg 6.19 / 11.07; on surface 6.67 / 9.66 (needs 3) |
| Recording disc | `recordDisc` | `#0F2229` | `#E9F1F3` | glyph `#FFFFFF` / `#0B1519`: 16.39 / 16.15 |
| Error text, wipe button | `dangerText` / `dangerFill` | `#B00020` | `#FF9AA8` / `#FF8F9C` | text on surface 7.33 / 8.02; wipe label `#FFFFFF` / `#3A0009`: 7.33 / 8.16 |
| Provisional (inferred chip, notice) | `amberBg` / `amberInk` | `#FFF1CC` / `#5C4300` | `#3A2D0A` / `#FFDE8A` | 8.28 / 10.30; ink on notice 14.60 / 11.76; dashed border `amberBorder` on surface 5.93 / 6.64 |
| Code block | `codeBg` / `codeInk` | `#0F1E26` / `#E6F1F5` | `#0A1217` / `#E6F1F5` | 14.80 / 16.43 |

Fixed in both appearances (they carry meaning by themselves):

| Role | Value | Contrast |
| --- | --- | --- |
| Emergency background / white text | `#B00020` / `#FFFFFF` | 7.33 |
| Detected-flags panel, white text | `#7F0017` / `#FFFFFF` | 10.97 |
| Matched quote on that panel | `#FFE3E6` on `#7F0017` | 9.08 |
| "Call 112" button label | `#B00020` on `#FFFFFF` | 7.33 |
| "Continue anyway" (outlined, white text and border) | `#FFFFFF` on `#B00020` | 7.33 |
| Demo badge | `#3E2A00` on `#FFE082` | 10.57 |

Colour meaning: **accent** = the next action; **amber** = provisional or unverified (demo, inferred, notices); **red** = emergency or the irreversible wipe, never decoration. Dark values are the same hues lifted for the dark surface, not inverted (`dark-mode.md › Dark Mode colors`: "no lower than 4.5:1").

### Type

System typeface everywhere (SF / Roboto / the web UI font): `typography.md › Minimize the number of typefaces`. The personality is in scale, weight and the monospace timer, not in a decorative face.

| Style | Size / line | Weight | Used for |
| --- | --- | --- | --- |
| title | 30 / 36 | 700 | screen titles |
| question | 28 / 36 | 700 | the interview question |
| heading | 20 / 26 | 700 | card headings |
| body | 17 / 24 | 400 | everything read |
| bodyStrong | 17 / 24 | 600 | button labels, fact values |
| caption | 15 / 20 | 400 | metadata only (latency, hints under controls) |
| chip | 14 / 18 | 700 | provenance chips |
| label | 13 / 16 | 700, uppercase | field labels on the card |

Mono (`Menlo` / `monospace` / `ui-monospace`) for the recording timer and the FHIR JSON.

### Layout

One centred column, 560 px on the patient screens, 720 px on the doctor card, 16 px gutters, 4 pt grid. Controls are at least 48 pt tall, with 8 pt between adjacent buttons. Rows wrap (`flexWrap`) so 320 px and large text never clip.

```
compact (320-430)                 regular (web, 1024+)
+---------------------+           +------------------------------------+
| Question 3 of 8  [D]|           |        +----------------------+    |
| ▮▮▮▯▯▯▯▯            |           |        | Question 3 of 8   [D]|    |
|                     |           |        | ▮▮▮▯▯▯▯▯             |    |
| What brings you     |           |        | What brings you in   |    |
| in today?           |           |        | today?               |    |
|                     |           |        |                      |    |
|     ((  (o)  ))     |           |        |     ((  (o)  ))      |    |
|     Tap to speak    |           |        |     Tap to speak     |    |
| [ Type instead ]    |           |        | [ Type instead ]     |    |
+---------------------+           |        +----------------------+    |
                                  +------------------------------------+
```

### Signature: the listening mic

The microphone button is the one place the design spends its boldness. A 136 pt disc sits inside two concentric rings, like a stethoscope bell or a sound-level ring. Each phase is told by glyph and label first, motion second, colour last:

| Phase | Disc | Glyph | Label | Rings |
| --- | --- | --- | --- | --- |
| idle | accent | microphone | "Tap to speak" | static |
| preparing | accent, dimmed | spinner | "Get ready…" | static (never looks like "speak now") |
| recording | dark ink | stop square | "Speak now" + "Tap to stop" + `0:07 / 1:00` timer | ripple outwards |
| processing | muted | spinner | "Transcribing…" | none |

The timer shows the 60 s limit the engine enforces (`engine/core/limits.ts › MAX_AUDIO_MS`) so a long answer is not a surprise. The ripple stops under Reduce Motion (`accessibility.md › Cognitive`: "Be cautious with fast-moving and blinking animations"), on every phase change and on unmount. This product-specific element is the answer to "would this plan be the same for another product?": a voice-first intake needs a visible, patient-sized "I am listening" state; a todo app does not.

Secondary, deliberately quiet: on the doctor card, the OPQRST / SAMPLE letters sit in a gutter next to each field, and the provenance chip is a filled dot (patient said) or a hollow dot with dashed outline (inferred). Both encode real structure in the record, not decoration.

### Motion

One moment: the mic ripple while recording. Press feedback is a colour change, no scaling. The emergency screen has no entrance animation; it appears immediately.

## 4. Critique of the plan

- Would the same plan fit a different product? The palette (teal) is a health default, so it is kept only as the quiet carrier. The mic, the ledger gutter and the said/inferred dot system come from this product's job, and those are where the character lives.
- Removed: a second accent colour, a gradient hero, numbered step markers for non-sequences (the 8 progress ticks are a true sequence). Not added: icons beyond the mic and chevron, shadows, blurs.
- Platform check: standard controls and conventions are kept (back/ghost buttons, switch in a row, radio group for the language, the system keyboard); no in-app appearance switch; sizes and spacing follow HIG minimums.
- The one thing considered for removal: the latency caption. Kept (see Low).

## 5. Sequence applied

1. Accessibility: contrast of control borders, 17 pt reading text, wrapping rows, focus ring, text-plus-shape provenance, reduced motion.
2. Conventions: switch label order, press states on every custom button, filled / tinted / plain button hierarchy, destructive wipe not styled as the primary action but still full width and prominent.
3. Craft: tokens, dark palette, card hierarchy, ledger gutter.
4. Polish: mic rings, timer, spinner placement.

## 6. After this pass

Rating after: **Good**. No Critical findings remain; the open items are the two High-ish limits below, both outside the files this pass could touch.

Implemented against the review: control borders 4.18:1 (was 1.49:1); all reading text 17 pt; recording no longer uses emergency red; both appearances with a visible focus ring; provenance by text + dot + outline; letter gutter; one signature (the mic).

Sizes still below 17 pt, on purpose (metadata, not body): captions 15 (latency, "tap a fact to see the quote", question above an earlier answer, progress label), chips 14 bold, uppercase field labels 13 bold, FHIR JSON 13 mono.

Verified: `tsc --noEmit` clean; `vitest run` 178 passed, 21 skipped; `expo export --platform web` bundles. Checked in a browser on the exported build (served on port 8082, stopped afterwards): keys, setup, interview (typed and a recorded take with a synthetic microphone stream), red-flag escalation, doctor card with a forced "inferred" fact, in light and dark, at 320, 390 and 1280 px, and by keyboard (Tab ring on buttons and fields). No horizontal page scroll at 320 px. Not verified: a real iPhone or Android device, VoiceOver / TalkBack, system text-size at the largest accessibility size, Reduce Motion (code path only).

Limits left open:
- **High (not in scope):** `App.tsx` pads iOS content by a fixed 44 pt. Phones with a Dynamic Island have a taller top inset, so the first line can sit close to the status bar. The fix is `react-native-safe-area-context` (a new dependency) or a native-header screen.
- **Medium:** the "Get a free Groq key" link still shows the browser's default focus ring (it is plain text with `onPress`, not a Pressable).

## 7. Kept on purpose

- Button strings, `accessibilityLabel`s and roles (including "Groq API key") unchanged; sentence case kept (Material-style) rather than Apple title case, because the labels double as automation hooks.
- Pre-filled key from `EXPO_PUBLIC_GROQ_API_KEY`: `entering-data.md` says never prepopulate a password; this is a documented local-only convenience in the README, left as is.
- Display and wording of the localized strings (`i18n.ts`) unchanged.
