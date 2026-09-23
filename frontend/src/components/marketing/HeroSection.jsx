import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { EASE } from "../public/motion";
import DemoRequestForm from "./DemoRequestForm";
import HeroProduct from "./HeroProduct";

/**
 * The homepage hero, after Stripe and Mercury.
 *
 *   From Stripe:  the colour field and silk ribbon behind a crisp headline,
 *                 the vivid gradient on the second line, product UI presented
 *                 as one large, layered surface.
 *   From Mercury: the centred composition, the announcement pill, the email
 *                 field + button sharing one pill, and the product window
 *                 rising into view and dissolving into the next section.
 *
 * The product shot is `HeroProduct`: a high-fidelity, live rendition of the
 * review screen carrying the same invoice VeraxEngine and the Coverage section
 * carry further down (ACME Trading Co., INV-2026-0417, ₹49,560), so the
 * page's numbers reconcile from the first screen to the last.
 */

/* ── Background ─────────────────────────────────────────────────────────── */

// Wide gradient bands, then hairline strands over them — the strands are what
// make it read as silk rather than as a blurred blob.
const BANDS = [
  { d: "M250 -80 C 380 140, 470 330, 980 820", width: 190, grad: "vx-rb-a", opacity: 0.85, delay: 0 },
  { d: "M360 -80 C 470 120, 560 300, 1000 700", width: 120, grad: "vx-rb-b", opacity: 0.8, delay: -3 },
  { d: "M150 -80 C 300 190, 420 380, 900 900", width: 90, grad: "vx-rb-c", opacity: 0.7, delay: -6 },
  { d: "M470 -80 C 560 90, 640 250, 1020 600", width: 70, grad: "vx-rb-d", opacity: 0.75, delay: -9 }
];

const STRANDS = Array.from({ length: 9 }, (_, i) => {
  const x = 190 + i * 31 + (i % 3) * 9;
  return `M${x} -80 C ${x + 130 - i * 3} ${150 + i * 4}, ${x + 220 - i * 5} ${330 + i * 3}, ${x + 700 - i * 18} ${860 - i * 14}`;
});

// The gradient defs live once in RibbonDefs; both ribbons reference them.
const RibbonDefs = () => (
  <svg aria-hidden="true" width="0" height="0" className="absolute">
    <defs>
      <linearGradient id="vx-rb-a" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#A9B8FF" />
        <stop offset="45%" stopColor="#6657D9" />
        <stop offset="100%" stopColor="#14B8A6" />
      </linearGradient>
      <linearGradient id="vx-rb-b" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4D8DFF" />
        <stop offset="60%" stopColor="#8B7CF6" />
        <stop offset="100%" stopColor="#F5B45A" />
      </linearGradient>
      <linearGradient id="vx-rb-c" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#C9C2FF" />
        <stop offset="100%" stopColor="#4D8DFF" />
      </linearGradient>
      <linearGradient id="vx-rb-d" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#5EEAD4" />
        <stop offset="100%" stopColor="#6657D9" />
      </linearGradient>
      <filter id="vx-rb-soft" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>
  </svg>
);

const Ribbon = ({ reduced, className = "", flip = false }) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute h-[760px] w-[980px] ${className}`}
    style={{
      transform: flip ? "scaleX(-1)" : undefined,
      maskImage: "linear-gradient(to right, transparent 0%, black 35%, black 75%, transparent 100%)",
      WebkitMaskImage:
        "linear-gradient(to right, transparent 0%, black 35%, black 75%, transparent 100%)"
    }}
  >
    <div
      className="h-full w-full"
      style={{
        maskImage: "linear-gradient(to bottom, black 55%, transparent 95%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 95%)"
      }}
    >
    <svg viewBox="0 0 980 760" className="h-full w-full" preserveAspectRatio="xMidYMin slice">
      <g filter="url(#vx-rb-soft)">
        {BANDS.map((band) => (
          <path
            key={band.d}
            d={band.d}
            fill="none"
            stroke={`url(#${band.grad})`}
            strokeWidth={band.width}
            strokeLinecap="round"
            opacity={band.opacity}
            className={reduced ? "" : "vx-ribbon-band"}
            style={{ animationDelay: `${band.delay}s` }}
          />
        ))}
      </g>

      <g className={reduced ? "" : "vx-ribbon-band"} style={{ animationDelay: "-4s" }}>
        {STRANDS.map((d, i) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={i % 3 === 0 ? 1.2 : 0.7}
            opacity={0.1 + (i % 4) * 0.05}
          />
        ))}
      </g>
    </svg>
    </div>
  </div>
);

/* ── Hero ───────────────────────────────────────────────────────────────── */

