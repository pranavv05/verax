import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import VeraxLogo from "../brand/VeraxLogo";
import { EASE, PageTransition } from "./motion";

const CheckBullet = ({ children, accent }) => (
  <li className="flex items-start gap-3">
    <span
      className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full ${accent}`}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path
          d="M2.5 6.2 4.8 8.5 9.5 3.8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
    <span className="text-sm leading-relaxed text-white/70">{children}</span>
  </li>
);

/**
 * Decorative panel art: a stack of document cards being validated.
 * Purely presentational, hidden from assistive tech, and static under
 * prefers-reduced-motion.
 */
const AsideArtwork = ({ accentHex }) => {
  const reduced = useReducedMotion();

  const rows = [
    { label: "Invoice", value: "₹ 1,24,500", delay: 0 },
    { label: "GSTIN", value: "27AAPFU0939F1ZV", delay: 0.12 },
    { label: "CGST + SGST", value: "₹ 11,205", delay: 0.24 }
  ];

  return (
    <div aria-hidden="true" className="relative mt-10 select-none">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
        className="relative rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
            Extraction
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
            style={{ backgroundColor: `${accentHex}22`, color: accentHex }}
          >
            98% confidence
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <motion.div
              key={row.label}
              initial={reduced ? false : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.45 + row.delay }}
              className="flex items-center justify-between rounded-xl bg-white/[0.05] px-3 py-2"
            >
              <span className="text-xs font-medium text-white/50">{row.label}</span>
              <span className="font-mono text-xs text-white/85">{row.value}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Result chip that settles in after the rows land */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 10, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 1.05 }}
        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.07] px-3.5 py-2.5 backdrop-blur-sm"
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full"
          style={{ backgroundColor: accentHex, color: "#06231a" }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.2 4.8 8.5 9.5 3.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-xs font-semibold text-white/85">Tally XML ready</span>
      </motion.div>
    </div>
  );
};

/**
 * Split auth shell. Form on the left, branded panel on the right.
 * Below `lg` the panel is dropped entirely and the form goes full-width.
 */
const AuthSplitLayout = ({
  children,
  eyebrow,
  headline,
  bullets = [],
  footnote,
  accent = "brand"
}) => {
  const accentHex = "#2DD4BF";
  const bulletAccent =
    accent === "teal" ? "bg-teal-400/15 text-teal-300" : "bg-verify-400/15 text-verify-300";
  // V1: the panel is the deep-navy contrast background reserved for exactly
  // this kind of section — never a blurred accent-coloured slab. The two
  // variants differ only in a hairline-level tint at one corner, not a glow.
  const panelGradient =
    accent === "teal" ? "from-navy-900 via-navy-800 to-navy-900" : "from-navy-900 via-navy-800 to-navy-950";

  return (
    <div className="vx-page min-h-screen lg:grid lg:grid-cols-[1fr_minmax(420px,44%)]">
      {/* ── Form column ─────────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col px-5 py-8 sm:px-8 lg:px-12 xl:px-20">
        <Link to="/" className="inline-flex w-fit rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
          <VeraxLogo size={32} />
        </Link>

        <PageTransition className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </PageTransition>

        <p className="text-center text-xs text-zinc-500 lg:text-left">
          {footnote || (
            <>
              © {new Date().getFullYear()} Verax ·{" "}
              <a className="underline-offset-2 hover:underline" href="mailto:verax.hello@gmail.com">
                verax.hello@gmail.com
              </a>
            </>
          )}
        </p>
      </div>

      {/* ── Brand column (desktop only) ─────────────────────────────────── */}
      <aside
        className={`relative hidden overflow-hidden bg-gradient-to-br ${panelGradient} lg:flex lg:flex-col lg:justify-center`}
      >
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at 60% 40%, black 20%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(ellipse at 60% 40%, black 20%, transparent 72%)"
          }}
        />

        <div className="relative z-10 px-12 py-16 xl:px-16">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              {eyebrow}
            </p>
          ) : null}

          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.08 }}
            className="mt-4 max-w-md text-3xl font-bold leading-[1.15] tracking-[-0.03em] text-white xl:text-[2.35rem]"
          >
            {headline}
          </motion.h2>

          {bullets.length > 0 ? (
            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.25 }}
              className="mt-8 max-w-md space-y-3.5"
            >
              {bullets.map((bullet) => (
                <CheckBullet key={bullet} accent={bulletAccent}>
                  {bullet}
                </CheckBullet>
              ))}
            </motion.ul>
          ) : null}

          <div className="max-w-sm">
            <AsideArtwork accentHex={accentHex} />
          </div>
        </div>
      </aside>
    </div>
  );
};

export default AuthSplitLayout;
