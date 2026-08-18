# `public/product/`

Real screenshots of the live Verax product, organised by feature area — as
opposed to `public/images/`, which is general marketing photography, and
`src/components/marketing/mockups/`, which is hand-built fake UI (HTML/CSS/SVG)
used where a real screenshot isn't available yet.

Nothing is populated here yet. Once these exist, the intent is to let real
product screenshots stand in for (or sit alongside) the mockups on the pages
that currently use them — per the V1 direction, real UI is the primary visual
language, and the mockups were always a stand-in for it, not the destination.

Guidance for whoever populates these: capture at 2x for retina, redact any
real client/firm data, prefer the same document ("ACME Trading Co.",
INV-2026-0417 style placeholders) already used across the existing mockups so
a real screenshot and a hand-built one can sit next to each other without
looking like two different products.

## `document-processing/`
The review screen — document preview beside AI-extracted fields, confidence
score. Corresponds to `ReviewMockup.jsx`.

## `classification/`
Ledger suggestion UI — raw line item mapped to a suggested Tally ledger.
Corresponds to `LedgerMockup.jsx`.

## `reconciliation/` / `gst/`
GSTR-2B matching table — matched/mismatched/not-found rows. Corresponds to
`ReconMockup.jsx`. Split into two folders since "reconciliation" (the
workflow) and "GST" (the compliance domain) may end up needing distinct shots
as the product grows beyond GSTR-2B.

## `tally/`
The export flow — approve, click export, resulting XML/voucher in TallyPrime
itself. No existing mockup covers the TallyPrime side specifically; this is
the one folder that will need an actual screenshot rather than a retheme of
existing fake UI.

## `dashboard/`
The authenticated firm dashboard (client list, document queue, stats) — used
if the marketing site ever shows the firm-facing app beyond the review screen.

## `whatsapp/`
Roadmap feature, currently badged "In development" on the homepage. Leave
empty until the feature ships — do not mock up a WhatsApp screenshot that
doesn't correspond to a real integration.
