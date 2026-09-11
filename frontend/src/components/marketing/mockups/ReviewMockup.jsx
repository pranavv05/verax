import { motion } from "framer-motion";
import {
  ConfidenceBar,
  MockupLabel,
  MockupShell,
  MockupTopBar,
  useRowMotion
} from "./MockupFrame";
import InvoiceDocument, { INVOICE_HEIGHT, INVOICE_WIDTH } from "./InvoiceDocument";

// The document pane is 288px wide with 20px of padding on each side (p-5),
// leaving 248px to place the invoice in. Scaling by width (rather than
// height) is what keeps the whole document visible instead of cropping it.
const DOC_PANE_WIDTH = 248;
const DOC_SCALE = DOC_PANE_WIDTH / INVOICE_WIDTH;

const FIELDS = [
  { label: "Vendor", value: "ACME Trading Co." },
  { label: "GSTIN", value: "27AABCA1234A1Z5", verified: true },
  { label: "Invoice #", value: "INV-2026-0417" },
  { label: "Taxable", value: "₹42,000" },
  { label: "CGST", value: "₹3,780" },
  { label: "Total", value: "₹49,560", strong: true }
];

const Tick = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M2.5 6.3 4.7 8.5 9.5 3.7"
      stroke="#14B8A6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * The Verax review screen: document on the left, what the AI pulled out of it
 * on the right. This is the product's core moment, so it is the mockup that
 * appears in the hero and again, at a smaller size, in Document Intelligence.
 */
const ReviewMockup = ({ trigger = "view", float = false, className = "" }) => {
  const row = useRowMotion(trigger);
  const base = trigger === "load" ? 0.5 : 0.15;

  return (
    <MockupShell width={720} height={405} float={float} className={className}>
      <MockupTopBar title="Invoice Processing" status="87% Confidence" />

      <div className="flex h-[357px]">
        {/* ── Document preview ─────────────────────────────────────────── */}
        <div className="flex w-[288px] flex-none items-center justify-center border-r border-hairline bg-well p-5">
          <div
            className="overflow-hidden rounded-[4px] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={{ width: DOC_PANE_WIDTH, height: INVOICE_HEIGHT * DOC_SCALE }}
          >
            <div
              className="origin-top-left"
              style={{ width: INVOICE_WIDTH, height: INVOICE_HEIGHT, transform: `scale(${DOC_SCALE})` }}
            >
              <InvoiceDocument />
            </div>
          </div>
        </div>

        {/* ── Extracted fields ─────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col p-6">
          <MockupLabel>Extracted fields</MockupLabel>

          <div className="mt-3.5 space-y-[3px]">
            {FIELDS.map((field, index) => (
              <motion.div
                key={field.label}
                {...row(index, base)}
                className={`flex h-[26px] items-center justify-between rounded-md px-2.5 ${
                  field.strong ? "bg-indigo-500/10" : "bg-black/[0.03]"
                }`}
              >
                <span className="text-[11px] font-medium text-zinc-500">
                  {field.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`text-[12px] ${
                      field.strong
                        ? "font-semibold text-zinc-100"
                        : "font-medium text-zinc-200"
                    }`}
                  >
                    {field.value}
                  </span>
                  {field.verified ? <Tick /> : null}
                </span>
              </motion.div>
            ))}
          </div>

          <div className="mt-auto">
            <ConfidenceBar trigger={trigger} delay={base + 0.8} />

            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-verify-500/15 px-3 py-1.5 text-[11px] font-semibold text-verify-700">
                Approve
                <Tick />
              </span>
              <span className="rounded-full bg-indigo-500 px-3 py-1.5 text-[11px] font-semibold text-white">
                Export to Tally
              </span>
            </div>
          </div>
        </div>
      </div>
    </MockupShell>
  );
};

export default ReviewMockup;
