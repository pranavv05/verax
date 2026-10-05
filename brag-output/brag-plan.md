# Brag Plan: Verax

## What is this app?
Verax turns a stack of invoices and bank statements into Tally-ready accounting
data — OCR + LLM extraction, automatic GST/tax validation, GSTR-2B
reconciliation, and a one-click balanced Tally XML export — built for Indian
CA firms who currently do this by hand.

## The angle
No joke premise, no parody — the honest premise is already strong: a document
goes in, a human reviews instead of retypes, a Tally-ready voucher comes out.
The video's job is to make that pipeline feel inevitable and fast by actually
showing a real invoice's fields populate, get validated, and export — using
the product's own real UI language (the extraction card from its own landing
page), not an invented demo.

## Hook (first 2-3 seconds)
White canvas. The wordmark "Verax" sets in on its own in Instrument Serif
italic — quiet, confident, no logo sting, no swoosh. It's the same restraint
the product claims for itself.

## Key moments (the middle)
- A real invoice's fields populate one by one in the extraction card — Vendor,
  GSTIN, Invoice No., Taxable Amount, CGST+SGST, Total — with the GSTIN and
  tax rows each getting a validation tick the instant they land.
- Three compliance checks surface as clean, fast labels: GSTIN validated · Tax
  math cross-checked · GSTR-2B reconciled. Not icons in generic tinted boxes —
  plain confident type, the same vocabulary the product's own landing page
  uses.
- The "Export to Tally" button gets pressed. A balanced XML voucher confirms.
  This is the whole pitch landing in one motion: paperwork decided to be data.

## Outro / punchline
Cut back to the "Verax" wordmark on white, one line beneath it: "Financial
document intelligence for CA firms." No CTA card, no "sign up free" badge —
the restraint is the brand.

## User flow worth showing
1. **Entry** — an invoice arrives (shown as the extraction card appearing with
   a document icon / "Invoice · Extracted" label, not a literal file-upload
   widget).
2. **Key action** — OCR/LLM extraction populates the fields; GSTIN and tax
   math validate automatically, live, on screen.
3. **Result** — "Export to Tally" is pressed and a balanced voucher confirms.
   This is the real product's actual review→export flow, compressed to its
   essential beats.

## Tone
- Preset: `polished`
- Creative direction: quiet premium fintech film — Stripe/Mercury-adjacent,
  Instrument Serif display type, confidence through restraint, not hype.
- Interpretation: 4 scenes, longer holds than a default-tone video, soft
  crossfades, no hard cuts, no shouting type, no flashing color. Every reveal
  is calm and deliberate — the pacing itself is part of the pitch for a
  compliance tool a CA firm has to trust.

## Format: landscape — 1920x1080
## Duration: 22 seconds (scene sum: 2.5+3.5+7+4+3+2)

## Visual identity (from the project)
- Background: `#FFFFFF` (canvas/surface — the V3 rebrand runs pure white, not
  cream)
- Accent: `#3B5BFF` (brand-500, the single cobalt used for CTAs/emphasis)
- Text: `#131316` (carbon-900, primary) / `#63636D` (carbon-500, secondary)
- Validated/success mark: `#0D9488` (verify-600 teal tick)
- Hairline border: `#E9E9EC`
- Display font: Instrument Serif (italic for the wordmark, roman for
  headlines — regular weight only, it has no bold cut)
- Body font: Inter
- Strongest visual element: the extraction card from the real homepage hero —
  a white bordered card, hairline dividers between fields, mono tabular
  figures, a teal "Validated" pill, a solid near-black "Export to Tally"
  button. This exists verbatim in `frontend/src/pages/HomePage.jsx` and should
  be recreated faithfully, not reinvented.

## Share copy (draft)
Verax turns a stack of invoices into Tally-ready data — GST validated,
GSTR-2B reconciled, exported in one review pass. Built for Indian CA firms.

## Audio direction
- Role: warm, restrained bed — present but never the focus
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (109.96 BPM,
  117s, the calmest tempo in the bundled pack) — trimmed to the first ~20s,
  mixed quietly under the visuals rather than driving them
- Music treatment: fade in over the first ~0.5s under the wordmark, steady
  low-to-mid volume through the middle scenes, a gentle dip under the "Export
  to Tally" button-press SFX so that moment reads clearly, fade out over the
  last ~1s
- Music cue guidance: preset cues read from
  `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`.
  Target strong cues near each major reveal rather than forcing exact beat
  snaps: ~2.7s (headline settles), ~6.0s (first field + first validation
  tick), ~8.7s–9.3s (compliance labels begin), ~13.1s (compliance labels
  settle), ~16.9s (Export button press), ~19.7s (outro wordmark). Nudge
  reveals toward these within ~0.15s; never delay readability to chase a beat.
