# Verax — Public Surface Design System (V3)

This is the reference for every page a visitor can reach **before logging in**: the homepage, the
marketing pages (`/features`, `/pricing`, `/about`, `/security`), the legal pages (`/privacy`,
`/terms`), the auth pages (`/login`, `/signup`, `/forgot-password`, `/reset-password/:token`,
`/client-portal/login`), the client upload pages (`/upload/:token`, `/upload/:token/status`) and
the 404. It documents the system the homepage was rebuilt in (September 2026) so every other public
page can be built to the same standard.

The signed-in app (firm dashboard and client portal) is built from the same parts and documented in
§11. Every public token is namespaced (`vx-*`, `canvas`, `hairline`, `carbon`, `brand`, `sky`,
`verify`); the app's are `ui-*`, so the two never collide.

> History: V1 (light-first, 2026-07) and V2 "The Ledger" (mono labels, ruled-paper Sheets,
> 2026-08) are superseded. `components/marketing/ledger.jsx` still exports `Tick` and `Caret`, which
> V3 keeps; its `Eyebrow`, `SectionHead`, `Section`, `Sheet` and `Field` are V2 and should not be used
> on new work.

---

## 1. References, and what was taken from each

| Reference | Taken |
|---|---|
| **Stripe** | Colour field + silk ribbons behind a crisp headline; the vivid gradient second line; two-tone section headings (statement, then a muted continuation); morphing nav dropdown; dashed column rules; the `›` hover arrow. |
| **Mercury** | Centred compositions and air; the page background itself changing from light to dark as sections pass (`ThemeCanvas`); the joined pricing panel; restrained sign-in card; dense, readable footer. |
| **Linear** | Hover pill in the nav; hairline-divided columns instead of boxes; "Everything in X, plus" plan inheritance; quiet, confident type. |
| **Ramp / Vercel** | Final conversion point in the footer; oversized wordmark; cursor-lit surfaces. |

Nothing is copied. Each idea is re-drawn in Verax's palette with Verax's own data.

---

## 2. Colour

Canvas and ink:

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F7F6F2` | The page. Warm ivory, never pure white. |
| white | `#FFFFFF` | Cards, windows, panels on the canvas. |
| inset surface | `#F5F5F7` | The well a mockup sits in, inside a white card (bento tiles). |
| `hairline` | `#E5E3DD` | Rules and borders on the canvas. On white: `carbon-900/[0.07]`. |
| `carbon-950` | `#08090B` | Dark bands, footer on the homepage. |
| `carbon-900` | `#0E1013` | Headlines and strong text. |
| `carbon-500` | `#3E434E` | Body copy. |
| `carbon-400` | `#6B717D` | Muted text, the tint half of a heading, captions. |

Accents — each has one job:

| Token | Use |
|---|---|
| `brand-500` `#6657D9` | The primary CTA fill, focus rings, active states, small emphasis. Never a background wash. |
| `sky-500` `#4D8DFF` | Secondary accent inside product mockups; the middle stop of the gradient. |
| `verify-500/600/700` | Validated / success / "matched". The only green. |
| `amber-500/600/700` | Needs a person / warning. |
| `rose-500/700` | Error / "not in 2B". |

The brand gradient is **violet → blue → teal** (`#6657D9 → #4D8DFF → #14B8A6`), always at ~95°:

- `.vx-hero-gradient` — gradient text on light grounds (hero second line, kicker labels).
- `.vx-hero-gradient-dark` — the lifted version for near-black grounds.
- Soft light: large `radial-gradient`s of the same hues at 10–25% alpha (hero colour field,
  `Aurora`, ProofBand glow). Warm peach `rgba(245,180,90,…)` may join as a fourth light.

Rules: one saturated fill per view (the brand CTA); colour appears as **light**, not as flat tinted
boxes; status colours only mean status.

---

## 3. Typography

