import { motion, useReducedMotion } from "framer-motion";
import { EASE, Reveal } from "../public/motion";
import { Eyebrow, Section } from "./ledger";

/**
 * The problem, argued visually rather than bulleted.
 *
 * The steps are drawn as one narrow column with three ghosted copies stacked
 * behind it. That stack is the entire point of the section: the work isn't
 * hard, it's *the same*, and it happens again for the next document, and the
 * one after that. A bullet list cannot say that; an offset repeat can.
 */

const STEPS = [
  "Open the email. Download the attachments.",
  "Open the PDF. Find the invoice number.",
  "Read the GSTIN off the header.",
  "Retype every line item into Tally.",
  "Check the tax adds up.",
  "Search whether it was already entered.",
  "Match it against GSTR-2B in a spreadsheet.",
  "Save. Open the next one."
];

const GHOSTS = [
  { x: 34, y: -26, opacity: 0.1 },
  { x: 22, y: -17, opacity: 0.2 },
  { x: 11, y: -8, opacity: 0.42 }
];

const StepList = ({ muted = false }) => (
  <ol
    className={`w-full rounded-xl border border-hairline bg-white ${
      muted ? "" : "shadow-[0_20px_50px_-34px_rgba(14,16,19,0.5)]"
    }`}
  >
    {STEPS.map((step, index) => (
      <li
        key={step}
        className="flex items-baseline gap-4 border-b border-hairline px-5 py-3 last:border-b-0"
      >
        <span className="vx-mono w-5 flex-none text-[0.6875rem] text-carbon-300">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="text-[0.875rem] leading-[1.5] text-carbon-600">{step}</span>
      </li>
    ))}
  </ol>
);

const ProblemSection = () => {
  const reduced = useReducedMotion();

  return (
    <Section id="problem">
      <div className="grid items-center gap-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
        <Reveal>
          <Eyebrow>The work today</Eyebrow>

          <h2 className="vx-h2-xl mt-6">
            Your staff shouldn&apos;t
            <br />
            be doing this.
          </h2>

          <p className="vx-body mt-7 max-w-[32rem] text-carbon-500">
            Nothing on this list requires a qualified accountant. All of it
            requires a qualified accountant&apos;s afternoon.
          </p>

          <p className="vx-body mt-5 max-w-[32rem] text-carbon-500">
            Then the next client&apos;s documents arrive, and it starts again —
            the same eight steps, in the same order, for every document, every
            month.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="relative">
          {/* The repeats sit behind and above, so the front card reads as the
              top of a stack that continues off the page. */}
          <div aria-hidden="true" className="absolute inset-0">
            {GHOSTS.map((ghost) => (
              <motion.div
                key={ghost.x}
                initial={reduced ? false : { opacity: 0 }}
                whileInView={{ opacity: ghost.opacity }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
                className="absolute inset-0"
                style={{ transform: `translate(${ghost.x}px, ${ghost.y}px)` }}
              >
                <StepList muted />
              </motion.div>
            ))}
          </div>

          <div className="relative">
            <StepList />
          </div>

          <p className="vx-mono relative mt-6 text-[0.6875rem] uppercase tracking-[0.14em] text-carbon-400">
            × every document · × every client · × every month
          </p>
        </Reveal>
      </div>

      {/* The turn. Given its own rule and its own air rather than a heading. */}
      <Reveal className="mt-24 border-t border-hairline pt-12 lg:mt-32 lg:pt-16">
        <p className="max-w-[46rem] text-[1.5rem] font-semibold leading-[1.35] tracking-[-0.025em] text-carbon-900 sm:text-[2rem]">
          Verax turns that list into one step:{" "}
          <span className="text-brand-600">review the exceptions.</span>
        </p>
      </Reveal>
    </Section>
  );
};

export default ProblemSection;