- Audio-reactive treatment: none — restraint rule below rules this out
- SFX posture: sparse. One soft UI tick per validation checkmark (GSTIN,
  CGST+SGST), one confident soft "thunk" on the Export button press, nothing
  else. No whoosh, no riser, no swell on the wordmark.
- Audio-coupled moments: the two validation ticks landing with the field
  reveal (not after it); the Export button press SFX exactly on the visual
  press-down, not the voucher confirmation after it.
- Restraint rule: no audio-reactive glow/pulse, no riser/swoosh on the
  wordmark or title, no SFX on every field arriving (only the two validated
  ones) — a CA firm's trust in this product is the whole premise, and a loud
  mix undercuts that in one second.

## Storyboard

### Scene 1 — Wordmark — 2.5s
White canvas. "Verax" sets in, centered, in Instrument Serif italic — a soft
fade/settle, no slide, no bounce. A thin cobalt-to-transparent hairline draws
in beneath it and holds.
Sequential/interaction: none
Audio intent: quiet, confident opening — the one moment with no SFX at all
Audio-coupled idea: none
Music: fade in under this scene, low volume
Transition mood: soft crossfade → Scene 2

### Scene 2 — Headline — 3.5s
Eyebrow label "FINANCIAL DOCUMENT INTELLIGENCE" (small cobalt dot + mono caps,
matching the real site) ticks in above. Below it, the real hero headline sets
in Instrument Serif at display size: "Paperwork in. Tally-ready data out."
Full sentence gets its reading floor (~2s settled) before the transition.
Sequential/interaction: eyebrow in first, then headline — two beats, not
simultaneous
Audio intent: the claim landing — calm certainty, not a sting
Audio-coupled idea: none
Music: steady low-mid volume
Transition mood: soft crossfade → Scene 3

### Scene 3 — The extraction card — 7s
The real extraction card recreated faithfully: white bordered card,
"INVOICE · EXTRACTED" label top-left, fields arrive one by one — Vendor
("Sharma Enterprises"), GSTIN ("29AABCS1429B1Z1"), Invoice No.
("INV-2024-0847"), Taxable Amount ("₹84,500.00"), CGST + SGST ("₹7,605.00"),
Total ("₹92,105.00"). The GSTIN and CGST+SGST rows each get a teal validation
tick the instant they land. A teal "Validated" pill pops in top-right once all
fields are in.
Sequential/interaction: yes — 6 field rows arrive one by one, fast entrances
(~0.3-0.4s apart) but the full card holds fully-settled for at least 2s before
the next scene so every value is actually readable
Audio intent: the product visibly working — precise, not urgent
Audio-coupled idea: soft UI tick exactly on the GSTIN validation mark and
again on the CGST+SGST validation mark; nothing on the other four rows
Music: steady, strong cues near 6.0s and ~8.7s available if the card's timing
lands there naturally — do not force it
Transition mood: soft crossfade → Scene 4

### Scene 4 — Compliance highlights — 4s
Cut to three short labels appearing in sequence, each a clean line of type
with a small cobalt tick, no icon tiles: "GSTIN validated" → "Tax math
cross-checked" → "GSTR-2B reconciled". Each holds briefly, then all three sit
together for the back half of the scene.
Sequential/interaction: yes — 3 labels arrive one by one, ~0.8s hold each,
then a combined hold
Audio intent: quick confident confirmations, still restrained
Audio-coupled idea: none beyond the two ticks already used in Scene 3 — do not
add a third SFX type here, per the sparse SFX posture
Music: approaching the track's strong cue near 13.1s — let the third label's
settle land near it if it fits naturally
Transition mood: soft crossfade → Scene 5

### Scene 5 — Export — 3s
Back to the extraction card (or a tight crop on its footer). The "Export to
Tally" button gets a visible press-down micro-interaction. Immediately after,
the button area confirms — a small checkmark or "Exported" state, not a new
screen.
Sequential/interaction: yes — simulated button press, then a result state
Audio intent: the payoff — one confident, soft, low "thunk" on the press, not
a chime
Audio-coupled idea: the thunk SFX lands exactly on the visual press-down
frame; music dips slightly under this moment and recovers after
Music: gentle volume dip through the press, recovers into Scene 6
Transition mood: soft crossfade → Scene 6

### Scene 6 — Outro — 2s
Back to the plain white canvas. "Verax" wordmark again, centered, smaller than
Scene 1. One line beneath it in Inter: "Financial document intelligence for
CA firms." Both fade out together as the music fades.
Sequential/interaction: none
Audio intent: a quiet close, nothing triumphant
Audio-coupled idea: none
Music: fade out over the last ~1s
Transition mood: hold, then fade to white/black on cut

**Music mood for this video:** polished, restrained, present but background —
never the thing the viewer notices first.
**Audio summary:** A quiet, steady bed under the whole video with exactly two
validation ticks and one button-press thunk as the only SFX — the mix should
feel like a product a CA firm would trust, not a product trying to go viral.
