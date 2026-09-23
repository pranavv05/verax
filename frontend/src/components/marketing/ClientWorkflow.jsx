import { motion, useReducedMotion } from "framer-motion";
import { Counter, EASE, RevealGroup, RevealItem } from "../public/motion";
import { VeraxMark } from "../brand/VeraxLogo";
import { Caret, Tick } from "./ledger";
import { Beam, Band, Heading } from "./v3";

/**
 * The relationship the product sits inside: a business on one side, its CA
 * firm on the other, and the month of paperwork that has to cross between
 * them. Three live surfaces on one line — the client's phone on the upload
 * link, Verax in the middle, the firm's month-end queue — because the handover
 * *is* the product, not a feature of it.
 *
 * Queue figures match TransformationSection's illustrative 207 / 9 split.
 */

const inView = { initial: "hidden", whileInView: "visible", viewport: { once: true, amount: 0.35 } };

/* ── The client's phone ─────────────────────────────────────────────────── */

const UPLOADS = [
  { label: "Sales invoices", files: "12 files", progress: 100 },
  { label: "Purchase bills", files: "9 files", progress: 100 },
  { label: "Bank statement", files: "1 PDF", progress: 64, live: true },
  { label: "Expense bills", files: "Outstanding", progress: 0 }
];

const Phone = () => {
  const reduced = useReducedMotion();

  return (
    <motion.div
      {...inView}
      className="mx-auto w-[248px] rounded-[2.25rem] border border-carbon-900/10 bg-carbon-950 p-2 shadow-[0_40px_80px_-40px_rgba(38,30,110,0.6)]"
    >
      <div className="overflow-hidden rounded-[1.8rem] bg-canvas">
        <div className="flex justify-center pt-2">
          <span className="h-1.5 w-16 rounded-full bg-carbon-900/15" />
        </div>
        <div className="px-4 pb-5 pt-4">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-carbon-400">
            Secure upload link
          </p>
          <p className="mt-1 text-[0.9375rem] font-semibold text-carbon-900">March documents</p>
          <p className="text-[0.6875rem] text-carbon-500">Requested by your CA · due 7 Apr</p>

          <div className="mt-4 space-y-2">
            {UPLOADS.map((item, index) => (
              <motion.div
                key={item.label}
                variants={{
                  hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 10 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.45, ease: EASE, delay: reduced ? 0 : 0.2 + index * 0.12 }
                  }
                }}
                className="rounded-xl border border-hairline bg-white px-3 py-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[0.75rem] font-medium text-carbon-900">{item.label}</span>
                  {item.progress === 100 ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-verify-500 text-white">
                      <Tick size={8} />
                    </span>
                  ) : item.progress === 0 ? (
                    <span className="h-4 w-4 rounded-full border border-dashed border-carbon-300" />
                  ) : (
                    <span className="vx-mono text-[0.625rem] text-brand-600">{item.progress}%</span>
                  )}
                </div>
                <p className="mt-0.5 text-[0.625rem] text-carbon-400">{item.files}</p>
                {item.live ? (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-carbon-100">
                    <motion.div
                      variants={{
                        hidden: { width: reduced ? "64%" : "0%" },
                        visible: {
                          width: "64%",
                          transition: { duration: 1.6, ease: EASE, delay: reduced ? 0 : 0.8 }
                        }
                      }}
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sky-500"
                    />
                  </div>
                ) : null}
              </motion.div>
            ))}
          </div>

          <div className="mt-4 rounded-full bg-carbon-900 py-2.5 text-center text-[0.75rem] font-semibold text-white">
            Add files
          </div>
          <p className="mt-2 text-center text-[0.625rem] text-carbon-400">No login needed</p>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Verax ──────────────────────────────────────────────────────────────── */

const Hub = () => {
  const reduced = useReducedMotion();

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative flex h-40 w-40 items-center justify-center">
        {!reduced
          ? [0, 1, 2].map((ring) => (
              <span
                key={ring}
                aria-hidden="true"
                className="vx-ring absolute inset-6 rounded-full border border-brand-500/40"
                style={{ animationDelay: `${ring}s` }}
              />
            ))
          : null}
        <span
          aria-hidden="true"
          className="absolute inset-8 rounded-full bg-gradient-to-br from-brand-500 via-sky-500 to-verify-500 opacity-40 blur-2xl"
        />
        <span className="relative flex h-24 w-24 items-center justify-center rounded-[1.75rem] border border-white/10 bg-carbon-950 shadow-[0_30px_60px_-20px_rgba(102,87,217,0.7)]">
          <VeraxMark size={34} tone="light" />
        </span>
      </div>

      <div className="mt-4 flex max-w-[15rem] flex-wrap justify-center gap-1.5">
        {["Collect", "Extract", "Validate", "Reconcile"].map((stage) => (
          <span
            key={stage}
            className="rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[0.6875rem] font-medium text-carbon-600 shadow-sm"
          >
            {stage}
          </span>
        ))}
      </div>
      <p className="mt-4 max-w-[15rem] text-center text-[0.8125rem] leading-[1.6] text-carbon-500">
        Runs the moment a document lands, at any hour, without anyone starting it.
      </p>
    </div>
  );
};

