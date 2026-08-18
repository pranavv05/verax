import { motion } from "framer-motion";
import { MockupShell, MockupTopBar, useRowMotion } from "./MockupFrame";

const ROWS = [
  {
    gstin: "…1234F1Z5",
    invoice: "INV-001",
    amount: "₹49,560",
    status: "Matched",
    tone: "teal"
  },
  {
    gstin: "…5678G2Z3",
    invoice: "INV-047",
    amount: "₹12,400",
    status: "Mismatched",
    tone: "amber",
    note: "Taxable value differs by ₹1,180"
  },
  {
    gstin: "…9012H3Z4",
    invoice: "INV-091",
    amount: "₹8,750",
    status: "Not Found",
    tone: "red",
    note: "Not filed by supplier in this period"
  }
];

const TONES = {
  teal: "bg-verify-500/15 text-verify-700",
  amber: "bg-amber-500/15 text-amber-700",
  red: "bg-red-500/15 text-red-700"
};

/**
 * GSTR-2B reconciliation. The three states — matched, mismatched, not found —
 * are the whole story of the section, so each gets its own semantic colour and
 * the two failing rows carry the reason inline rather than hiding it behind a
 * click. That inline reason is the difference between a status table and
 * something a CA can act on.
 */
const ReconMockup = ({ trigger = "view", className = "" }) => {
  const row = useRowMotion(trigger);

  return (
    <MockupShell width={640} height={400} className={className}>
      <MockupTopBar title="GSTR-2B Reconciliation" status="March 2026" />

      <div className="flex h-[352px] flex-col px-5 py-4">
        {/* Header row */}
        <div className="flex items-center gap-3 border-b border-hairline px-2 pb-2.5">
          <span className="w-[104px] flex-none text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
            GSTIN
          </span>
          <span className="w-[86px] flex-none text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
            Invoice
          </span>
          <span className="flex-1 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
            Amount
          </span>
          <span className="w-[104px] flex-none text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
            Status
          </span>
        </div>

        <div className="divide-y divide-hairline">
          {ROWS.map((entry, index) => (
            <motion.div key={entry.invoice} {...row(index, 0.15)} className="px-2 py-3.5">
              <div className="flex items-center gap-3">
                <span className="w-[104px] flex-none text-[12px] font-medium text-zinc-400">
                  {entry.gstin}
                </span>
                <span className="w-[86px] flex-none text-[12px] font-medium text-zinc-200">
                  {entry.invoice}
                </span>
                <span className="flex-1 text-right text-[12px] font-semibold text-zinc-100">
                  {entry.amount}
                </span>
                <span className="w-[104px] flex-none text-right">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      TONES[entry.tone]
                    }`}
                  >
                    {entry.status}
                  </span>
                </span>
              </div>
              {entry.note ? (
                <p className="mt-1.5 text-[10px] font-medium text-zinc-600">{entry.note}</p>
              ) : null}
            </motion.div>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-hairline pt-3">
          <p className="text-[11px] font-medium text-zinc-600">
            Showing 3 of 500 invoices
          </p>
          <span className="rounded-md border border-hairline px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
            Export to Excel
          </span>
        </div>
      </div>
    </MockupShell>
  );
};

export default ReconMockup;
