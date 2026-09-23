import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import VeraxLogo from "../brand/VeraxLogo";
import { EASE } from "../public/motion";
import { HoverArrow } from "../marketing/Cta";

/**
 * The auth surface: Mercury's restraint in the homepage's light
 * (DESIGN_SYSTEM.md §2, §5, §6).
 *
 * The ivory canvas with the hero's four soft light sources and faint grid; the
 * logo top-left and one contextual link top-right; one white card, centred,
 * with a quiet regular-weight title; a divided lower strip for the secondary
 * path; Privacy, Terms and help underneath. No marketing copy competes with
 * the form.
 *
 * Shared by the firm login, signup, forgot/reset password and the client-portal
 * login. Pages keep their own logic; this is layout only.
 */

const FIELD = [
  "radial-gradient(50% 40% at 15% 0%, rgba(102,87,217,0.14), transparent 70%)",
  "radial-gradient(45% 40% at 88% 0%, rgba(77,141,255,0.14), transparent 70%)",
  "radial-gradient(40% 35% at 85% 100%, rgba(20,184,166,0.09), transparent 70%)",
  "radial-gradient(40% 35% at 10% 100%, rgba(245,180,90,0.09), transparent 70%)"
].join(",");

const footLink =
  "rounded transition-colors hover:text-carbon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

const AuthLayout = ({ topLink, badge, children, width = "max-w-[440px]" }) => {
  const reduced = useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas font-inter text-carbon-900 antialiased">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: FIELD }} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(14,16,19,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,16,19,0.045) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(55% 50% at 50% 30%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(55% 50% at 50% 30%, black, transparent 75%)"
        }}
      />

      <header className="relative flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Verax — home"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
          >
            <VeraxLogo size={26} />
          </Link>
          {badge ? (
            <span className="rounded-full border border-white/80 bg-white/70 px-2.5 py-0.5 text-[12px] font-medium text-carbon-600 backdrop-blur">
              {badge}
            </span>
          ) : null}
        </div>
        {topLink ? (
          <Link
            to={topLink.to}
            className="group inline-flex h-9 items-center rounded-full border border-white/80 bg-white/60 px-4 text-[13.5px] font-medium text-carbon-700 backdrop-blur transition-colors hover:bg-white hover:text-carbon-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {topLink.label}
            <HoverArrow />
          </Link>
        ) : null}
      </header>

      <main className="relative flex min-h-[calc(100vh-76px)] flex-col items-center px-4 pb-10 pt-6 sm:pt-14">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className={`w-full ${width}`}
        >
          {children}
        </motion.div>

        <p className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] text-carbon-400">
          <Link to="/privacy" className={footLink}>
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" className={footLink}>
            Terms
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/security" className={footLink}>
            Security
          </Link>
          <span aria-hidden="true">·</span>
          <a href="mailto:verax.hello@gmail.com" className={footLink}>
            Help
          </a>
          <span aria-hidden="true">·</span>
          <span>© {new Date().getFullYear()} Verax</span>
        </p>
      </main>
    </div>
  );
};

/** The white card: a body, and an optional divided lower strip. */
export const AuthCard = ({ children, footer }) => (
  <div className="overflow-hidden rounded-[18px] border border-carbon-900/[0.07] bg-white shadow-[0_1px_2px_rgba(14,16,19,0.04),0_30px_70px_-40px_rgba(38,30,110,0.35)]">
    <div className="px-6 py-7 sm:px-8 sm:py-8">{children}</div>
    {footer ? <div className="border-t border-carbon-900/[0.06] bg-[#FAFAFB] px-6 py-5 sm:px-8">{footer}</div> : null}
  </div>
);

/** Title + one quiet line. */
export const AuthHeading = ({ title, subtitle }) => (
  <div>
    <h1 className="font-inter text-[1.375rem] font-normal tracking-[-0.02em] text-carbon-900">{title}</h1>
    {subtitle ? <p className="mt-1.5 text-[13.5px] leading-[1.55] text-carbon-500">{subtitle}</p> : null}
  </div>
);

/** Brand pill primary action with the hover arrow (DESIGN_SYSTEM.md §6). */
export const AuthButton = ({ loading, loadingLabel, children, className = "" }) => (
  <button
    type="submit"
    disabled={loading}
    className={`group inline-flex h-10 items-center justify-center rounded-full bg-brand-500 px-6 text-[13.5px] font-medium text-white shadow-[0_1px_2px_rgba(38,30,110,0.3),inset_0_1px_0_rgba(255,255,255,0.18)] transition-[background-color,opacity] duration-200 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
  >
    {loading ? (
      <>
        <span
          aria-hidden="true"
          className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white"
        />
        {loadingLabel}
      </>
    ) : (
      <>
        {children}
        <HoverArrow />
      </>
    )}
  </button>
);

/** Inline form-level error. */
export const AuthError = ({ children }) => (
  <p
    role="alert"
    className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] leading-[1.5] text-red-700"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="mt-[2px] flex-none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.5M8 10.8v.2" strokeLinecap="round" />
    </svg>
    {children}
  </p>
);

/**
 * Inline success / information message. `tone="success"` for a completed
 * action, `"info"` for neutral context, `"dev"` for development-only output.
 */
const NOTICE_TONES = {
  success: "border-verify-500/25 bg-verify-500/[0.07] text-verify-700",
  info: "border-carbon-900/[0.07] bg-[#FAFAFB] text-carbon-600",
  dev: "border-amber-500/25 bg-amber-500/[0.07] text-amber-800"
};

export const AuthNotice = ({ tone = "info", children }) => (
  <div
    role={tone === "success" ? "status" : undefined}
    className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] leading-[1.5] ${NOTICE_TONES[tone]}`}
  >
    {tone === "success" ? (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="mt-[2px] flex-none"
        aria-hidden="true"
      >
        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : null}
    <div className="min-w-0 break-words">{children}</div>
  </div>
);

/** Quiet text link used inside cards. */
export const AuthLink = ({ to, children }) => (
  <Link
    to={to}
    className="rounded font-medium text-carbon-900 underline decoration-carbon-300 underline-offset-[3px] transition-colors hover:decoration-carbon-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
  >
    {children}
  </Link>
);

export default AuthLayout;
