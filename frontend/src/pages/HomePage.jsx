import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import LandingNav from "../components/marketing/LandingNav";
import LandingFooter from "../components/marketing/LandingFooter";
import ProofBand from "../components/marketing/ProofBand";
import DemoRequestForm from "../components/marketing/DemoRequestForm";
import { Eyebrow, Section, SectionHead, Field, Tick } from "../components/marketing/ledger";
import { Reveal, RevealGroup, RevealItem } from "../components/public/motion";

/**
 * Verax marketing homepage — V3 (2026-09-22, Stripe/Mercury-inspired rebrand).
 *
 * Replaces the V2 "Ledger" composition (10 bespoke illustrated sections) with
 * a shorter, more restrained structure: one honest hero, one product proof
 * (real fields, not an abstract diagram), three plain steps, a feature grid,
 * one editorial pull-quote, one close. Stripe and Mercury's own marketing
 * pages are not visually noisy — the restraint IS the craft signal — so
 * cutting section count is part of the redesign, not a shortcut.
 *
 * `ledger.jsx`'s `Field`/`Tick`/`Section`/`SectionHead`/`Eyebrow` primitives
 * are reused rather than replaced: they're already token-driven, so they
 * picked up the new serif/carbon/brand system automatically.
 */

const STEPS = [
  {
    index: "01",
    title: "Collect",
    body: "Clients upload from a magic link, no login required. You upload directly for walk-in work. Either way, everything lands in one queue."
  },
  {
    index: "02",
    title: "Extract & validate",
    body: "OCR and an LLM read the document, then Verax checks the GSTIN, cross-checks the tax math, and flags anything that doesn't reconcile — before a human ever sees it."
  },
  {
    index: "03",
    title: "Review & export",
    body: "You confirm or correct the extracted fields in one screen, then export a Tally-ready XML voucher, balanced by construction, in one click."
  }
];

const FEATURES = [
  {
    title: "GST-aware by default",
    body: "GSTIN checksum validation, CGST/SGST/IGST cross-checks, TDS section verification and duplicate-invoice detection run on every document automatically."
  },
  {
    title: "GSTR-2B reconciliation",
    body: "Match uploaded invoices against your GSTR-2B period by period, with a clear mismatch view and an Excel export for your working papers."
  },
  {
    title: "Tally-ready export",
    body: "Every voucher balances by construction — debits equal credits — and export is blocked outright if a document's tax math doesn't reconcile."
  },
  {
    title: "A real client portal",
    body: "Clients see their own documents, reconciliation status and exports in plain English, with their own login — never your firm's."
  }
];