One family: **Inter** (`font-inter`), tabular figures (`tabular-nums`) wherever numbers align.
Mono (`.vx-mono`) is only for strings a machine reads — GSTINs, file names, code.

| Role | Spec |
|---|---|
| Hero / page H1 | `font-semibold`, `clamp(2.5rem, 6vw, 4.75rem)` on the homepage, `clamp(2.5rem, 5vw, 4rem)` on sub-pages; `leading-[1.04]`, `tracking-[-0.045em]`, `text-carbon-900`. Second line in `.vx-hero-gradient`. |
| Section H2 | `font-normal`, `clamp(1.75rem, 2.9vw, 2.375rem)`, `leading-[1.14]`, `tracking-[-0.03em]`. Two-tone: statement in `carbon-900`, continuation in `carbon-400` (`Heading` `title` + `tint`). |
| Card / H3 | `text-[1.0625rem]–[1.25rem]`, `font-medium` or `font-normal`, `tracking-[-0.015em]–[-0.02em]`. |
| Lead | `text-[1.0625rem] sm:text-[1.1875rem]`, `leading-[1.7]`, `text-carbon-500`, max ~40rem. |
| Body | `text-[0.9375rem]–[1rem]`, `leading-[1.6]–[1.75]`, `text-carbon-500/600`. |
| Kicker | `Kicker`: 13px semibold gradient text with a gradient dot. Opens a section; sentence case. |
| Small / meta | `text-[0.8125rem]`, `text-carbon-400`. |

Weights: 400 for section headings, 500 for emphasis, 600 for H1 and figures. Avoid 700/800 — the
V2 extra-bold look is retired.

---

## 4. Layout and rhythm

- **Shell:** `.vx-shell` — `max-w-[1200px]`, `px-6 sm:px-8 lg:px-10`.
- **Section rhythm:** `Band` — `py-20 sm:py-28 lg:py-36`, `scroll-mt-16`, optional `aurora`, optional
  `dark`. Dark bands paint near-black only in their middle and fade at both edges; `ThemeCanvas`
  cross-fades the page to the same black, so there is never a hard seam.
- **Page anatomy (sub-pages):** `PageHero` → 3–5 light bands → at most **one** dark band →
  `ClosingCTA` (dark, fades in from the top) → footer. Alternate left-aligned and centred headings.
- **Nav height** is 64px (`top-16` for anything sticky beneath it).
- **Mobile:** 16–24px gutters, single column, no horizontal scroll; mockups drawn on a fixed
  canvas and scaled with `FitCanvas`.

---

## 5. Surfaces

| Surface | Spec |
|---|---|
| Card | `rounded-2xl` (or `rounded-[22px]` for bento tiles), `border border-carbon-900/[0.07]`, `bg-white`, shadow `0_1px_2px_rgba(14,16,19,0.04)`; on hover a soft violet-tinted lift `0_30px_70px_-45px_rgba(38,30,110,0.3)`. |
| Glass card | `GlowCard`: `border-white/70 bg-white/80 backdrop-blur` with a cursor-following spotlight; `dark` variant `border-white/10 bg-white/[0.03]`. |
| Inset well | `rounded-[16px] bg-[#F5F5F7]` with a faint 16px dot grid masked to an ellipse. Mockups sit here. |
| Product window | White, `rounded-xl`, `border-[#E6E5EA]`, `SOFT_SHADOW` (`0_1px_2px_rgba(14,16,19,0.05),0_14px_34px_-18px_rgba(14,16,19,0.22)`); `WindowChrome` for traffic-light chrome. |
| Hero stage | A blurred gradient pool behind a glass bezel (`rounded-[20px] border-white/70 bg-white/40 p-2 backdrop-blur-xl`). |
| Panel strip | Bottom strip of a card/panel: `border-t` + `bg-[#FAFAFB]`, 12.5px text, one aside + one `›` action. |

Radii: 8–10px for controls, 12–16px for cards and windows, 20–22px for large tiles, full for pills.

