import LandingNav from "../marketing/LandingNav";
import LandingFooter from "../marketing/LandingFooter";
import { ThemeCanvas } from "../marketing/v3";

/**
 * Shared chrome for the secondary public routes: /features, /pricing, /about,
 * /security, /privacy, /terms and /404 — the same nav, footer and canvas as the
 * homepage, so a visitor who clicks "Pricing" doesn't arrive at what looks like
 * a different company's website.
 *
 * `ThemeCanvas` is the homepage's Mercury-style page background: a fixed layer
 * that cross-fades to near-black while a dark band (`data-bg="dark"`, e.g. the
 * ClosingCTA) holds the middle of the viewport, and tells the nav to follow.
 * The page root is transparent so that layer shows through (see
 * DESIGN_SYSTEM.md §4).
 */

const PublicLayout = ({ children }) => (
  <div className="vx-page flex min-h-screen flex-col !bg-transparent">
    <ThemeCanvas />
    <LandingNav />
    <main className="flex-1">{children}</main>
    <LandingFooter />
  </div>
);

export default PublicLayout;
