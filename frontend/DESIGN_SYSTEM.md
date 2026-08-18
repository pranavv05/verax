# Verax — Public Surface Design System

**Two systems coexist here, on purpose.**

- **V2 — "The Ledger"** (§§0.5, 9–12, added 2026-08-09) is the **marketing surface**: `/` and the
  shared nav/footer chrome on `/features`, `/pricing`, `/about`, `/security`.
- **V1 — light-first** (§§0–8, below) is still the system for the **auth and magic-link upload
  surface**: `/login`, `/signup`, `/client-portal/login`, `/upload/:token`,
  `/upload/:token/status`. V2 does not touch these.

V2 is additive at the token level: it introduces one new colour scale (`carbon`) and a set of new
`.vx-*` utilities, and changes none of V1's. Read §0.5 first, then §§9–12; §§1–8 remain accurate
for the V1 surface.

---

## 0.5 V2 — "The Ledger", in one paragraph

The marketing site draws **three shapes and nothing else**, repeated at every scale: a **Sheet**
(ruled paper — a document nobody has read yet), a **Field** (a bracketed label/value pair in mono —
something lifted out of one), and a **Mark** (a hairline teal tick = validated, an amber caret =
needs a human), connected by a **Rail** (a dashed track things travel along). Every section of the
homepage is a different scale of that same vocabulary, which is what makes the invoice section and
the reconciliation section read as two views of one system instead of two cards from one template.
The primitives live in `src/components/marketing/ledger.jsx`; §11 lists the sections built from
them. The rules V2 adds to V1: **near-black (`carbon`) is the primary**, not navy; **mono means
"extracted"** and is never used for headlines or body; **the product's own UI appears exactly
once**, as evidence, three-quarters of the way down the page; and **nothing on the page is a
number we cannot substantiate.**

---

Scope (V1, below): the unauthenticated pages only (`/`, `/login`, `/signup`, `/client-portal/login`,
`/upload/:token`, `/upload/:token/status`, and — once migrated, see §7 — `/features`,
`/pricing`, `/about`, `/security`, `/404`). The authenticated dashboard keeps its existing
Manrope/light `ink`/`sand`/`mint`/`ember` system — every public token below is namespaced
(`vx-`, `canvas`/`surface`/`well`/`hairline`, `brand`/`navy`/`sky`) so the two never collide.

**V1 supersedes the dark-canvas system this file previously documented.** The public surface
was `#0A0A0B`-black; V1 moves it to a light-first, warm-ivory system. The editorial pacing,
motion contract, and mockup architecture below are unchanged from that pass — only the palette
inverted, plus a new marketing-primitive layer and a documented image system were added. See
§7 for exactly what has and hasn't been migrated onto V1 yet.

---

## 0. What was taken from each reference

Three sites were studied for V1, same as before. Nothing was copied — these are principles,
re-synthesised into something that belongs to Verax.

**MindMarket** — editorial restraint. Large statements as *section anchors*, not decoration; a
claim gets a whole viewport to itself, surrounded by air rather than cards. Short declarative
headlines. **Applied as:** the Problem section's editorial pull-quote, the two-line headline
pattern, and the `SectionHeader` primitive's centred, cardless composition.

**Paraform** — premium SaaS presentation. Confident short headlines, big numeric callouts as
their own visual unit, alternating left/right feature rows, a repeated high-contrast CTA.
**Applied as:** the `Metric` primitive, `SplitSection`'s alternating rhythm, and the single
violet CTA pill as the only saturated fill on the page.

**Coda** — product-led storytelling. Every claim paired with real UI, features revealed as a
*sequence of workflows* rather than an icon grid. **Applied as:** `SplitSection`/
`ProductShowcase` always pairing a claim with a `ProductFrame`, and the explicit rule against a
feature-card-grid primitive (see §5).

**The synthesis:** MindMarket's pacing sets the *rhythm*, Paraform's proof-and-polish sets the
*confidence*, Coda's UI-beside-claim sets the *evidence*. Verax V1 = light, editorial, premium
fintech — intelligent and precise, not AI-flashy.

---