const HeroSection = () => {
  const reduced = useReducedMotion();
  const sectionRef = useRef(null);

  // Scroll parallax as the reader leaves the hero: the copy drifts up and
  // fades faster than the page, while the product rises over it.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  // Sprung copy of the progress: smoother, and it keeps Framer on its JS
  // path — its native ViewTimeline hand-off leaves this range frozen.
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40, mass: 0.3 });
  const copyY = useTransform(progress, [0, 0.5], [0, -90]);
  const copyOpacity = useTransform(progress, [0, 0.35], [1, 0]);
  const copyBlur = useTransform(progress, [0, 0.35], ["blur(0px)", "blur(6px)"]);
  const productY = useTransform(progress, [0, 1], [0, -60]);

  const enter = (delay, y = 22) => ({
    initial: reduced ? false : { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.85, ease: EASE, delay: reduced ? 0 : delay }
  });

  return (
    <section ref={sectionRef} data-bg="light" className="relative overflow-hidden">
      <RibbonDefs />

      {/* Colour field: four soft light sources, like morning through glass. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(55% 45% at 12% 8%, rgba(102,87,217,0.20), transparent 70%)",
            "radial-gradient(45% 40% at 90% 4%, rgba(77,141,255,0.20), transparent 70%)",
            "radial-gradient(40% 35% at 78% 58%, rgba(20,184,166,0.14), transparent 70%)",
            "radial-gradient(40% 35% at 22% 62%, rgba(245,180,90,0.14), transparent 70%)"
          ].join(",")
        }}
      />

      {/* Faint grid, fading out from the headline. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(14,16,19,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,16,19,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(60% 50% at 50% 20%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(60% 50% at 50% 20%, black, transparent 75%)"
        }}
      />

      <Ribbon
        reduced={reduced}
        className="-top-24 right-[-34rem] opacity-50 md:right-[-26rem] md:opacity-90 xl:right-[-16rem]"
      />
      <Ribbon
        reduced={reduced}
        flip
        className="-top-40 left-[-34rem] hidden opacity-30 md:block xl:left-[-28rem]"
      />

      <div className="vx-shell relative pt-16 sm:pt-24 lg:pt-28">
        {/* ── Copy ────────────────────────────────────────────────────── */}
        <motion.div
          className="mx-auto max-w-[72rem] text-center"
          style={reduced ? undefined : { y: copyY, opacity: copyOpacity, filter: copyBlur }}
        >
          <motion.a
            {...enter(0)}
            href="#demo"
            className="group inline-flex items-center gap-2.5 rounded-full border border-white/80 bg-white/70 py-1 pl-1 pr-3.5 text-[0.8125rem] font-medium text-carbon-600 shadow-[0_8px_24px_-16px_rgba(38,30,110,0.5)] backdrop-blur transition-colors hover:text-carbon-900"
          >
            <span className="rounded-full bg-gradient-to-r from-brand-500 to-sky-500 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-white">
              New
            </span>
            Now onboarding founding CA firms
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </motion.a>

          <motion.h1
            {...enter(0.08)}
            className="mt-8 font-inter text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[1.04] tracking-[-0.045em] text-carbon-900"
          >
            Financial documents in.
            <br />
            <span className="vx-hero-gradient">Tally&#8209;ready data out.</span>
          </motion.h1>

          <motion.p
            {...enter(0.18)}
            className="mx-auto mt-7 max-w-[40rem] text-[1.0625rem] leading-[1.7] text-carbon-500 sm:text-[1.1875rem]"
          >
            Clients upload from a link. Verax reads every invoice and
            statement, checks GSTINs and tax maths, and writes TallyPrime XML
            — with your team approving every voucher.
          </motion.p>

          <motion.div
            {...enter(0.26)}
            className="mx-auto mt-10 flex max-w-[40rem] flex-col items-stretch justify-center gap-3 text-center sm:flex-row sm:items-start"
          >
            <div className="w-full sm:max-w-[26rem]">
              <DemoRequestForm tone="hero" />
            </div>
            <a
              href="#how-it-works"
              className="inline-flex h-[3.5rem] flex-none items-center justify-center gap-2 rounded-full border border-white/80 bg-white/60 px-6 text-sm font-medium text-carbon-700 backdrop-blur transition-colors hover:bg-white hover:text-carbon-900"
            >
              See how it works
            </a>
          </motion.div>
        </motion.div>

        {/* ── Product ─────────────────────────────────────────────────── */}
        <motion.div
          className="relative mx-auto mt-16 max-w-[1080px] [perspective:2000px] sm:mt-20"
          style={reduced ? undefined : { y: productY }}
        >
          {/* The stage light behind the window. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-10 bottom-0 top-10 rounded-[3rem] opacity-70 blur-3xl"
            style={{
              background:
                "linear-gradient(100deg, rgba(102,87,217,0.55), rgba(77,141,255,0.45) 45%, rgba(20,184,166,0.4) 80%, rgba(245,180,90,0.35))"
            }}
          />

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 70, rotateX: 22 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 1.3, ease: EASE, delay: reduced ? 0 : 0.35 }}
            className="relative origin-bottom"
            style={{
              maskImage: "linear-gradient(to bottom, black 90%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 90%, transparent 100%)"
            }}
          >
            <HeroProduct />
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
