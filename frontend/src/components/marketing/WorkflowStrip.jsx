import { motion, useReducedMotion } from "framer-motion";
import { EASE, RevealGroup, RevealItem } from "../public/motion";

const STEPS = [
  {
    number: "01",
    name: "Upload",
    body: "Client sends an invoice, bill or bank statement through a magic link."
  },
  {
    number: "02",
    name: "Understand",
    body: "AI reads and extracts every field from every document."
  },
  {
    number: "03",
    name: "Verify",
    body: "GSTIN validated, tax math checked, duplicates flagged."
  },
  {
    number: "04",
    name: "Reconcile",
    body: "Matched against GSTR-2B automatically."
  },
  {
    number: "05",
    name: "Export",
    body: "Tally-ready XML downloaded in one click."
  }
];

const CIRCLE = 44;

/**
 * The pipeline, drawn as five nodes on a line that draws itself in.
 *
 * The connector is two layers: a static dashed track (the route), and a solid
 * indigo -> teal path that draws along it via stroke-dashoffset (the progress).
 * A single dashed line alone reads as decoration; the fill travelling along it
 * is what makes the section say "these happen in order".
 */
const Connector = ({ vertical = false }) => {
  const reduced = useReducedMotion();
  const length = 1000;

  const draw = reduced
    ? {}
    : {
        initial: { strokeDashoffset: length },
        whileInView: { strokeDashoffset: 0 },
        viewport: { once: true, amount: 0.4 },
        transition: { duration: 1.6, ease: EASE, delay: 0.2 }
      };

  const common = {
    strokeWidth: 2,
    strokeLinecap: "round",
    fill: "none"
  };

  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={vertical ? "0 0 2 1000" : "0 0 1000 2"}
      preserveAspectRatio="none"
      className="absolute inset-0"
    >
      <defs>
        <linearGradient
          id={vertical ? "vxFlowV" : "vxFlowH"}
          x1="0"
          y1="0"
          x2={vertical ? "0" : "1000"}
          y2={vertical ? "1000" : "0"}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#14B8A6" />
        </linearGradient>
      </defs>

      <path
        d={vertical ? "M1 0 V1000" : "M0 1 H1000"}
        stroke="rgba(255,255,255,0.09)"
        strokeDasharray="6 7"
        {...common}
      />
      <motion.path
        d={vertical ? "M1 0 V1000" : "M0 1 H1000"}
        stroke={`url(#${vertical ? "vxFlowV" : "vxFlowH"})`}
        strokeDasharray={length}
        {...common}
        {...draw}
      />
    </svg>
  );
};

const StepNumber = ({ children }) => (
  <span
    className="flex flex-none items-center justify-center rounded-full border border-indigo-500/45 bg-canvas text-[13px] font-bold tracking-[0.02em] text-indigo-600"
    style={{ width: CIRCLE, height: CIRCLE }}
  >
    {children}
  </span>
);

const WorkflowStrip = () => (
  <>
    {/* ── Desktop: five columns on a horizontal line ──────────────────── */}
    <div className="relative hidden lg:block">
      {/*
        The line runs from the edge of circle 1 to the edge of circle 5.
        In a 5-column grid with gap g, the first column's centre sits at
        (10% - 0.4g) and the last at (90% + 0.4g); insetting by the circle
        radius on each side gives the same value at both ends. g = 24px here.
      */}
      <div
        className="absolute h-[2px]"
        style={{
          top: CIRCLE / 2 - 1,
          left: `calc(10% + ${CIRCLE / 2 - 0.4 * 24}px)`,
          right: `calc(10% + ${CIRCLE / 2 - 0.4 * 24}px)`
        }}
      >
        <Connector />
      </div>

      <RevealGroup className="relative grid grid-cols-5 gap-6" stagger={0.1}>
        {STEPS.map((step) => (
          <RevealItem key={step.number} className="flex flex-col items-center text-center">
            <StepNumber>{step.number}</StepNumber>
            <h3 className="mt-5 text-sm font-semibold tracking-[-0.01em] text-zinc-100">
              {step.name}
            </h3>
            <p className="mt-2 max-w-[15rem] text-[13px] leading-[1.6] text-zinc-400">
              {step.body}
            </p>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>

    {/* ── Mobile / tablet: the same five nodes, stacked ───────────────── */}
    <div className="relative lg:hidden">
      <div
        className="absolute w-[2px]"
        style={{ left: CIRCLE / 2 - 1, top: CIRCLE / 2, bottom: CIRCLE / 2 }}
      >
        <Connector vertical />
      </div>

      <RevealGroup className="relative space-y-8" stagger={0.1}>
        {STEPS.map((step) => (
          <RevealItem key={step.number} className="flex items-start gap-5">
            <StepNumber>{step.number}</StepNumber>
            <div className="pt-1.5">
              <h3 className="text-sm font-semibold tracking-[-0.01em] text-zinc-100">
                {step.name}
              </h3>
              <p className="mt-1.5 max-w-md text-[13px] leading-[1.6] text-zinc-400">
                {step.body}
              </p>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  </>
);

export default WorkflowStrip;