---

## 6. Controls

- **Primary CTA:** brand pill — `h-9`/`h-10`/`h-11`, `rounded-full bg-brand-500 px-4–6 text-white`,
  `shadow-[0_1px_2px_rgba(38,30,110,0.3),inset_0_1px_0_rgba(255,255,255,0.18)]`, hover `bg-brand-600`,
  with Stripe's `HoverArrow` (chevron whose shaft draws in on hover).
- **Secondary:** glass pill — `border border-white/80 bg-white/60 backdrop-blur`, hover `bg-white`;
  on white surfaces `border-carbon-900/10 bg-white`.
- **On dark:** white pill with carbon text (`vx-cta-invert`) or glass `bg-white/[0.06]`.
- **Text action:** brand-coloured link with a `›` chevron that nudges right.
- **Inputs:** `AuthField` — soft grey fill, white + violet ring on focus, label above, error below
  with the `Caret` mark, validity with the `Tick` mark.
- **Chips / segmented controls:** pill group with a sliding active pill (`layoutId`).
- **Focus:** always visible — `focus-visible:ring-2 ring-brand-500 ring-offset-2`.

---

## 7. Motion

Shared vocabulary in `components/public/motion.jsx`:

- One curve: `EASE = [0.16, 1, 0.3, 1]` (expo-out). Reveal = 40px rise + fade over 0.8s; siblings
  0.1s apart (`RevealGroup`/`RevealItem`); everything fires once.
- Interactive motion uses soft springs (e.g. nav pill `stiffness 420, damping 36`; scroll progress
  `stiffness 60, damping 20, mass 0.6`), never bouncy.
- Scroll-linked transforms are **eased** (cubic in/out), not linear, and read from a `useSpring`
  copy of `scrollYProgress`.
- **Never animate `filter: blur()` on large layers** — it repaints every frame and can leave
  content unpainted. Blur only small text, briefly.
- Loops allowed: hero ribbons, marquee, glow drift, beams, sheen. All sit inside `.vx-page`, so
  the `prefers-reduced-motion` kill switch stops them; JS motion checks `useReducedMotion()`.
- Hover: 2–3px lift, border/shadow change, cursor spotlight. No scale past 1.02.

---

## 8. Components

| Component | File | Use |
|---|---|---|
| `Kicker`, `Heading`, `Band`, `Aurora`, `GlowCard`, `WindowChrome`, `Beam`, `ThemeCanvas`, `FitCanvas` | `marketing/v3.jsx` | Core atoms. |
| `PageHero` | `marketing/PageHero.jsx` | Sub-page hero: colour field, faint grid, kicker, two-line H1 with gradient second line, lead, actions. |
| `Reveal`, `RevealGroup`, `RevealItem`, `Counter`, `EASE` | `public/motion.jsx` | Entrance motion. |
| `Tick`, `Caret` | `marketing/ledger.jsx` | Validated / needs-a-person marks. |
| `LandingNav`, `LandingFooter`, `ClosingCTA` | `marketing/` | Page chrome and close. |
| `PublicLayout` | `layout/PublicLayout.jsx` | Nav + `ThemeCanvas` + main + footer for every marketing and legal page. |
| `AuthLayout`, `AuthCard`, `AuthHeading`, `AuthButton`, `AuthError`, `AuthLink`, `AuthField` | `auth/` | Every auth page. |
| `LegalDocument` | `legal/LegalDocument.jsx` | Privacy / Terms. |

---

## 9. Honesty rules (content)

1. **Every figure must reconcile.** Mockups reuse one firm's books: ACME Trading Co.,
   `27AABCA1234A1ZJ`, INV-2026-0417, taxable ₹42,000 + CGST/SGST ₹3,780 each = ₹49,560; buyer Mehta
   Packaging Pvt. Ltd.; suppliers Kumar & Sons `27AAACK4410B1Z8`, Sharma Enterprises
   `27AAKFS3321M1ZX`, Patel Hardware `24AAHFP9087Q1ZA`, Shree Balaji Packaging `24AAGFS7182K1ZS`.
   Every GSTIN shown must pass the checksum.
