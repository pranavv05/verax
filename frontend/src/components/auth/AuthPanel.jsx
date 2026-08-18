import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "../public/motion";
import { Field, RailV, Sheet, Tick } from "../marketing/ledger";
import { VeraxMark } from "../brand/VeraxLogo";

/**
 * The panel visuals for the two auth screens.
 *
 * Both are built from the marketing site's ledger atoms — Sheet, Field, Tick,
 * Rail — so the auth surface is the same drawing language as the homepage,
 * just quieter and vertical. Neither is a dashboard screenshot, and neither
 * competes with the form: one accent mark, one column, one slow sequence that
 * plays once.
 */

const PanelHeading = ({ eyebrow, children }) => (
  <>
    <p className="vx-index flex items-center gap-2.5 text-carbon-300">
      <span aria-hidden="true" className="h-[7px] w-[7px] flex-none bg-brand-500" />
      {eyebrow}
    </p>
    <p className="mt-6 max-w-[22rem] text-[1.5rem] font-semibold leading-[1.25] tracking-[-0.03em] text-white xl:text-[1.75rem]">
      {children}
    </p>
  </>
);

/** A node on the vertical rail: a marker, then whatever the stage looks like. */
const Node = ({ children, last = false, delay = 0, reduced }) => (
  <motion.div
    initial={reduced ? false : { opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: EASE, delay }}
    className={`relative pl-9 ${last ? "" : "pb-6"}`}
  >
    {last ? null : (
      <RailV dark className="absolute left-[7px] top-5 bottom-0" />
    )}
    <span
      aria-hidden="true"
      className="absolute left-0 top-1.5 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-white/25 bg-carbon-950"
    >
      <span className="h-[5px] w-[5px] rounded-full bg-brand-500" />
    </span>
    {children}
  </motion.div>
);

const NodeLabel = ({ children }) => (
  <p className="vx-mono text-[0.625rem] uppercase tracking-[0.16em] text-carbon-400">{children}</p>
);

/* ── Login: what happens to every document ──────────────────────────────── */

const CHECKS = [
  { label: "GSTIN", value: "27AABCA1234A1Z5" },
  { label: "Tax math", value: "42,000 + 7,560" },
  { label: "GSTR-2B", value: "matched · March" }
];

export const LoginPanel = () => {
  const reduced = useReducedMotion();

  return (
    <div>
      <PanelHeading eyebrow="While you were away">
        Every document that arrived has already been read and checked.
      </PanelHeading>

      <div className="mt-11 max-w-[20rem]">
        <Node delay={0.15} reduced={reduced}>
          <NodeLabel>Received</NodeLabel>
          <div className="mt-3 flex items-center gap-3">
            <Sheet label="Invoice" lines={4} tone="dark" className="h-[68px] w-[52px] flex-none" />
            <div>
              <p className="vx-mono text-[0.8125rem] text-white">INV-2026-0417</p>
              <p className="vx-mono mt-1 text-[0.6875rem] text-carbon-400">ACME Trading Co.</p>
            </div>
          </div>
        </Node>

        <Node delay={0.3} reduced={reduced}>
          <NodeLabel>Checked</NodeLabel>
          <div className="mt-1">
            {CHECKS.map((check, index) => (
              <motion.div
                key={check.label}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.5 + index * 0.16 }}
              >
                <Field label={check.label} value={check.value} state="valid" dark />
              </motion.div>
            ))}
          </div>
        </Node>

        <Node delay={1.05} reduced={reduced} last>
          <NodeLabel>Ready</NodeLabel>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2">
            <span className="text-verify-400">
              <Tick size={12} />
            </span>
            <span className="vx-mono text-[0.6875rem] uppercase tracking-[0.12em] text-white">
              Tally-ready
            </span>
          </span>
        </Node>
      </div>

      <p className="mt-12 max-w-[20rem] text-[0.8125rem] leading-[1.7] text-carbon-400">
        Your firm&apos;s data is isolated at the database level — one firm can
        never read another&apos;s.
      </p>
    </div>
  );
};

/* ── Signup: the workflow you are setting up ────────────────────────────── */

export const SignupPanel = () => {
  const reduced = useReducedMotion();

  return (
    <div>
      <PanelHeading eyebrow="What you're setting up">
        A workspace where the paperwork arrives already structured.
      </PanelHeading>

      <div className="mt-11 max-w-[20rem]">
        <Node delay={0.15} reduced={reduced}>
          <NodeLabel>01 — Your firm</NodeLabel>
          <p className="mt-2 text-[0.875rem] leading-[1.6] text-carbon-300">
            One workspace, your team, your clients.
          </p>
        </Node>

        <Node delay={0.3} reduced={reduced}>
          <NodeLabel>02 — Client documents</NodeLabel>
          <div className="mt-3 flex items-end gap-2">
            {[
              { label: "Invoice", h: "h-[58px]", lines: 4 },
              { label: "Statement", h: "h-[66px]", lines: 5 },
              { label: "Bills", h: "h-[50px]", lines: 3 }
            ].map((sheet) => (
              <Sheet
                key={sheet.label}
                label={sheet.label}
                lines={sheet.lines}
                tone="dark"
                className={`w-[52px] flex-none ${sheet.h}`}
              />
            ))}
          </div>
        </Node>

        <Node delay={0.45} reduced={reduced}>
          <NodeLabel>03 — Verax</NodeLabel>
          <div className="mt-3 inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <VeraxMark size={20} tone="light" />
            <span className="vx-mono text-[0.625rem] uppercase leading-[1.6] tracking-[0.14em] text-carbon-300">
              extract · validate
              <br />
              reconcile
            </span>
          </div>
        </Node>

        <Node delay={0.6} reduced={reduced} last>
          <NodeLabel>04 — Review-ready data</NodeLabel>
          <div className="mt-1">
            <Field label="Total" value="49,560.00" state="valid" dark />
            <Field label="Export" value="tally.xml" state="valid" dark />
          </div>
        </Node>
      </div>

      <p className="mt-12 max-w-[20rem] text-[0.8125rem] leading-[1.7] text-carbon-400">
        You can invite your team and add your first client straight after.
      </p>
    </div>
  );
};
