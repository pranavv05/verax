import { motion, useReducedMotion } from "framer-motion";
import { EASE, Reveal } from "../public/motion";
import { Eyebrow, FlowRail, Section, Tick } from "./ledger";

/**
 * The signature visual: one document, decoded.
 *
 * A page of human-readable paper on the left; the values Verax lifted out of
 * it in the middle; the checks those values then have to survive on the right.
 * The capture brackets are rendered *around the actual fields* rather than at
 * hard-coded coordinates, so they stay aligned at every width and in every
 * font-rendering environment — which is what lets this be real markup instead
 * of a screenshot.
 *
 * The invoice is typeset in Arial, never the site's Inter: a document set in
 * the product's own typeface reads as an illustration, not as paper.
 */

const DOC_FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

/** A field being captured: hairline brackets that snap on in sequence. */
const Captured = ({ children, delay = 0 }) => {
  const reduced = useReducedMotion();

  const corner = {
    initial: reduced ? false : { opacity: 0, scale: 0.7 },
    whileInView: { opacity: 1, scale: 1 },
    viewport: { once: true, amount: 0.5 },
    transition: { duration: 0.35, ease: EASE, delay }
  };

  return (
    <span className="relative inline-block">
      {children}
      <span aria-hidden="true" className="pointer-events-none absolute -inset-[3px]">
        {[
          "left-0 top-0 border-l border-t",
          "right-0 top-0 border-r border-t",
          "bottom-0 left-0 border-b border-l",
          "bottom-0 right-0 border-b border-r"
        ].map((position) => (
          <motion.span
            key={position}
            {...corner}
            className={`absolute h-[6px] w-[6px] border-brand-500 ${position}`}
          />
        ))}
      </span>
    </span>
  );
};

/* ── Stage 1: the paper ─────────────────────────────────────────────────── */