const HomePage = () => {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!window.location.hash) return;
    const target = document.querySelector(window.location.hash);
    if (target) {
      window.requestAnimationFrame(() =>
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
      );
    }
  }, [reduced]);

  return (
    <div className="vx-page min-h-screen">
      <LandingNav />

      <main>
        {/* ═══════════════════════════ HERO ═══════════════════════════ */}
        <section className="vx-shell pb-20 pt-16 sm:pt-24 lg:pb-28 lg:pt-28">
          <div className="grid gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
            <div>
              <Reveal>
                <Eyebrow>Financial document intelligence</Eyebrow>
              </Reveal>

              <Reveal delay={0.08}>
                <h1 className="vx-display-xl mt-7">
                  Paperwork in.
                  <br />
                  Tally-ready data out.
                </h1>
              </Reveal>

              <Reveal delay={0.16}>
                <p className="vx-body mt-8 max-w-[34rem] text-carbon-500">
                  Verax reads invoices and bank statements, validates the GST
                  math, reconciles against GSTR-2B, and exports a balanced
                  Tally voucher — so your team reviews, instead of retypes.
                </p>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                  <Link to="/signup" className="vx-cta">
                    Create a free account
                  </Link>
                  <a href="#demo" className="vx-link-action">
                    Book a demo
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                      <path d="M3 8h10m0 0-3.8-3.8M13 8l-3.8 3.8" />
                    </svg>
                  </a>
                </div>
              </Reveal>
            </div>

            {/* Product proof: real extracted fields, not an abstract diagram. */}
            <Reveal delay={0.3} className="relative">
              <div className="vx-mockup mx-auto w-full max-w-[26rem] rounded-2xl border border-hairline bg-white">
                <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
                  <span className="vx-index">Invoice · Extracted</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-verify-50 px-2.5 py-1 text-[0.6875rem] font-medium text-verify-700">
                    <Tick className="text-verify-600" />
                    Validated
                  </span>
                </div>
                <div className="px-5 py-2">
                  <Field label="Vendor" value="Sharma Enterprises" />
                  <Field label="GSTIN" value="29AABCS1429B1Z1" state="valid" />
                  <Field label="Invoice No." value="INV-2024-0847" />
                  <Field label="Taxable amount" value="₹84,500.00" />
                  <Field label="CGST + SGST" value="₹7,605.00" state="valid" />
                  <Field label="Total" value="₹92,105.00" />
                </div>
                <div className="border-t border-hairline px-5 py-4">
                  <span className="vx-cta w-full !py-2.5 !text-[0.8125rem]">Export to Tally</span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <ProofBand />

        {/* ═══════════════════════════ HOW IT WORKS ═══════════════════════════ */}
        <Section id="how-it-works">
          <SectionHead
            eyebrow="How it works"
            title="Three steps. No re-keying."
            body="The work a CA firm actually does — checking, not typing — stays with your team. Everything mechanical happens before they see the document."
          />

          <RevealGroup className="mt-16 grid gap-10 lg:grid-cols-3 lg:gap-8" amount={0.15}>
            {STEPS.map((step) => (
              <RevealItem key={step.index}>
                <span className="vx-index">{step.index}</span>
                <h3 className="mt-4 font-serif text-[1.75rem] text-carbon-900">{step.title}</h3>
                <p className="vx-body mt-3 text-carbon-500">{step.body}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </Section>

        {/* ═══════════════════════════ FEATURES ═══════════════════════════ */}
        <Section id="documents" className="border-y border-hairline bg-well">
          <SectionHead
            eyebrow="What's built in"
            title="Compliance checked before a human looks at it"
            body="Every document that lands in the queue is checked against the same rules a reviewer would apply — automatically, every time."
          />

          <RevealGroup className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2" amount={0.1}>
            {FEATURES.map((feature) => (
              <RevealItem key={feature.title} className="bg-white p-8">
                <h3 className="font-serif text-[1.375rem] text-carbon-900">{feature.title}</h3>
                <p className="vx-body mt-3 text-carbon-500">{feature.body}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </Section>

        {/* ═══════════════════════════ PULL QUOTE ═══════════════════════════ */}
        <Section>
          <Reveal className="mx-auto max-w-[46rem] text-center">
            <p className="vx-quote">
              &ldquo;The work is checking a number, not typing it twice.&rdquo;
            </p>
            <p className="vx-small mt-6 text-carbon-400">
              What Verax is built to make true for every CA firm using it.
            </p>
          </Reveal>
        </Section>

        {/* ═══════════════════════════ CLOSING CTA + DEMO FORM ═══════════════════════════ */}
        <Section id="demo" dark className="border-t border-white/10">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-12">
            <Reveal>
              <Eyebrow dark>Get started</Eyebrow>
              <h2 className="vx-h2-xl mt-6 text-white">
                See it on your own documents.
              </h2>
              <p className="vx-body mt-6 max-w-[28rem] text-carbon-300">
                Create a free account and process your first 50 documents a
                month at no cost — or book a short call and we'll walk
                through it on a real invoice from your practice.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <DemoRequestForm tone="dark" />
            </Reveal>
          </div>
        </Section>
      </main>

      <LandingFooter />
    </div>
  );
};

export default HomePage;
