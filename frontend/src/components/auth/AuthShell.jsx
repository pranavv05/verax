import { Link } from "react-router-dom";
import VeraxLogo from "../brand/VeraxLogo";
import { PageTransition } from "../public/motion";

/**
 * Two-column auth shell, in the marketing site's system.
 *
 * Form on the paper canvas, a quiet near-black panel opposite — the same
 * carbon ground the landing page uses for its three contrast sections, so
 * signing in feels like the same company as the page you arrived from.
 *
 * Below `lg` the grid collapses and the panel moves *below* the form, kept in
 * its own carbon container so it retains its own ground rather than being
 * dropped or awkwardly recoloured. It is `aria-hidden` there because it is a
 * second copy of content the desktop aside already exposes, and it is
 * decorative either way.
 */
const AuthShell = ({ children, panel, footnote }) => (
  <div className="vx-page min-h-screen lg:grid lg:grid-cols-[1fr_minmax(430px,43%)]">
    {/* ── Form column ──────────────────────────────────────────────────── */}
    <div className="flex min-h-screen flex-col px-6 py-9 sm:px-10 lg:px-14 xl:px-20">
      <Link
        to="/"
        aria-label="Verax — home"
        className="inline-flex w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-brand-500 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
      >
        <VeraxLogo size={30} />
      </Link>

      <PageTransition className="flex flex-1 items-center py-14">
        <div className="mx-auto w-full max-w-[27rem]">{children}</div>
      </PageTransition>

      {/* The panel, restated under the form on small screens. */}
      {panel ? (
        <div aria-hidden="true" className="mb-10 lg:hidden">
          <div className="vx-dark rounded-2xl px-6 py-8">{panel}</div>
        </div>
      ) : null}

      <p className="text-[0.75rem] text-carbon-400">
        {footnote || (
          <>
            © {new Date().getFullYear()} Verax
            <span aria-hidden="true" className="mx-2">
              ·
            </span>
            <a
              className="rounded underline decoration-carbon-200 underline-offset-4 transition-colors
                         hover:text-carbon-900 hover:decoration-carbon-400 focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4
                         focus-visible:ring-offset-canvas"
              href="mailto:verax.hello@gmail.com"
            >
              verax.hello@gmail.com
            </a>
          </>
        )}
      </p>
    </div>

    {/* ── Panel column (desktop) ───────────────────────────────────────── */}
    <aside className="vx-dark relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center">
      <div className="relative px-12 py-16 xl:px-16">{panel}</div>
    </aside>
  </div>
);

export default AuthShell;