const PaperInvoice = () => {
  const reduced = useReducedMotion();

  return (
    <div
      className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-[3px] border border-hairline bg-white px-5 py-5 text-carbon-900 shadow-[0_26px_60px_-36px_rgba(14,16,19,0.55)]"
      style={{ fontFamily: DOC_FONT }}
    >
      {/* The read. One soft indigo band, once per loop. */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-12 ${reduced ? "hidden" : "vx-scan-line"}`}
        style={{
          background:
            "linear-gradient(to bottom, rgba(102,87,217,0) 0%, rgba(102,87,217,0.14) 55%, rgba(102,87,217,0) 100%)"
        }}
      />

      <div className="relative">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-carbon-400">
          Tax invoice
        </p>

        <p className="mt-3 text-[13px] font-bold leading-tight">
          <Captured delay={0.1}>ACME Trading Co.</Captured>
        </p>
        <p className="mt-1.5 text-[9px] leading-[1.5] text-carbon-500">
          Plot 14, MIDC Industrial Area
          <br />
          Pune, Maharashtra 411019
        </p>
        <p className="mt-2 text-[9px]">
          GSTIN:{" "}
          <span className="font-bold">
            <Captured delay={0.25}>27AABCA1234A1Z5</Captured>
          </span>
        </p>

        <div className="mt-4 flex justify-between border-y border-carbon-100 py-2 text-[9px]">
          <span>
            Invoice&nbsp;
            <span className="font-bold">
              <Captured delay={0.4}>INV-2026-0417</Captured>
            </span>
          </span>
          <span>
            Dated&nbsp;<span className="font-bold">17-03-2026</span>
          </span>
        </div>

        <table className="mt-3 w-full text-[8.5px]">
          <thead>
            <tr className="text-carbon-400">
              <th className="pb-1 text-left font-normal">Description</th>
              <th className="pb-1 text-right font-normal">Qty</th>
              <th className="pb-1 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {[
              ["Industrial Packaging Rolls", "80", "20,000.00"],
              ["Corrugated Cartons — Size B", "150", "15,000.00"],
              ["BOPP Adhesive Tape", "14", "7,000.00"]
            ].map(([description, qty, amount]) => (
              <tr key={description} className="border-t border-carbon-100">
                <td className="py-[3px] pr-2">{description}</td>
                <td className="py-[3px] text-right">{qty}</td>
                <td className="py-[3px] text-right">{amount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 space-y-[3px] border-t border-carbon-100 pt-2 text-[8.5px]">
          <div className="flex justify-between">
            <span>Taxable value</span>
            <span>42,000.00</span>
          </div>
          <div className="flex justify-between">
            <span>CGST 9% / SGST 9%</span>
            <span>3,780.00 / 3,780.00</span>
          </div>
          <div className="flex justify-between pt-1 text-[10px] font-bold">
            <span>Total</span>
            <span>
              <Captured delay={0.55}>₹49,560.00</Captured>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Stage 2: the values ────────────────────────────────────────────────── */

const EXTRACTED = [
  { key: "supplier_name", value: "ACME Trading Co." },
  { key: "vendor_gstin", value: "27AABCA1234A1Z5" },
  { key: "invoice_number", value: "INV-2026-0417" },
  { key: "invoice_date", value: "2026-03-17" },
  { key: "taxable_value", value: "42000.00" },
  { key: "cgst / sgst", value: "3780.00 / 3780.00" },
  { key: "total_amount", value: "49560.00" }
];

const ExtractedValues = () => {
  const reduced = useReducedMotion();

  return (
    <div className="mx-auto w-full max-w-[300px] rounded-xl border border-hairline bg-carbon-950 p-4">
      <p className="vx-index text-carbon-300">structured_data</p>

      <div className="mt-4 space-y-[7px]">
        {EXTRACTED.map((entry, index) => (
          <motion.div
            key={entry.key}
            initial={reduced ? false : { opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.7 + index * 0.09 }}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="vx-mono text-[0.625rem] text-carbon-400">{entry.key}</span>
            <span className="vx-mono truncate text-[0.6875rem] text-white">
              {entry.value}
            </span>
          </motion.div>
        ))}
      </div>

      <p className="vx-mono mt-5 border-t border-white/10 pt-3 text-[0.625rem] text-carbon-400">
        confidence <span className="text-verify-400">0.87</span>
      </p>
    </div>
  );
};

/* ── Stage 3: the checks ────────────────────────────────────────────────── */

const CHECKS = [
  { label: "GSTIN checksum", detail: "27 · Maharashtra · valid" },
  { label: "Tax math", detail: "42,000 + 7,560 = 49,560" },
  { label: "Duplicate check", detail: "no prior match this firm" },
  { label: "GSTR-2B", detail: "matched · March 2026" }
];

const Checks = () => {
  const reduced = useReducedMotion();

  return (
    <div className="mx-auto w-full max-w-[300px]">
      {CHECKS.map((check, index) => (
        <motion.div
          key={check.label}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45, ease: EASE, delay: 1.5 + index * 0.12 }}
          className="flex items-start gap-3 border-b border-hairline py-3.5 first:pt-0"
        >
          <span className="mt-[3px] text-verify-600">
            <Tick size={12} />
          </span>
          <span className="flex-1">
            <span className="block text-[0.8125rem] font-medium text-carbon-900">
              {check.label}
            </span>
            <span className="vx-mono mt-1 block text-[0.6875rem] text-carbon-400">
              {check.detail}
            </span>
          </span>
        </motion.div>
      ))}

      <motion.p
        initial={reduced ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: EASE, delay: 2.05 }}
        className="mt-6 text-[0.8125rem] leading-[1.65] text-carbon-500"
      >
        Nothing here needed a person. The document is ready to become a
        voucher.
      </motion.p>
    </div>
  );
};

/* ── The section ────────────────────────────────────────────────────────── */

const DocumentDecode = () => (
  <Section id="intelligence">
    <Reveal className="mx-auto max-w-[46rem] text-center">
      <Eyebrow className="justify-center">Document intelligence</Eyebrow>
      <h2 className="vx-h2-xl mt-6">
        A page of paper,
        <br />
        taken apart.
      </h2>
      <p className="vx-body mx-auto mt-7 max-w-[34rem] text-carbon-500">
        What a human reads in ninety seconds and retypes in four minutes,
        Verax reads once and never has to read again.
      </p>
    </Reveal>

    <div className="mt-20 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:gap-0">
      <div>
        <p className="vx-index mb-5 text-center">Read</p>
        <PaperInvoice />
      </div>

      <FlowRail className="lg:w-12" />

      <div>
        <p className="vx-index mb-5 text-center">Extracted</p>
        <ExtractedValues />
      </div>

      <FlowRail className="lg:w-12" />

      <div>
        <p className="vx-index mb-5 text-center">Checked</p>
        <Checks />
      </div>
    </div>
  </Section>
);

export default DocumentDecode;
