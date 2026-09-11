import { Reveal, RevealGroup, RevealItem } from "../public/motion";
import { Eyebrow, Section } from "./ledger";

/**
 * The engine: six stages, on near-black.
 *
 * The section is a long left-hand rail with the stages hung off it and the
 * heading pinned beside them, so scrolling through it feels like travelling
 * down the pipeline rather than reading six cards. Each stage names what it
 * actually produces — a marketing page for a technical audience should be
 * willing to say `structured_data` out loud.
 */

const STAGES = [
  {
    index: "01",
    name: "Capture",
    body: "Clients send documents through a secure link, their own portal login, or your team uploads them directly. Monthly and weekly requests can go out on a schedule.",
    output: "document · queued"
  },
  {
    index: "02",
    name: "Understand",
    body: "The page is preprocessed and read by OCR, then a language model turns the text into named financial fields — with a confidence score attached to what it produced.",
    output: "ocr_text → structured_data"
  },
  {
    index: "03",
    name: "Validate",
    body: "GSTIN checksum and live verification. CGST + SGST + IGST cross-checked against the total. TDS rates checked against the section table. Duplicate invoices caught before they are entered twice.",
    output: "compliance results"
  },
  {
    index: "04",
    name: "Reconcile",
    body: "Purchase records matched against GSTR-2B for the period. Matched, mismatched and never-filed invoices separated, each mismatch carrying its reason.",
    output: "matched · mismatched · not found"
  },
  {
    index: "05",
    name: "Review",
    body: "Anything low-confidence, unrecognised or failing a check is raised for a person. Everything else is already done. Edits are versioned, and corrections teach the item-name mapping for next month.",
    output: "review_required → reviewed"
  },
  {
    index: "06",
    name: "Export",
    body: "Approved documents become balanced TallyPrime vouchers — party and tax ledgers, inventory lines — written as XML for one document or a whole month at once.",
    output: "tally.xml"
  }
];

const VeraxEngine = () => (
  <Section id="how-it-works" dark>
    <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
      <div>
        <Reveal className="lg:sticky lg:top-28">
          <Eyebrow dark>The Verax engine</Eyebrow>

          <h2 className="vx-h2-xl mt-6 text-white">
            From messy documents
            <br />
            to structured intelligence.
          </h2>

          <p className="vx-body mt-7 max-w-[30rem] text-carbon-300">
            Six stages run on every document that enters Verax. Five of them
            finish without anyone watching.
          </p>
        </Reveal>
      </div>

      <RevealGroup className="border-t border-white/10" stagger={0.08}>
        {STAGES.map((stage) => (
          <RevealItem
            key={stage.index}
            className="group grid gap-x-8 gap-y-4 border-b border-white/10 py-8 sm:grid-cols-[auto_1fr] lg:py-10"
          >
            <span className="vx-mono text-[0.75rem] tracking-[0.14em] text-carbon-400 transition-colors duration-300 group-hover:text-brand-400 sm:pt-1.5">
              {stage.index}
            </span>

            <div>
              <h3 className="text-[1.5rem] font-semibold tracking-[-0.025em] text-white sm:text-[1.75rem]">
                {stage.name}
              </h3>

              <p className="mt-3 max-w-[34rem] text-[0.9375rem] leading-[1.7] text-carbon-300">
                {stage.body}
              </p>

              <p className="vx-mono mt-5 inline-flex items-center gap-2.5 text-[0.6875rem] uppercase tracking-[0.1em] text-carbon-400">
                <span aria-hidden="true" className="h-px w-6 bg-brand-500" />
                {stage.output}
              </p>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  </Section>
);

export default VeraxEngine;
