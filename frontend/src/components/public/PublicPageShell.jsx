import { Link } from "react-router-dom";
import VeraxLogo from "../brand/VeraxLogo";

/**
 * Chrome for the unauthenticated magic-link pages (upload + status), in the
 * homepage's light (DESIGN_SYSTEM.md): the ivory canvas with its soft light
 * sources, a frosted header, and a quiet footer.
 *
 * These are opened by SME clients — usually on a phone, often from a WhatsApp
 * link — so the header stays minimal and the content column is narrow.
 */

const FIELD = [
  "radial-gradient(55% 35% at 12% 0%, rgba(102,87,217,0.13), transparent 70%)",
  "radial-gradient(45% 35% at 90% 0%, rgba(77,141,255,0.13), transparent 70%)",
  "radial-gradient(40% 30% at 85% 100%, rgba(20,184,166,0.08), transparent 70%)"
].join(",");

const footLink =
  "rounded transition-colors hover:text-carbon-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

const PublicPageShell = ({ children, badge, maxWidth = "max-w-2xl" }) => (
  <div className="relative flex min-h-screen flex-col bg-canvas font-inter text-carbon-900 antialiased">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: FIELD }} />

    <header className="sticky top-0 z-40 border-b border-carbon-900/[0.06] bg-[#F7F6F2]/80 backdrop-blur-xl">
      <div className={`mx-auto flex ${maxWidth} items-center justify-between gap-4 px-5 py-3.5 sm:px-6`}>
        <VeraxLogo size={26} />
        {badge ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[12px] font-medium text-carbon-600 backdrop-blur">
            <svg
              width="11"
              height="11"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect x="4" y="9" width="12" height="8.5" rx="2" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
            </svg>
            {badge}
          </span>
        ) : null}
      </div>
    </header>

    <main className={`relative mx-auto w-full flex-1 ${maxWidth} px-5 py-9 sm:px-6 sm:py-14`}>{children}</main>

    <footer className="relative border-t border-carbon-900/[0.06]">
      <div
        className={`mx-auto flex ${maxWidth} flex-col items-center gap-3 px-5 py-6 text-center text-[12.5px] text-carbon-400 sm:flex-row sm:justify-between sm:px-6 sm:text-left`}
      >
        <p>Secured by Verax · files go straight to private, per-firm storage.</p>
        <p className="flex items-center gap-3">
          <Link to="/privacy" className={footLink}>
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" className={footLink}>
            Terms
          </Link>
          <span aria-hidden="true">·</span>
          <a className={footLink} href="mailto:verax.hello@gmail.com">
            Need help?
          </a>
        </p>
      </div>
    </footer>
  </div>
);

export default PublicPageShell;
