# Hyperframes Composition Brief: Verax

## Objective
Create a short launch-style brag video for Verax, an AI document-processing
platform for Indian CA firms.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 22 seconds

## Source Material
- Project root: `/home/user/verax`
- Primary files read: `frontend/index.html`, `frontend/tailwind.config.js`,
  `frontend/src/index.css`, `frontend/src/pages/HomePage.jsx`,
  `frontend/src/components/marketing/ledger.jsx`,
  `frontend/src/components/brand/VeraxLogo.jsx`
- Product name: Verax
- Tagline / strongest claim: "Paperwork in. Tally-ready data out."
- Key UI or visual moment to recreate: the extraction card from the real
  homepage hero (`HomePage.jsx`) — a white bordered card showing an invoice's
  fields extracted and validated, ending in an "Export to Tally" button.
- Copy that must appear verbatim:
  - "Paperwork in. Tally-ready data out."
  - "FINANCIAL DOCUMENT INTELLIGENCE"
  - "GSTIN validated"
  - "Tax math cross-checked"
  - "GSTR-2B reconciled"
  - "Export to Tally"
  - "Financial document intelligence for CA firms."
  - Field values: Sharma Enterprises / 29AABCS1429B1Z1 / INV-2024-0847 /
    ₹84,500.00 / ₹7,605.00 / ₹92,105.00 (all real sample values already used
    in the actual product's own hero section and seed data)

## Creative Direction
- Tone preset: polished
- Creative direction: quiet premium fintech film — Stripe/Mercury-adjacent,
  Instrument Serif display type, confidence through restraint, not hype
- Interpretation: 6 scenes but long holds and soft crossfades throughout — no
  hard cuts, no shouting type, no flashing color
- Angle: The honest premise is strong enough on its own — a document goes in,
  a human reviews instead of retypes, a Tally-ready voucher comes out. The
  video makes that feel inevitable by showing a real invoice's fields
  populate, validate, and export using the product's own real UI language.
- Hook: White canvas, "Verax" wordmark sets in alone in Instrument Serif
  italic — no logo sting, no swoosh.
- Outro / punchline: Wordmark again, smaller, with "Financial document
  intelligence for CA firms." beneath it. Fade to white.
- Avoid:
  - Generic SaaS language ("streamline your workflow" etc.)
  - Abstract filler visuals / particle systems / gradients as decoration
  - Any invented metric, customer name, or testimonial not in the project

## Visual Identity
- Background: `#FFFFFF`
- Text: `#131316` (primary) / `#63636D` (secondary)
- Accent: `#3B5BFF`
- Validated/success mark: `#0D9488`
- Hairline border: `#E9E9EC`
- Display font: Instrument Serif (italic for wordmark, regular for headline —
  no bold cut exists, never force one)
- Body font: Inter
- Visual references from the project: the extraction card and Field-row
  pattern from `frontend/src/components/marketing/ledger.jsx`'s `Field`
  component (label left, mono value right, optional teal tick) and
  `HomePage.jsx`'s hero card markup

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Wordmark — 2.5s — "Verax" sets in alone, centered, Instrument Serif italic
2. Headline — 3.5s — eyebrow then "Paperwork in. Tally-ready data out."
3. Extraction card — 7s — 6 fields arrive one by one, 2 get validation ticks,
   "Validated" pill pops, full card holds readable for 2s+
4. Compliance highlights — 4s — 3 labels arrive in sequence, then hold
5. Export — 3s — button press-down, confirmation state
6. Outro — 2s — wordmark + tagline, fade out

## Audio
- Audio role: warm, restrained bed — present but never the focus
- Audio arc: fade in under Scene 1, steady low-mid through the middle, a
  gentle dip under the Scene 5 button-press SFX, fade out through Scene 6
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (109.96 BPM)
  — the calmest tempo in the bundled pack, trimmed to ~22s
- Music treatment: fade in ~0.5s, steady low-mid volume, dip under the Scene 5
  SFX, fade out over the last ~1s
- Music cue guidance: preset read from
  `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`.
  Candidate strong-cue targets near: ~2.7s, ~6.0s, ~8.7s–9.3s, ~13.1s,
  ~16.9s, ~19.7s. Optional hints only — ignore any that hurt readability.
- Audio-reactive treatment: subtle at most — e.g. a very slight presence/glow
  on the card in Scene 3 tracking music RMS. No waveform bars, no pulsing.
- Audio-coupled moments:
  - Scene 3 — GSTIN tick and CGST+SGST tick SFX land exactly on each field's
    reveal frame
  - Scene 5 — button-press "thunk" SFX lands exactly on the visual press-down
    frame
- SFX selection guidance: sparse — exactly 2 validation-tick sounds and 1
  button-press sound, nothing else. Favor low high-frequency-risk files (see
  `sfx-analysis.md`) since these are repeated, polished moments, not accents
  in a loud edit.
- SFX analysis guidance: `<skill-dir>/assets/sfx/sfx-analysis.md` (brag
  skill directory) — consult before picking exact SFX files.
- Exact SFX choice: choose filenames/timestamps/density from the implemented
  animation, honoring the sparse posture above.
- Audio files: copy chosen music and SFX into
  `brag-output/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`,
`hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, and
`hyperframes-cli`. This is its own workflow — do not enter the `hyperframes`
entry-point intent interview or route into its generic promo/launch-video
workflow. Prefer native Hyperframes conventions over anything stated here as
a fixed template.

Requirements:
- Show the real extraction-card UI from the project (per Visual references).
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds (target 22s).
- Include the planned music/SFX layer.
- Treat music cue metadata as optional timing hints only.
- Use local assets only. Keep creation and rendering local — no publish/cloud
  step unless separately requested.
- Run `hyperframes check` before render.