## 1. Colour system

Light-first. Warm ivory canvas, white surfaces, one restrained violet accent. Deep navy is a
contrast *background*, reserved for specific sections — never the page default.

| Role | Hex | Token |
|---|---|---|
| Page background | `#F7F6F2` | `bg-canvas` |
| Raised surface (cards, mockups) | `#FFFFFF` | `bg-surface` |
| Recessed surface (mockup chrome) | `#F0EEE7` | `bg-well` |
| Border | `#E5E3DD` | `border-hairline` |
| Border, hover/emphasis | `#D6D2C6` | `border-hairline-strong` |
| Text 1 — headlines | `#111827` | `text-zinc-100` (public) / `text-graphite-900` (new primitives) |
| Text 2 — body | `#5F6675` | `text-zinc-400` / `text-graphite-500` |
| Text 3 — labels, muted | lightest of the ramp | `text-zinc-600` / `text-graphite-400` |
| Accent — CTAs, small emphasis only | `#6657D9` | `brand-500` |
| Secondary accent — used sparingly (links, icons) | `#4D8DFF` | `sky-500` |
| Dark contrast background | `#11182D` | `navy-800` |
| Secondary — success, client, verified | `#14B8A6` | `verify-500` |
| Danger — errors | `#EF4444` | `red-500` (Tailwind default) |
| Amber — warnings, roadmap | `#F59E0B` | `amber-500` (Tailwind default) |