2. **Claims match the code.** Anything technical (encryption, retention, limits, AI use) must be
   true of the repository today; planned things are labelled planned.
3. **No invented customers, logos, testimonials or metrics.** Illustrative figures are labelled.
4. Marketing, Privacy and Terms must never contradict each other.

---

## 10. Accessibility

- Contrast ≥ 4.5:1 for text (on `carbon-950`, muted text is `carbon-400` or lighter).
- Every interactive element is keyboard reachable with a visible focus ring; menus support
  Escape and arrow keys.
- Decorative layers are `aria-hidden`; mockups that duplicate information are hidden from
  assistive tech or given text equivalents.
- Headings are in order (one `h1` per page).
- Motion respects `prefers-reduced-motion`.

---

## 11. The signed-in app (firm dashboard + client portal)

Rebuilt in September 2026 so logged-in screens read as the same product as the landing page — Inter,
the ivory canvas, carbon ink, one violet accent, teal for "done" — with a light and a dark theme.
References: Vercel (settings layout, stacked cards with footer strips), Linear (quiet density, hover
pill), Resend (dark surfaces).

**Theme.** Colours are CSS variables on `.vx-app` (`index.css`), exposed to Tailwind as `ui-*`
(`ui-canvas`, `ui-surface`, `ui-raised`, `ui-subtle`, `ui-inset`, `ui-line`, `ui-fg` … `ui-fg-4`,
`ui-accent`, `ui-ok`, `ui-warn`, `ui-err`, `ui-info`, `ui-chart-1/2`). `.vx-app[data-theme="dark"]`
redefines them. Don't use raw colours on app screens — use a `ui-*` token so both themes work.
`ThemeProvider` (`contexts/ThemeContext.jsx`) stores `system | light | dark` per browser;
`AppThemeRoot` applies it and mirrors it onto `<html data-app-theme>`. Tailwind's `dark:` variant
only fires inside the app.

**Frame.** `AppShell` (firm) and `ClientPortalShell` (portal): a frosted top bar with the logo, the
landing page's gliding hover pill, a gradient underline on the active item, notifications, theme
toggle and account menu. Content width is 1200px (`width="wide"` gives 1440px, used by Review).

**Components** (`components/app/`): `PageHeader` (breadcrumbs, kicker, two-tone title),
`Card`/`CardHeader`/`CardFooter`, `StatTile`, `Badge`/`Dot`, `Alert`, `Segmented`, `Progress`,
`Avatar`, `FormField`, `Modal`/`ConfirmDialog`, `TableKit` (`Toolbar`, `SearchField`,
`TableScroll`, `Pagination`), `TrendChart`, `ExportPreviewModal`, and the line icon set in
`icons.jsx`. Legacy class names still work and are themed: `panel`, `btn-primary`, `btn-secondary`,
`btn-ghost`, `btn-danger`, `btn-sm`, `btn-icon`, `field`, `label`, `link-action`, `ui-table`,
`ui-mono`.

**Rules.**
- Pill buttons; one `btn-primary` per view.
- Status colours mean status only: teal done, amber needs a person, rose failed, blue in flight,
  violet waiting on review. Badges always carry a text label.
- Sentence case everywhere; small section labels are the only uppercase text.
- Responsive grids start from `grid-cols-1` and use `minmax(0, …)` tracks so wide tables scroll
  inside their card instead of widening the page. Wrap tables in `TableScroll`.
- The two chart colours (`ui-chart-1/2`) were validated for colour-blind and normal-vision
  separation on both surfaces; don't swap them for status colours.
- The client portal keeps larger type (15–16px body) — its readers are business owners, not
  accountants.
