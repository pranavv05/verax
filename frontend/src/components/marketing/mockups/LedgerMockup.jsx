import { motion } from "framer-motion";
import {
  MockupLabel,
  MockupShell,
  MockupTopBar,
  useRowMotion
} from "./MockupFrame";

const SUGGESTIONS = [
  {
    item: "Air Travel charges",
    amount: "₹4,134",
    ledger: "Travel Expenses",
    confidence: "94%",
    focused: true
  },
  {
    item: "Broadband — Mar 2026",
    amount: "₹1,899",
    ledger: "Telephone & Internet",
    confidence: "91%"
  },
  {
    item: "Courier — 14 consignments",
    amount: "₹640",
    ledger: "Freight Outward",
    confidence: "88%"
  }
];

const Arrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 12h13m0 0-5-5m5 5-5 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Ledger classification: a raw line item on the left, the Tally ledger Verax
 * thinks it belongs to on the right. The footer is the point of the section —
 * the suggestions come from this firm's own past corrections, not a global
 * model, which is what makes them get better month over month.
 */
const LedgerMockup = ({ trigger = "view", className = "" }) => {
  const row = useRowMotion(trigger);

  return (
    <MockupShell width={640} height={400} className={className}>
      <MockupTopBar title="Ledger Suggestions" status="3 to confirm" />

      <div className="flex h-[352px] flex-col p-5">
        <MockupLabel>Uncategorised line items</MockupLabel>

        <div className="mt-3.5 space-y-2.5">
          {SUGGESTIONS.map((suggestion, index) => (
            <motion.div
              key={suggestion.item}
              {...row(index, 0.15)}
              className={`rounded-lg border px-3.5 py-3 ${
                suggestion.focused
                  ? "border-indigo-500/40 bg-indigo-500/[0.07]"
                  : "border-hairline bg-black/[0.02]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-[168px] flex-none">
                  <p className="truncate text-[12px] font-medium text-zinc-200">
                    {suggestion.item}
                  </p>
                  <p className="mt-0.5 text-[12px] font-semibold text-zinc-400">
                    {suggestion.amount}
                  </p>
                </div>

                <span className="flex-none text-zinc-600">
                  <Arrow />
                </span>

                <div className="min-w-0 flex-1">
                  <MockupLabel>Suggested ledger</MockupLabel>
                  <p className="mt-1 truncate text-[12px] font-semibold text-zinc-100">
                    {suggestion.ledger}
                  </p>
                </div>

                <span className="flex-none rounded-full bg-verify-500/15 px-2 py-1 text-[10px] font-semibold text-verify-700">
                  {suggestion.confidence}
                </span>
              </div>

              {suggestion.focused ? (
                <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
                  <span className="rounded-md bg-verify-500 px-2.5 py-1 text-[10px] font-semibold text-[#04231F]">
                    Accept
                  </span>
                  <span className="rounded-md border border-hairline px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
                    Edit
                  </span>
                  <span className="ml-auto text-[10px] font-medium text-zinc-600">
                    Applies to all future invoices from this vendor
                  </span>
                </div>
              ) : null}
            </motion.div>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-hairline pt-3.5">
          <span className="h-1.5 w-1.5 rounded-full bg-verify-500" />
          <p className="text-[11px] font-medium text-zinc-500">
            Learned from 42 corrections your firm has already made
          </p>
        </div>
      </div>
    </MockupShell>
  );
};

export default LedgerMockup;