**Why two neutral ramps (`zinc` and `graphite`) with the same values:** `zinc` is what the
existing vx-* component tree (`LandingNav`, the mockups, `FlowSteps`, `HomePage`) is wired to —
retuned in place from its dark-mode values rather than mass-renamed at every call site.
`graphite` is a clean-slate scale (previously unused, originally built for an earlier abandoned
light-mode attempt — `DemoRequestForm`'s dormant `tone="light"` branch already depended on it)
used by the new marketing primitives in `components/marketing/primitives.jsx`. Both resolve to
the same hex values, so nothing looks like two systems — they're two entry points to one ramp.

Rules:
- `brand` (violet) fills only: primary buttons, eyebrow labels, small emphasis marks, the
  confidence-bar gradient start. **Never a section background, never a large field fill** — the
  brief is explicit that violet is an accent, not the primary background identity.
- `navy` is a full-bleed section background only (e.g. the auth split panel). Never used for
  text or borders on the ivory canvas, and never a card fill sitting on a light surface.
- `verify`/`amber`/`red` carry the reconciliation story and status semantics (matched/mismatched/
  not-found, valid/invalid) — keep them out of decorative use elsewhere.
- Do not use: neon purple, excessive gradients, glowing backgrounds or cards, glassmorphism,
  blurred colour orbs, "AI glow" effects. See §4 and §7 for what's already been removed and
  what's still pending removal from pages not yet migrated.
- The `brandGlow` shadow token exists for CTA buttons only (a tight contact shadow under a
  button, not a diffuse bloom) — do not reuse it as a section background effect.

---

## 2. Typography

**Inter**, the only marketing typeface — loaded via `<link>` in `index.html` (a CSS `@import`
would block the CSSOM and delay first paint). Weights 400/500/600/700/800. Tabular figures
(`font-variant-numeric: tabular-nums`, via `.vx-nums`) wherever currency or figures appear so
columns align.

**Manrope** is no longer a marketing dependency in principle — `font-sans` in
`tailwind.config.js` still maps to it because the authenticated dashboard depends on it
(out of scope for this pass; see §7). No public-surface component should reach for `font-sans`
or rely on `body`'s default font-family; every public root already opts into Inter via the
`.vx-page` class (`font-inter`), and any new marketing primitive should be used inside that
root rather than reintroducing a Manrope dependency.

**IBM Plex Mono** is reserved for technical values only: transaction/document IDs, GSTIN
strings, amounts inside product UI, anything code-like. It is not a headline or body font.

| Style | Size | Weight | Tracking | Line height |
|---|---|---|---|---|
| Display / Hero | `clamp(52px, 6vw, 84px)` | 800 | `-0.04em` | 1.02 |
| H1 | `clamp(36px, 4vw, 56px)` | 700 | `-0.03em` | 1.06 |
| H2 | `clamp(28px, 3vw, 40px)` | 600 | `-0.02em` | 1.12 |
| Editorial quote | `clamp(28px, 3.5vw, 48px)` | 700 | `-0.02em` | 1.2 (italic) |
| Body | `17px` | 400 | — | 1.75 |
| Small | `14px` | 400 | — | 1.6 |
| Label / eyebrow | `11px` | 600 | `0.1em` | uppercase |
| Mockup / technical UI text | `11–13px` | 400–600 | — | 1.4, mono where it's a value |

Headline rule (unchanged from the dark pass, still holds): **two lines, never three.** Line 1
states the tension, line 2 resolves it.

Utilities: `.vx-display`, `.vx-h1`, `.vx-h2`, `.vx-quote`, `.vx-body`, `.vx-small`, `.vx-label`,
`.vx-eyebrow`.

---

## 3. Spacing

Unchanged from the dark pass — the rhythm was never the problem, the palette was.

Scale: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160, 200` px.

Section rhythm (`.vx-section`): **160px** desktop / **96px** tablet / **64px** mobile of
vertical padding.

Content widths:
- Editorial / centred copy: `max-width: 800px` (`.vx-measure`)
- Hero column: `max-width: 900px`
- Body paragraph measure: `max-width: 560px` (~62 characters)
- Full shell: `max-width: 1200px`, gutters 24px mobile / 40px desktop (`.vx-shell` /
  `MarketingContainer`)

Prefer large compositions over density: one big heading and one real product frame beats a row
of equal-height cards. The V1 brief explicitly rules out a feature-card-grid primitive — see §5.

---

## 4. Borders, radius, shadows

V1 reduces the "everything is a rounded card" instinct from the dark pass.

- **Borders**: hairline only (`border-hairline` / `border-hairline-strong` on hover). No heavy
  borders, no coloured borders outside of status semantics.
- **Radius**: `12px` small (pills, fields), `16px` cards, `24px` product frames/mockups
  (`.vx-mockup`). Nothing sharp, nothing pill-shaped except buttons and small chips.
- **Shadows**: restrained. `.vx-mockup`'s shadow is a navy-tinted hairline ring + a soft ambient
  drop (`rgba(17,24,39,…)`) — no colour bloom. `brandGlow` is a tight contact shadow reserved
  for CTA buttons, not a background effect.
- **Not every element is a card.** `Section`/`SectionHeader`/`SplitSection` render text directly
  on the canvas; only `ProductFrame` (real product UI) gets the bordered-container treatment.

---

## 5. Layout primitives

`components/marketing/primitives.jsx` — the reusable building blocks the marketing site is
meant to be composed from going forward:

- **`MarketingContainer`** — 1200px shell, same width as `.vx-shell`.
- **`Section`** — full-bleed, `.vx-section` vertical rhythm, `tone` picks `canvas`/`surface`/
  `navy` background.
- **`SectionHeader`** — eyebrow + heading + body, centred or left-aligned.
- **`SplitSection`** — the Coda-mode claim-beside-UI composition, `reversed` alternates sides.
- **`ProductShowcase`** — centred claim above a full-width `ProductFrame`.
- **`Eyebrow`** — small uppercase accent label.
- **`PrimaryButton`** / **`SecondaryButton`** — polymorphic (`to`/`href`/plain button), violet
  fill vs. hairline outline. Never two filled pills side by side.
- **`Metric`** — one large number + label, no card.
- **`ProductFrame`** — hairline border + `.vx-mockup` shadow around real product UI
  (screenshots or the `mockups/` fake UI) — the one place containment is intentional.

**Deliberately absent: a feature-card-grid primitive.** The V1 brief rules this pattern out
explicitly; compose feature explanations from `SplitSection`/`ProductShowcase` instead — a claim
paired with the real UI that proves it, not an icon in a tinted box.

Status: these are additive. Nothing currently imports them — see §7.

---

## 6. Animation

`framer-motion`, unchanged architecture and contract from the dark pass:

```
Entrance (every scroll reveal)
  initial:      { opacity: 0, y: 40 }
  whileInView:  { opacity: 1, y: 0 }
  viewport:     { once: true, amount: 0.2 }
  transition:   { duration: 0.8, ease: [0.16, 1, 0.3, 1] }   // expo-out
```

Reuse from `components/public/motion.jsx`: `Reveal`, `RevealGroup`, `RevealItem`, `Counter`,
`EASE`, `hoverLift`, `hoverPress`. All are `prefers-reduced-motion`-safe, backed by both
`useReducedMotion()` and a CSS media-query kill switch for decorative loops.

- **Stagger** between siblings: `0.1s`.
- **Button hover**: `opacity → 0.82/0.88`, `150ms`. No scale, no lift.
- **Card hover**: border `hairline → hairline-strong`, `250ms`.
- **Ceiling**: no bounce, no elastic, no spring, nothing scaled past `1.02`.
- **Loops**: only two on the whole surface — a mockup's 6s float, and the trust-bar marquee.
  Everything else fires once, in view.
- Animation should communicate product behaviour (a confidence bar filling, a connector drawing
  along the pipeline), not add decorative movement for its own sake.

**Deprecated CSS animation vocabulary** — do not use in new work; still referenced by pages not
yet migrated (`FeaturesPage`, `PricingPage`, `AboutPage`, `SecurityPage`, `NotFoundPage`) so not
yet deletable from `index.css`:
`.hero-gradient`, `.orb` / `.orb-1/-2/-3`, `.gradient-text`, `.gradient-text-accent`,
`pulse-glow`, `shimmer`, `gradient-shift`, `spin-slow`, and the floating blurred-orb pattern
generally. These disappear once those pages migrate onto the primitives in §5.
**Not deprecated** — `.hover-lift` and `.card-shine` are also legacy-named but are shared with
the authenticated dashboard (`StatCard.jsx`); leave them alone regardless of marketing status.

---

## 7. Migration status

What's actually on V1 today vs. what's pending — check this before assuming a page matches this
document.

**On V1 (light-first, retuned tokens):**
`/` (Home — nav/footer/mockups/tokens only; its own section content/copy has not been touched
this pass), `/login`, `/signup`, `/client-portal/login`, `/upload/:token`,
`/upload/:token/status`, `LandingNav`, `LandingFooter`, `AuthSplitLayout`, `FloatingField`,
`PublicPageShell`, `VeraxLogo` (default tone flipped to dark-on-light), all four product
mockups + `MockupFrame`.

**Not yet migrated — still on the pre-V1 cream/`sand`/`ink`/`mint` `PublicLayout` shell:**
`/features`, `/pricing`, `/about`, `/security`, `/404`. `PublicLayout` is marked
`@deprecated` in-source; do not add new pages to it. These pages still contain the icon-in-
tinted-chip feature grids and generic outline icons the V1 brief rules out — that's a content
migration, not just a palette swap, and is out of scope for the token/primitive foundation this
document describes.

**Known cosmetic debt from the token flip, deliberately left alone this pass:** `HomePage.jsx`,
`ClientPortalLoginPage.jsx`, `PublicUploadPage.jsx` and `PublicUploadStatusPage.jsx` contain a
handful of literal `white/opacity` utilities (e.g. decorative pills, avatar rings) that assumed
a dark canvas and will render at low contrast until those files get their own pass — the shared
components they're built from (`LandingNav`, the mockups, `FlowSteps`, `WorkflowStrip`,
`AuthSplitLayout`, etc.) were fixed as part of establishing V1, but page-level literals were
intentionally not touched to avoid redesigning page content in a tokens-only change.

**Static brand assets not yet regenerated:** `public/verax-logo.svg`, `public/verax-icon.svg`,
`public/favicon.svg` still encode the pre-V1 dark-canvas coloring (light chevron for a dark
background). `VeraxMark`/`VeraxLogo` in `components/brand/VeraxLogo.jsx` are fixed; the four
files are meant to share one geometry (per the original brand-mark note) and should be
regenerated together.

**Image system:** `public/images/{documents,photography,editorial}/` and
`public/product/{document-processing,reconciliation,classification,gst,tally,dashboard,
whatsapp}/` exist with READMEs documenting intended contents. No assets populated yet.

---

## 8. Logo

Unchanged geometry from the original mark — two overlapping angular chevrons pointing right —
only the tone default flipped for V1.

- **Concept:** forward movement (documents advancing through the pipeline) and simultaneously a
  tick rotated onto its side — verification, which is what *verax* means.
- Left chevron is always the brand violet (`#6657D9`). The right chevron and the overlap wash
  flip with `tone`: `tone="dark"` (default) is a dark-navy right chevron for the ivory/white
  canvas; `tone="light"` is a light right chevron for a deep-navy contrast section (e.g. inside
  `AuthSplitLayout`'s brand panel).
- Angular, not rounded: `stroke-linejoin: miter`, flat terminals.
- Wordmark: "Verax", Inter 700, tracking `-0.02em`, optical gap of `0.34 × mark-size`.
- Intended height: **32px** for the full lockup in the navbar.

`components/brand/VeraxLogo.jsx` is the only logo implementation — do not reintroduce
`PublicLayout`'s old gradient-box text logo anywhere.

---

# V2 — "The Ledger" (marketing surface)

Added 2026-08-09. Applies to `/` and the shared nav/footer chrome. Everything above this line
still describes V1 and still applies to the auth and magic-link upload pages.

## 9. What V2 changes, and why

| | V1 | V2 |
|---|---|---|
| Primary | violet accent on ivory, navy for contrast panels | **near-black `carbon`** for ink *and* for every full-bleed contrast section |
| Accent | `brand-500 #6657D9` everywhere a CTA appears | same violet, but **scarcer** — the nav pill, eyebrow marks, capture brackets, one rule under the closing headline. The page CTA is a carbon fill. |
| Evidence | product mockups throughout | mockups appear **once**, in `ReviewExperience` |
| Sections | claim + mockup, alternating | claim + **a drawing made of Sheets, Fields, Marks and Rails** |
| Headlines | `.vx-display` / `.vx-h2` | `.vx-display-xl` / `.vx-h2-xl`, larger and tighter |

Three references were studied, none copied: **MindMarket** for editorial pacing (a claim gets air,
not a card), **Linear/Stripe-class fintech** for restraint and hairline detailing, **Coda** for
pairing a claim with real UI. What is Verax's own is the ledger vocabulary in §10 — it comes from
the product's actual subject matter (paper, fields, validation marks) rather than from a
visual-design trend.

### Colour

| Role | Hex | Token |
|---|---|---|
| Page background (paper) | `#F7F6F2` | `bg-canvas` |
| Raised surface | `#FFFFFF` | `bg-surface` |
| Contrast section / primary ink | `#08090B` / `#0E1013` | `carbon-950` / `carbon-900` |
| Body copy | `#3E434E` → `#6B717D` | `carbon-500` / `carbon-400` |
| Copy on carbon | `#C8CCD3` / `#9AA0AB` | `carbon-200` / `carbon-300` |
| Accent (scarce) | `#6657D9` | `brand-500` |
| Validated | `#14B8A6` / `#0D9488` | `verify-500` / `verify-600` |
| Exception | `#F59E0B` / `#D97706` | `amber-500` / `amber-600` |
| Hairline | `#E5E3DD` | `border-hairline` |

`carbon` is warm-neutral rather than blue-black so it sits with the ivory canvas instead of
reading as a second, cooler palette. **Green and amber are semantic only** — validated and
needs-review. Never decorative, never a background.

### Type

Inter for everything; **IBM Plex Mono (`.vx-mono`) exclusively for extracted values** — GSTINs,
invoice numbers, amounts, XML, `structured_data` keys, section indices. Mono is the site's way of
saying "a machine produced this string", so using it for a headline would spend the one signal it
has. `.vx-display-xl` tops out at 92px, which is set by the longest line on the page
("Accounting-ready data out.") fitting the 1200px shell — headlines are **two lines, never three**.

## 10. The primitives (`components/marketing/ledger.jsx`)

- `Sheet` — hairline rectangle, folded corner, type label, ruled lines. Size comes from the caller
  so a pile can be mismatched, which is what a client's paperwork actually looks like.
- `Field` — small uppercase label, mono value, optional Mark. The unit of "understood".
- `Tick` / `Caret` — validated / needs a human. **Different shapes, not just different hues**, so
  the distinction survives colour-blindness and greyscale.
- `Rail` / `RailV` / `FlowRail` — the dashed track. `FlowRail` is horizontal on desktop and
  vertical on mobile, so a left-to-right flow becomes top-to-bottom on a phone without either
  layout resorting to an arrow glyph.
- `Eyebrow`, `SectionHead`, `Section` — section furniture. `Section` carries the `.vx-section`
  rhythm and the optional `dark` (carbon) ground.

**There is deliberately no card primitive and no feature-grid primitive.** Sections are ruled
columns and drawings on the canvas. The only bordered containers on the page are things that are
genuinely a picture of software.

## 11. The homepage, section by section

| # | Section | What its visual does |
|---|---|---|
| 1 | Hero — `DocumentFlowVisual` | six drifting mismatched sheets → a carbon Verax slab with a scan band → a ledger of validated fields |
| 2 | `ProofBand` | states the founding-customer phase plainly and lists capabilities instead of logos |
| 3 | `ProblemSection` | the eight manual steps, with three ghosted repeats stacked behind — repetition drawn, not asserted |
| 4 | `TransformationSection` | 216 marks resolving to ticks and nine carets: automation takes the majority, people take the exceptions |
| 5 | `DocumentTypes` | four types, four *different* drawings |
| 6 | `VeraxEngine` (dark) | six stages on a long rule, each naming what it produces |
| 7 | `DocumentDecode` | the signature: a drawn invoice, capture brackets snapping onto real field elements, then `structured_data`, then the checks |
| 8 | `ReviewExperience` | the one appearance of real product UI, as evidence |
| 9 | `ClientWorkflow` | SME → Verax → firm, on one rail |
| 10 | `TallySection` (dark) | the genuine XML shape `tally-xml.service.js` emits |
| 11 | `Outcomes` | six outcomes as ruled columns; no icons, no invented numbers |
| 12 | `ClosingCTA` (dark) | the page's ending, on near-black |

Dark grounds appear exactly three times (6, 10, 12) so arriving on one still means something.

## 12. Motion, honesty, accessibility

**Motion** keeps V1's contract (`components/public/motion.jsx`): one curve (expo-out), 40px, 0.8s,
0.1s stagger, everything fires once. V2 adds four CSS loops — the hero sheets' float, two scan
bands, and the rail dashes — chosen as CSS rather than Framer so a six-sheet pile costs nothing on
the main thread. All of them live inside `.vx-page`, whose `prefers-reduced-motion` block in
`index.css` disables them, and every Framer entrance additionally checks `useReducedMotion()`.
The scan band is the site's one piece of semantic motion: it means *reading*.

**Honesty rules** (these are design rules here, not just copy rules):
- No customer names, logos, testimonials or counts until they exist.
- No accuracy percentages, hours-saved figures or document volumes — nothing in the repository
  measures them.
- Numbers used for storytelling are labelled illustrative in the UI itself
  (`TransformationSection`).
- Figures shown in different sections must reconcile with each other — 42,000 + 7,560 = 49,560
  appears in the hero, the decode visual and the Tally XML. An accountant will check.
- Capability lists must correspond to shipped routes/services. See `FEATURE_STATUS.md`.

**Accessibility**: semantic landmarks (`main`, `nav`, `footer`, `section`), one `h1`, `h2` per
section; decorative drawings carry `aria-hidden`; every interactive element has a visible
`focus-visible` ring against its own ground (`ring-offset-canvas` on paper,
`ring-offset-carbon-950` on dark); status/exception are distinguished by shape as well as colour;
the closing form has its own on-dark variant because the two pre-existing ones failed contrast on
carbon.