/* ── The firm's queue ───────────────────────────────────────────────────── */

const CLIENTS = [
  { name: "ACME Trading Co.", docs: 42, state: "ready" },
  { name: "Shree Balaji Packaging", docs: 18, state: "review" },
  { name: "Kumar & Sons", docs: 27, state: "processing" },
  { name: "Patel Hardware", docs: 31, state: "ready" }
];

const STATE = {
  ready: { label: "Ready to export", className: "bg-verify-500/12 text-verify-700" },
  review: { label: "1 to review", className: "bg-amber-500/12 text-amber-700" },
  processing: { label: "Processing", className: "bg-brand-500/10 text-brand-700" }
};

const FirmQueue = () => {
  const reduced = useReducedMotion();

  return (
    <motion.div
      {...inView}
      className="overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-[0_40px_80px_-40px_rgba(38,30,110,0.5)] backdrop-blur"
    >
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <div>
          <p className="text-[0.6875rem] text-carbon-400">Your firm</p>
          <p className="text-[0.9375rem] font-semibold text-carbon-900">March close</p>
        </div>
        <span className="vx-mono text-[0.6875rem] text-carbon-400">all clients</span>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-hairline p-4">
        <div className="rounded-xl bg-verify-50/80 px-3.5 py-3">
          <p className="text-[0.6875rem] font-medium text-verify-700">Ready to export</p>
          <p className="mt-1 font-inter text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-carbon-900">
            <Counter value={207} />
          </p>
        </div>
        <div className="rounded-xl bg-amber-500/[0.07] px-3.5 py-3">
          <p className="text-[0.6875rem] font-medium text-amber-700">Needs review</p>
          <p className="mt-1 font-inter text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-amber-600">
            <Counter value={9} />
          </p>
        </div>
      </div>

      <ul className="p-2">
        {CLIENTS.map((client, index) => (
          <motion.li
            key={client.name}
            variants={{
              hidden: reduced ? { opacity: 1 } : { opacity: 0, x: 12 },
              visible: {
                opacity: 1,
                x: 0,
                transition: { duration: 0.45, ease: EASE, delay: reduced ? 0 : 0.3 + index * 0.1 }
              }
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5"
          >
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-brand-500/15 to-sky-500/15 text-[0.6875rem] font-semibold text-brand-700">
              {client.name[0]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-medium text-carbon-900">{client.name}</span>
              <span className="block text-[0.6875rem] text-carbon-400">{client.docs} documents</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold ${
                STATE[client.state].className
              }`}
            >
              {client.state === "processing" ? (
                <span className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
              ) : client.state === "review" ? (
                <Caret size={9} />
              ) : (
                <Tick size={9} />
              )}
              {STATE[client.state].label}
            </span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
};

/* ── Section ────────────────────────────────────────────────────────────── */

const CLIENT_POINTS = [
  "Upload from a secure link, or their own portal login",
  "See what's received and what's still outstanding",
  "Get asked for the month's documents automatically"
];

const FIRM_POINTS = [
  "Everything filed against the right client on arrival",
  "Reviewed only where a check failed or confidence was low",
  "Every upload, edit, approval and export in the audit log"
];

const Points = ({ items }) => (
  <ul className="mt-6 space-y-2.5">
    {items.map((item) => (
      <li key={item} className="flex gap-2.5 text-[0.875rem] leading-[1.55] text-carbon-600">
        <span className="mt-[3px] flex h-4 w-4 flex-none items-center justify-center rounded-full bg-carbon-900 text-white">
          <Tick size={8} />
        </span>
        {item}
      </li>
    ))}
  </ul>
);

const ClientWorkflow = () => (
  <Band id="workflow" aurora>
    <Heading
      align="center"
      kicker="Client ↔ firm"
      title="Built for the work between"
      tint="businesses and their CAs."
      lead="Chasing documents, filing them against the right client and telling people where things stand is most of the month. Verax takes that part."
    />

    <RevealGroup
      className="mt-16 grid items-center gap-6 lg:grid-cols-[1fr_56px_0.8fr_56px_1.1fr] lg:gap-0"
      stagger={0.12}
    >
      <RevealItem>
        <p className="mb-5 text-center text-[0.8125rem] font-semibold text-carbon-500">The business</p>
        <Phone />
        <div className="mx-auto max-w-[19rem]">
          <Points items={CLIENT_POINTS} />
        </div>
      </RevealItem>

      <RevealItem>
        <Beam />
      </RevealItem>

      <RevealItem>
        <Hub />
      </RevealItem>

      <RevealItem>
        <Beam delay={1.1} />
      </RevealItem>

      <RevealItem>
        <p className="mb-5 text-center text-[0.8125rem] font-semibold text-carbon-500">The CA firm</p>
        <FirmQueue />
        <Points items={FIRM_POINTS} />
      </RevealItem>
    </RevealGroup>
  </Band>
);

export default ClientWorkflow;
