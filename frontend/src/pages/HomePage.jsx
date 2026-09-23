import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import LandingNav from "../components/marketing/LandingNav";
import LandingFooter from "../components/marketing/LandingFooter";
import HeroSection from "../components/marketing/HeroSection";
import ProofBand from "../components/marketing/ProofBand";
import ProblemSection from "../components/marketing/ProblemSection";
import TransformationSection from "../components/marketing/TransformationSection";
import DocumentTypes from "../components/marketing/DocumentTypes";
import VeraxEngine from "../components/marketing/VeraxEngine";
import ClientWorkflow from "../components/marketing/ClientWorkflow";
import Outcomes from "../components/marketing/Outcomes";
import ClosingCTA from "../components/marketing/ClosingCTA";
import { ThemeCanvas } from "../components/marketing/v3";

/**
 * The Verax marketing homepage.
 *
 * The page tells one story in one visual language — paperwork → Verax →
 * validated accounting data — and each section is a different scale of the
 * same visual system (see `components/marketing/v3.jsx`).
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

  // No overflow-x-hidden on the page root — it would make the root a scroll
  // container and the sticky navbar would stick to it rather than the viewport.
  return (
    // bg-transparent: the colour comes from ThemeCanvas, which cross-fades
    // between light and dark as sections pass the middle of the viewport.
    <div className="vx-page min-h-screen !bg-transparent">
      <ThemeCanvas />
      <LandingNav />

      <main>
        <HeroSection />

        <ProofBand />

        {/* The argument: the work today, and what it should be instead. */}
        <ProblemSection />
        <TransformationSection />

        {/* The product: what it reads, how it runs, what a page becomes. */}
        <DocumentTypes />
        <VeraxEngine />

        {/* The evidence, then the relationship it sits inside. */}
        <ClientWorkflow />

        {/* What changes, and what exists today. */}
        <Outcomes />

        <ClosingCTA />
      </main>

      <LandingFooter dark />
    </div>
  );
};

export default HomePage;
