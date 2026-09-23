import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "../public/motion";
import { VeraxMark } from "../brand/VeraxLogo";
import DemoRequestForm from "./DemoRequestForm";
import { Band } from "./v3";

/**
 * The close, after Mercury: near-black, a single light source rising behind a
 * centred headline, the demo form, and two quiet next steps underneath.
 *
 * The form posts to the existing public waitlist route; `tone="onDark"` is the
 * inverted variant for this ground.
 */

const ClosingCTA = () => {
  const reduced = useReducedMotion();

  return (
    <Band id="demo" dark fade="top">
      {/* The light: a horizon glow that breathes very slowly. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[18%] h-[520px] w-[900px] -translate-x-1/2 rounded-full blur-[90px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(102,87,217,0.55), rgba(77,141,255,0.25) 55%, transparent)"
        }}
        animate={reduced ? undefined : { opacity: [0.7, 1, 0.7], scale: [1, 1.06, 1] }}
        transition={{ duration: 9, ease: "easeInOut", repeat: Infinity }}
      />

      <Reveal className="relative mx-auto max-w-[48rem] text-center">
        <div className="mx-auto mb-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_-10px_rgba(102,87,217,0.6)] backdrop-blur">
          <VeraxMark size={30} tone="light" />
        </div>

        <h2 className="font-inter text-[clamp(2.25rem,5vw,3.75rem)] font-normal leading-[1.06] tracking-[-0.04em] text-white">
          Your staff shouldn&apos;t spend tomorrow{" "}
          <span className="vx-hero-gradient-dark">entering invoices.</span>
        </h2>

        <p className="mx-auto mt-7 max-w-[34rem] text-[1.0625rem] leading-[1.7] text-carbon-300">
          Send us a few of your own documents and we&apos;ll run them through
          Verax with you. Fifteen minutes, no slide deck.
        </p>

        <div className="mt-10 flex justify-center">
          <DemoRequestForm tone="onDark" />
        </div>
      </Reveal>

      <div className="relative mx-auto mt-20 grid max-w-[52rem] gap-4 sm:grid-cols-2">
        {[
          {
            title: "See the whole pipeline",
            body: "Six stages, from a client's upload link to a balanced Tally voucher.",
            href: "/#how-it-works",
            cta: "How Verax works"
          },
          {
            title: "Write to us",
            body: "Questions about security, Tally or onboarding your clients.",
            href: "mailto:verax.hello@gmail.com",
            cta: "verax.hello@gmail.com"
          }
        ].map((card, index) => (
          <Reveal key={card.title} delay={0.1 + index * 0.08}>
            <a
              href={card.href}
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span className="text-[1.125rem] font-medium tracking-[-0.015em] text-white">{card.title}</span>
              <span className="mt-2 flex-1 text-[0.9375rem] leading-[1.6] text-carbon-400">{card.body}</span>
              <span className="mt-6 flex items-center justify-between text-[0.875rem] font-medium text-carbon-200">
                {card.cta}
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-white group-hover:text-carbon-950"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M3 8h10m0 0-3.8-3.8M13 8l-3.8 3.8" />
                  </svg>
                </span>
              </span>
            </a>
          </Reveal>
        ))}
      </div>
    </Band>
  );
};

export default ClosingCTA;
