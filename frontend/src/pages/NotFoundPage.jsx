import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import PublicLayout from "../components/layout/PublicLayout";
import Cta from "../components/marketing/Cta";
import { Kicker } from "../components/marketing/v3";
import { useAuth } from "../contexts/AuthContext";
import { EASE } from "../components/public/motion";

/**
 * 404 — the public chrome around a calm, direct message (DESIGN_SYSTEM.md).
 * The dashboard is only offered to someone who is signed in; everyone else is
 * pointed at the pages a visitor is most likely to have been looking for.
 */

const POPULAR = [
  { to: "/features", label: "Product", body: "Every module, from upload link to Tally export" },
  { to: "/pricing", label: "Pricing", body: "Starter is free; paid tiers in early access" },
  { to: "/security", label: "Security", body: "How each firm's data is kept apart" }
];

const NotFoundPage = () => {
  const { isAuthenticated } = useAuth();
  const reduced = useReducedMotion();

  useEffect(() => {
    document.title = "Page not found — Verax";
  }, []);

  const enter = (delay) => ({
    initial: reduced ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: EASE, delay: reduced ? 0 : delay }
  });

  return (
    <PublicLayout>
      <section data-bg="light" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              "radial-gradient(45% 45% at 30% 20%, rgba(102,87,217,0.16), transparent 70%)",
              "radial-gradient(40% 40% at 72% 30%, rgba(77,141,255,0.14), transparent 70%)",
              "radial-gradient(40% 35% at 55% 85%, rgba(20,184,166,0.10), transparent 70%)"
            ].join(",")
          }}
        />

        <div className="vx-shell relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center py-20 text-center">
          <motion.p
            {...enter(0)}
            aria-hidden="true"
            className="vx-hero-gradient select-none font-inter text-[clamp(7rem,22vw,13rem)] font-semibold leading-[0.85] tracking-[-0.07em]"
          >
            404
          </motion.p>

          <motion.div {...enter(0.08)} className="mt-8">
            <Kicker className="justify-center">Page not found</Kicker>
          </motion.div>

          <motion.h1
            {...enter(0.14)}
            className="mt-4 max-w-[34rem] font-inter text-[clamp(1.75rem,3.2vw,2.5rem)] font-normal leading-[1.14] tracking-[-0.03em] text-carbon-900"
          >
            This page doesn&apos;t exist. <span className="text-carbon-400">It may have moved.</span>
          </motion.h1>

          <motion.div {...enter(0.22)} className="mt-9 flex flex-wrap justify-center gap-3">
            <Cta to="/" size="lg">
              Back to home
            </Cta>
            {isAuthenticated ? (
              <Cta to="/dashboard" variant="glass" size="lg">
                Go to dashboard
              </Cta>
            ) : (
              <Cta href="mailto:verax.hello@gmail.com" variant="glass" size="lg">
                Tell us what broke
              </Cta>
            )}
          </motion.div>

          <motion.ul {...enter(0.3)} className="mt-16 grid w-full max-w-[52rem] gap-3 text-left sm:grid-cols-3">
            {POPULAR.map((page) => (
              <li key={page.to}>
                <Link
                  to={page.to}
                  className="group flex h-full flex-col rounded-2xl border border-carbon-900/[0.07] bg-white/80 p-5 backdrop-blur transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-36px_rgba(38,30,110,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span className="flex items-center text-[0.9375rem] font-medium text-carbon-900">
                    {page.label}
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 10 10"
                      fill="none"
                      aria-hidden="true"
                      className="ml-1.5 text-brand-600 transition-transform duration-200 group-hover:translate-x-0.5"
                    >
                      <path
                        d="M3 1.5 6.5 5 3 8.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="mt-1 text-[0.8125rem] leading-[1.5] text-carbon-500">{page.body}</span>
                </Link>
              </li>
            ))}
          </motion.ul>
        </div>
      </section>
    </PublicLayout>
  );
};

export default NotFoundPage;
