import LandingNav from "../marketing/LandingNav";
import LandingFooter from "../marketing/LandingFooter";

/**
 * Shared chrome for the secondary marketing routes: /features, /pricing,
 * /about, /security and /404.
 *
 * The layout's own glass navbar, gradient-box text logo and dark cream footer
 * were removed in the V2 pass — every public page now shares one navbar, one
 * footer and one canvas, so a visitor who clicks "Pricing" doesn't arrive at
 * what looks like a different company's website.
 *
 * The page *bodies* underneath are still on the older sand/ink/mint palette
 * and their own section furniture; they render correctly on the canvas but
 * they are not yet composed from `components/marketing/ledger.jsx`. Migrating
 * their content is a separate pass — see DESIGN_SYSTEM.md §7.
 */

const PublicLayout = ({ children }) => (
  <div className="vx-page flex min-h-screen flex-col">
    <LandingNav />
    <main className="flex-1">{children}</main>
    <LandingFooter />
  </div>
);

export default PublicLayout;
