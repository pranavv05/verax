import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import LandingNav from "../components/marketing/LandingNav";
import LandingFooter from "../components/marketing/LandingFooter";
import DocumentFlowVisual from "../components/marketing/DocumentFlowVisual";
import ProofBand from "../components/marketing/ProofBand";
import ProblemSection from "../components/marketing/ProblemSection";
import TransformationSection from "../components/marketing/TransformationSection";
import DocumentTypes from "../components/marketing/DocumentTypes";
import VeraxEngine from "../components/marketing/VeraxEngine";
import DocumentDecode from "../components/marketing/DocumentDecode";
import ReviewExperience from "../components/marketing/ReviewExperience";
import ClientWorkflow from "../components/marketing/ClientWorkflow";
import TallySection from "../components/marketing/TallySection";
import Outcomes from "../components/marketing/Outcomes";
import ClosingCTA from "../components/marketing/ClosingCTA";
import { Eyebrow } from "../components/marketing/ledger";
import { EASE } from "../components/public/motion";

/**
 * The Verax marketing homepage.
 *
 * The page tells one story in one visual language — paperwork → Verax →
 * validated accounting data — and each section is a different scale of the
 * same three shapes (see `components/marketing/ledger.jsx`). The product's own
 * UI appears exactly once, in ReviewExperience, as evidence rather than as the
 * site's identity.
 *
 * Composition only: every section owns its own markup, motion and copy, so
 * this file stays readable and no section can quietly grow into the others.
 */

const HomePage = () => {
  const reduced = useReducedMotion();

  // Deep links like /#how-it-works or /#demo should land on the right section.
  useEffect(() => {
    if (!window.location.hash) return;
    const target = document.querySelector(window.location.hash);
    if (target) {
      window.requestAnimationFrame(() =>
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
      );
    }
  }, [reduced]);

  const enter = (delay) => ({
    initial: reduced ? false : { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.85, ease: EASE, delay: reduced ? 0 : delay }
  });

  // No overflow-x-hidden on the page root — it would make the root a scroll
  // container and the sticky navbar would stick to it rather than the viewport.
  return (
    <div className="vx-page min-h-screen">
      <LandingNav />

      <main>
        {/* ═════════════════════════ HERO ═════════════════════════ */}
        <section className="vx-shell pb-20 pt-16 sm:pt-20 lg:pb-28 lg:pt-24">
          {/* The headline gets the full shell width rather than a column of
              it: at 92px, splitting the grid first is what forces a
              two-line statement into three. Supporting copy and the actions
              sit underneath, which also puts the primary CTA closer to the
              visual it introduces. */}
          <motion.div {...enter(0)}>
            <Eyebrow>Financial document intelligence</Eyebrow>
          </motion.div>

          <motion.h1 {...enter(0.08)} className="vx-display-xl mt-8">
            Financial documents in.
            <br />
            Accounting-ready data out.
          </motion.h1>

          <motion.div
            {...enter(0.18)}
            className="mt-12 grid gap-8 border-t border-hairline pt-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16"
          >
            <p className="vx-body max-w-[38rem] text-carbon-500">
              Verax automates the financial document workflow between Indian
              businesses and their CA firms — collection, extraction,
              validation, reconciliation and Tally export.
            </p>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <a href="#how-it-works" className="vx-cta">
                See how Verax works
              </a>
              <a href="#demo" className="vx-link-action">
                Book a demo
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden="true"
                >
                  <path d="M3 8h10m0 0-3.8-3.8M13 8l-3.8 3.8" />
                </svg>
              </a>
            </div>
          </motion.div>

          <motion.div {...enter(0.3)} className="mt-20 lg:mt-24">
            <DocumentFlowVisual />
          </motion.div>
        </section>

        <ProofBand />

        {/* The argument: the work today, and what it should be instead. */}
        <ProblemSection />
        <TransformationSection />

        {/* The product: what it reads, how it runs, what a page becomes. */}
        <DocumentTypes />
        <VeraxEngine />
        <DocumentDecode />

        {/* The evidence, then the relationship it sits inside. */}
        <ReviewExperience />
        <ClientWorkflow />
        <TallySection />

        {/* What changes, and what exists today. */}
        <Outcomes />

        <ClosingCTA />
      </main>

      <LandingFooter />
    </div>
  );
};

export default HomePage;
