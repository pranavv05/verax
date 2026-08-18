import { Reveal } from "../public/motion";

/**
 * What sits where the customer-logo bar normally goes.
 *
 * There are no customers to name yet and no measured numbers to quote, so
 * inventing either would be the one thing on this page an accountant could
 * catch us on. Saying so plainly and listing what the product verifiably does
 * is both honest and, at this stage, more persuasive than five grey logos.
 */

const FACTS = [
  "Document intelligence",
  "GST validation",
  "GSTR-2B reconciliation",
  "Tally-ready XML",
  "Client workflow"
];

const ProofBand = () => (
  <section className="border-y border-hairline">
    <div className="vx-shell py-10">
      <Reveal>
        <p className="text-center text-[0.8125rem] text-carbon-400">
          Verax is in its founding-customer phase. Rather than logos we
          haven&apos;t earned, here is what it actually does.
        </p>

        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
          {FACTS.map((fact) => (
            <li
              key={fact}
              className="vx-mono text-[0.6875rem] uppercase tracking-[0.16em] text-carbon-600"
            >
              {fact}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  </section>
);

export default ProofBand;
