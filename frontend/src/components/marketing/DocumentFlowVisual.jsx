import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "../public/motion";
import { Caret, FlowRail, Field, Sheet, Tick } from "./ledger";
import { VeraxMark } from "../brand/VeraxLogo";

/**
 * The hero visual: what Verax is, drawn rather than described.
 *
 *   a pile of mismatched paperwork  →  Verax  →  a ledger of validated values
 *
 * Deliberately not a screenshot of the dashboard. The product's identity on
 * this page is the *transformation*, not its UI — the UI shows up later, once
 * the story has earned it (see ReviewExperience).
 *
 * Everything is HTML/CSS/SVG: no images, no canvas, nothing to download. The
 * pile is drawn at a fixed 300×264 design box and centred, because scattered
 * paper needs absolute positions to look scattered; the box is narrow enough
 * to fit a 375px viewport without scaling.
 */

const PILE = [
  { label: "Invoice", left: 0, top: 14, w: 112, h: 142, rotate: -7, lines: 7, delay: 0 },
  { label: "Bank statement", left: 96, top: 0, w: 122, h: 154, rotate: 4, lines: 8, delay: 0.08 },
  { label: "Receipt", left: 206, top: 34, w: 84, h: 116, rotate: 9, lines: 5, delay: 0.16 },
  { label: "Purchase register", left: 24, top: 128, w: 130, h: 118, rotate: 3, lines: 6, delay: 0.24 },
  { label: "Expense bill", left: 148, top: 146, w: 104, h: 104, rotate: -5, lines: 5, delay: 0.32 },
  { label: "GST data", left: 236, top: 150, w: 62, h: 92, rotate: 12, lines: 4, delay: 0.4 }
];

const OUTPUT = [
  { label: "Vendor", value: "ACME Trading Co.", state: "valid" },
  { label: "GSTIN", value: "27AABCA1234A1Z5", state: "valid" },
  { label: "Invoice no.", value: "INV-2026-0417", state: "valid" },
  { label: "Taxable", value: "42,000.00", state: "valid" },
  { label: "CGST + SGST", value: "7,560.00", state: "valid" },
  { label: "Total", value: "49,560.00", state: "flagged" }
];

const STAGES = ["OCR", "Extract", "Validate", "Reconcile"];

const DocumentFlowVisual = () => {
  const reduced = useReducedMotion();

  const rise = (delay) => ({
    initial: reduced ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: EASE, delay: reduced ? 0 : delay }
  });

  return (
    <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:gap-0">
      {/* ── 1. The paperwork ─────────────────────────────────────────────── */}
      <div>
        <p className="vx-index mb-6 text-center lg:text-left">In</p>

        <div className="relative mx-auto h-[264px] w-[300px] lg:mx-0">
          {PILE.map((sheet) => (
            <motion.div
              key={sheet.label}
              {...rise(sheet.delay)}
              className="absolute"
              style={{ left: sheet.left, top: sheet.top, width: sheet.w, height: sheet.h }}
            >
              {/*
                Three nested transforms, each owned by exactly one animator:
                the motion.div does the entrance (y), this div holds the static
                rotation, and the inner one carries the CSS float. Stacking them
                on one element would mean whichever wrote `transform` last wins.
                The float is CSS rather than Framer so six of them cost nothing
                on the main thread; the per-sheet delay keeps the pile from
                breathing in unison.
              */}
              <div className="h-full w-full" style={{ transform: `rotate(${sheet.rotate}deg)` }}>
                <div
                  className={`h-full w-full ${reduced ? "" : "vx-float-y"}`}
                  style={{ animationDelay: `${sheet.delay * 5}s` }}
                >
                  <Sheet
                    label={sheet.label}
                    lines={sheet.lines}
                    className="h-full w-full shadow-[0_10px_30px_-18px_rgba(14,16,19,0.5)]"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <FlowRail className="lg:w-14" />

      {/* ── 2. Verax ─────────────────────────────────────────────────────── */}
      <motion.div {...rise(0.45)} className="flex flex-col items-center">
        <p className="vx-index mb-6">Verax</p>

        <div className="relative h-[240px] w-[132px] overflow-hidden rounded-2xl bg-carbon-950 shadow-[0_30px_60px_-30px_rgba(14,16,19,0.6)]">
          <span aria-hidden="true" className="absolute inset-0 vx-sheet-dark opacity-60" />

          {/* The scan: the one motion on the page that means "reading". */}
          <span
            aria-hidden="true"
            className={`absolute inset-x-0 top-0 h-10 ${reduced ? "opacity-0" : "vx-scan-line"}`}
            style={{
              background:
                "linear-gradient(to bottom, rgba(102,87,217,0) 0%, rgba(102,87,217,0.55) 55%, rgba(102,87,217,0) 100%)"
            }}
          />

          <div className="relative flex h-full flex-col items-center justify-between py-6">
            <VeraxMark size={26} tone="light" />

            <ul className="space-y-2.5 text-center">
              {STAGES.map((stage) => (
                <li
                  key={stage}
                  className="vx-mono text-[0.5625rem] uppercase tracking-[0.14em] text-carbon-300"
                >
                  {stage}
                </li>
              ))}
            </ul>

            <span className="h-1 w-6 bg-brand-500" />
          </div>
        </div>
      </motion.div>

      <FlowRail className="lg:w-14" />

      {/* ── 3. The ledger ────────────────────────────────────────────────── */}
      <div>
        <p className="vx-index mb-6 text-center lg:text-left">Out</p>

        <motion.div
          {...rise(0.6)}
          className="mx-auto w-full max-w-[340px] rounded-2xl border border-hairline bg-white p-5 shadow-[0_24px_60px_-34px_rgba(14,16,19,0.45)] lg:mx-0 lg:max-w-none"
        >
          <div className="flex items-center justify-between">
            <span className="vx-index">Structured</span>
            <span className="vx-mono text-[0.625rem] uppercase tracking-[0.12em] text-verify-600">
              5 validated
            </span>
          </div>

          <div className="mt-3">
            {OUTPUT.map((field, index) => (
              <motion.div
                key={field.label}
                initial={reduced ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  ease: EASE,
                  delay: reduced ? 0 : 0.8 + index * 0.12
                }}
              >
                <Field label={field.label} value={field.value} state={field.state} />
              </motion.div>
            ))}
          </div>

          <motion.div
            {...rise(1.65)}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-verify-500/12 px-2.5 py-1 text-[0.6875rem] font-semibold text-verify-700">
              <Tick size={10} />
              Ready to export
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-[0.6875rem] font-semibold text-amber-700">
              <Caret size={10} />1 to review
            </span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default DocumentFlowVisual;
