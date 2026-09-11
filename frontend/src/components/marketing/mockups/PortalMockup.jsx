import { motion } from "framer-motion";
import { MockupLabel, MockupShell, useRowMotion } from "./MockupFrame";

const STATS = [
  { value: "12", label: "Documents", tone: "text-zinc-100" },
  { value: "2", label: "Pending", tone: "text-amber-700" },
  { value: "8", label: "Complete", tone: "text-verify-700" }
];

const DOCUMENTS = [
  { name: "Purchase invoice — Mar", status: "Complete", tone: "teal" },
  { name: "Bank statement — Mar", status: "Processing", tone: "muted" },
  { name: "Telephone bill — Mar", status: "Needs your input", tone: "amber" }
];

const TONES = {
  teal: "text-verify-700",
  amber: "text-amber-700",
  muted: "text-zinc-500"
};

/**
 * The client's side of Verax, drawn deliberately plainer than the firm-facing
 * mockups: this is the screen an SME owner opens twice a month, so its job is
 * to be legible at a glance, not dense. Kept close to wireframe on purpose —
 * the section is about the relationship, not about the UI.
 */
const PortalMockup = ({ trigger = "view", className = "" }) => {
  const row = useRowMotion(trigger);

  return (
    <MockupShell width={640} height={400} className={className}>
      {/* Portal chrome — teal accent, because everything client-side is teal */}
      <div className="flex h-12 items-center justify-between border-b border-hairline bg-well px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-verify-500/20 text-[9px] font-bold text-verify-700">
            SE
          </span>
          <span className="text-[13px] font-medium text-zinc-200">
            Sharma Enterprises
          </span>
        </div>
        <span className="text-[11px] font-medium text-zinc-600">Client portal</span>
      </div>

      <div className="flex h-[352px] flex-col p-5">
        <div className="grid grid-cols-3 gap-3">
          {STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              {...row(index, 0.15)}
              className="rounded-lg border border-hairline bg-black/[0.02] px-4 py-3.5"
            >
              <p className={`text-[26px] font-bold leading-none tracking-[-0.03em] ${stat.tone}`}>
                {stat.value}
              </p>
              <p className="mt-2 text-[11px] font-medium text-zinc-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <MockupLabel className="mt-6">Recent documents</MockupLabel>

        <div className="mt-3 divide-y divide-hairline">
          {DOCUMENTS.map((document, index) => (
            <motion.div
              key={document.name}
              {...row(index + 3, 0.15)}
              className="flex items-center gap-3 py-3"
            >
              <span className="h-6 w-5 flex-none rounded-[3px] border border-hairline bg-black/[0.03]" />
              <span className="flex-1 truncate text-[12px] font-medium text-zinc-300">
                {document.name}
              </span>
              <span className={`text-[11px] font-semibold ${TONES[document.tone]}`}>
                {document.status}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2">
          <span className="rounded-full bg-verify-500 px-3 py-1.5 text-[11px] font-semibold text-[#04231F]">
            Upload documents
          </span>
          <span className="rounded-full border border-hairline px-3 py-1.5 text-[11px] font-semibold text-zinc-300">
            Download reconciliation
          </span>
        </div>
      </div>
    </MockupShell>
  );
};

export default PortalMockup;
