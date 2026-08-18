import { Reveal } from "../public/motion";
import { Eyebrow, Section, Tick } from "./ledger";
import ReviewMockup from "./mockups/ReviewMockup";

/**
 * The one place the actual product appears.
 *
 * By this point the page has already made its argument in its own visual
 * language, so the real UI arrives as *evidence* rather than as the site's
 * identity — which is why it shows up here, three-quarters of the way down,
 * and exactly once. `ReviewMockup` is the live component the rest of the
 * marketing surface already uses, not a screenshot that will drift out of
 * date the next time the review screen changes.
 */

const CAPABILITIES = [
  "The document and the extracted fields, side by side",
  "A confidence score on every extraction, not just a pass/fail",
  "Validation warnings inline: GSTIN, tax math, duplicates, GSTR-2B",
  "Every edit versioned, with a field-by-field diff of what changed",
  "Approval reserved for admins; corrections teach the item-name mapping"
];

const ReviewExperience = () => (
  <Section id="review">
    <div className="grid items-center gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
      <Reveal>
        <Eyebrow>The review screen</Eyebrow>

        <h2 className="vx-h2-xl mt-6">
          Review what matters.
          <br />
          Not everything.
        </h2>

        <p className="vx-body mt-7 max-w-[32rem] text-carbon-500">
          When a document does need you, everything needed to judge it is on
          one screen — and the parts that were already checked say so, so you
          are reading the exception rather than re-reading the invoice.
        </p>

        <ul className="mt-9 space-y-3.5">
          {CAPABILITIES.map((capability) => (
            <li key={capability} className="flex items-start gap-3">
              <span className="mt-[5px] text-verify-600">
                <Tick size={12} />
              </span>
              <span className="text-[0.9375rem] leading-[1.6] text-carbon-600">
                {capability}
              </span>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.1}>
        <ReviewMockup />
      </Reveal>
    </div>
  </Section>
);

export default ReviewExperience;
