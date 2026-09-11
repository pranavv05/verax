import { motion, useReducedMotion } from "framer-motion";
import { EASE, Reveal } from "../public/motion";
import { Caret, Eyebrow, Section, Tick } from "./ledger";

/**
 * "Give Verax the documents. Give your team the exceptions."
 *
 * A month of paperwork drawn as a field of marks. They arrive blank, then
 * resolve: almost all of them settle into a validated tick, a handful into an
 * amber caret. The proportion is the argument — automation takes the
 * repetitive majority, people take the few that actually need judgement.
 *
 * The numbers are illustrative and labelled as such. Nothing in the repository
 * measures a real per-firm document mix, so claiming one here would be
 * inventing a statistic.
 */

// A fixed month of paperwork, reflowed rather than shrunk: the column count
// comes from `auto-fill` with a 16px floor, so on a phone the same 216 marks
// become more rows of fewer columns instead of 5px cells with clipped ticks.
const TOTAL = 216;

// Fixed positions rather than Math.random(), so the composition is art-directed
// (exceptions scattered, never clustered or in a line) and identical on every
// render — a re-render that reshuffles the field would flicker.
const EXCEPTIONS = new Set([13, 41, 58, 96, 119, 137, 168, 190, 203]);

const TransformationSection = () => {
  const reduced = useReducedMotion();
  const cells = Array.from({ length: TOTAL }, (_, index) => index);

  return (
    <Section className="overflow-hidden">
      <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-20">
        <Reveal>
          <Eyebrow>The division of labour</Eyebrow>

          <h2 className="vx-h2-xl mt-6">
            Give Verax the documents.
            <br />
            Give your team the exceptions.
          </h2>

          <p className="vx-body mt-7 max-w-[32rem] text-carbon-500">
            Most documents are unremarkable: the GSTIN is valid, the tax adds
            up, nothing is duplicated, everything matches. Those should never
            reach a person.
          </p>

          <p className="vx-body mt-5 max-w-[32rem] text-carbon-500">
            The few that are wrong, missing or contradictory are exactly the
            ones worth a qualified opinion. Verax&apos;s job is to make sure
            those are the only ones you see.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: reduced ? 0 : 0.004 } }
            }}
            className="grid gap-[6px]"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(16px, 1fr))" }}
            aria-hidden="true"
          >
            {cells.map((index) => {
              const flagged = EXCEPTIONS.has(index);
              return (
                <motion.span
                  key={index}
                  variants={{
                    hidden: reduced ? {} : { opacity: 0, scale: 0.4 },
                    visible: {
                      opacity: 1,
                      scale: 1,
                      transition: { duration: 0.4, ease: EASE }
                    }
                  }}
                  className={`flex aspect-square items-center justify-center rounded-[2px] ${
                    flagged
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-verify-500/12 text-verify-600"
                  }`}
                >
                  {flagged ? <Caret size={9} /> : <Tick size={9} />}
                </motion.span>
              );
            })}
          </motion.div>

          <dl className="mt-10 grid grid-cols-2 gap-8 border-t border-hairline pt-8">
            <div>
              <dt className="vx-index">Cleared automatically</dt>
              <dd className="vx-mono mt-3 text-[2.5rem] font-medium leading-none tracking-[-0.04em] text-carbon-900">
                {TOTAL - EXCEPTIONS.size}
              </dd>
            </div>
            <div>
              <dt className="vx-index">Sent to your team</dt>
              <dd className="vx-mono mt-3 text-[2.5rem] font-medium leading-none tracking-[-0.04em] text-amber-600">
                {EXCEPTIONS.size}
              </dd>
            </div>
          </dl>

          <p className="mt-5 text-[0.75rem] leading-[1.6] text-carbon-400">
            Illustrative. The split depends entirely on your clients&apos;
            paperwork — Verax decides what needs review from the confidence
            score and the validation results on each document, not from a
            fixed ratio.
          </p>
        </Reveal>
      </div>
    </Section>
  );
};

export default TransformationSection;
