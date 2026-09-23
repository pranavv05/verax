import { Link } from "react-router-dom";

/**
 * The public surface's buttons (DESIGN_SYSTEM.md §6), so every page uses the
 * same controls as the homepage and navbar.
 *
 *   <Cta to="/signup">…</Cta>             brand pill with Stripe's hover arrow
 *   <Cta href="/#demo" variant="glass">   translucent secondary pill
 *   <Cta variant="quiet">                 white pill for white surfaces
 *   <Cta variant="invert">                white pill for dark bands
 *
 * `to` renders a router Link, `href` a plain anchor (for /#anchors, mailto:).
 */

export const HoverArrow = ({ className = "" }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    aria-hidden="true"
    className={`ml-1.5 overflow-visible ${className}`}
  >
    <path
      d="M0 5h7"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
    />
    <path
      d="M1 1l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform duration-150 group-hover:translate-x-[3px]"
    />
  </svg>
);

const SIZES = {
  md: "h-10 px-5 text-[14px]",
  lg: "h-12 px-6 text-[15px]"
};

const VARIANTS = {
  primary:
    "bg-brand-500 text-white shadow-[0_1px_2px_rgba(38,30,110,0.3),inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-brand-600 focus-visible:ring-offset-2",
  glass:
    "border border-white/80 bg-white/60 text-carbon-800 backdrop-blur hover:bg-white hover:text-carbon-900 focus-visible:ring-offset-2",
  quiet:
    "border border-carbon-900/10 bg-white text-carbon-900 shadow-[0_1px_2px_rgba(14,16,19,0.05)] hover:border-carbon-900/20 focus-visible:ring-offset-2",
  invert:
    "bg-white text-carbon-950 hover:bg-carbon-100 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon-950"
};

const Cta = ({ to, href, variant = "primary", size = "md", arrow = true, className = "", children, ...rest }) => {
  const classes = `group inline-flex items-center justify-center rounded-full font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
  const content = (
    <>
      {children}
      {arrow ? <HoverArrow /> : null}
    </>
  );

  return to ? (
    <Link to={to} className={classes} {...rest}>
      {content}
    </Link>
  ) : (
    <a href={href} className={classes} {...rest}>
      {content}
    </a>
  );
};

export default Cta;
