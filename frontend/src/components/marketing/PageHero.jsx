import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "../public/motion";
import { Kicker } from "./v3";

/**
 * The sub-page hero — the homepage hero's language at page scale (see
 * DESIGN_SYSTEM.md §3, §8): four soft light sources, a faint grid fading out
 * from the headline, a gradient kicker, a two-line H1 whose second line carries
 * the brand gradient, a lead, and optional actions. Anything passed as
 * `children` renders below as the hero's visual.
 *
 *   title   first line (carbon-900)
 *   accent  second line (.vx-hero-gradient)
 *   align   "center" (default) | "left"
 */

const FIELD = [
  "radial-gradient(50% 45% at 12% 0%, rgba(102,87,217,0.16), transparent 70%)",
  "radial-gradient(45% 40% at 90% 0%, rgba(77,141,255,0.16), transparent 70%)",
  "radial-gradient(40% 35% at 80% 70%, rgba(20,184,166,0.10), transparent 70%)",
  "radial-gradient(40% 35% at 18% 75%, rgba(245,180,90,0.10), transparent 70%)"
].join(",");

const PageHero = ({ kicker, title, accent, lead, actions, align = "center", children, className = "" }) => {
  const reduced = useReducedMotion();
  const centred = align === "center";

  const enter = (delay) => ({
    initial: reduced ? false : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.85, ease: EASE, delay: reduced ? 0 : delay }
  });

  return (
    <section data-bg="light" className={`relative overflow-hidden ${className}`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: FIELD }} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(14,16,19,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,16,19,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: `radial-gradient(60% 55% at ${centred ? "50%" : "20%"} 15%, black, transparent 75%)`,
          WebkitMaskImage: `radial-gradient(60% 55% at ${centred ? "50%" : "20%"} 15%, black, transparent 75%)`
        }}
      />

      <div className="vx-shell relative pb-16 pt-16 sm:pb-20 sm:pt-24 lg:pt-28">
        <div className={centred ? "mx-auto max-w-[52rem] text-center" : "max-w-[46rem]"}>
          {kicker ? (
            <motion.div {...enter(0)}>
              <Kicker className={centred ? "justify-center" : ""}>{kicker}</Kicker>
            </motion.div>
          ) : null}

          <motion.h1
            {...enter(0.06)}
            className="mt-6 font-inter text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.045em] text-carbon-900 [text-wrap:balance]"
          >
            {title}
            {accent ? (
              <>
                <br />
                <span className="vx-hero-gradient">{accent}</span>
              </>
            ) : null}
          </motion.h1>

          {lead ? (
            <motion.p
              {...enter(0.14)}
              className={`mt-6 max-w-[38rem] text-[1.0625rem] leading-[1.7] text-carbon-500 sm:text-[1.1875rem] ${
                centred ? "mx-auto" : ""
              }`}
            >
              {lead}
            </motion.p>
          ) : null}

          {actions ? (
            <motion.div
              {...enter(0.22)}
              className={`mt-9 flex flex-wrap items-center gap-3 ${centred ? "justify-center" : ""}`}
            >
              {actions}
            </motion.div>
          ) : null}
        </div>

        {children ? (
          <motion.div {...enter(0.3)} className="relative mt-14 sm:mt-16">
            {children}
          </motion.div>
        ) : null}
      </div>
    </section>
  );
};

export default PageHero;
