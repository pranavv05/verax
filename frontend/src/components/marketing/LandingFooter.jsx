import { Link } from "react-router-dom";
import VeraxLogo from "../brand/VeraxLogo";

/**
 * Minimal footer. Every entry below resolves to a real route or anchor —
 * Privacy and Terms are rendered as plain text because those pages do not
 * exist yet, and a dead link in a footer is worse than a plain label.
 */

const PRODUCT = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Documents", href: "/#documents" },
  { label: "The review screen", href: "/#review" },
  { label: "Tally export", href: "/#tally" },
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" }
];

const COMPANY = [
  { label: "About", to: "/about" },
  { label: "Security", to: "/security" },
  { label: "Client portal", to: "/client-portal/login" },
  { label: "Log in", to: "/login" },
  { label: "Create an account", to: "/signup" }
];

const linkClass =
  "rounded text-[0.875rem] text-carbon-500 transition-colors duration-200 hover:text-carbon-900 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas";

const FooterLink = ({ item }) =>
  item.to ? (
    <Link to={item.to} className={linkClass}>
      {item.label}
    </Link>
  ) : (
    <a href={item.href} className={linkClass}>
      {item.label}
    </a>
  );

const LandingFooter = () => (
  <footer className="border-t border-hairline bg-canvas">
    <div className="vx-shell py-16 lg:py-24">
      <div className="grid gap-14 lg:grid-cols-[1.5fr_1fr_1fr_1.1fr] lg:gap-16">
        <div>
          <VeraxLogo size={30} />
          <p className="mt-6 max-w-[20rem] text-[0.9375rem] leading-[1.7] text-carbon-500">
            Financial document intelligence for modern CA firms. Documents in,
            accounting-ready data out.
          </p>
        </div>

        <nav aria-label="Product">
          <h2 className="vx-index">Product</h2>
          <ul className="mt-6 space-y-3.5">
            {PRODUCT.map((item) => (
              <li key={item.label}>
                <FooterLink item={item} />
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="vx-index">Company</h2>
          <ul className="mt-6 space-y-3.5">
            {COMPANY.map((item) => (
              <li key={item.label}>
                <FooterLink item={item} />
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="vx-index">Get started</h2>
          <a href="/#demo" className="vx-cta mt-6 w-full sm:w-auto">
            Book a demo
          </a>
          <p className="mt-6 text-[0.875rem] text-carbon-500">
            <a
              href="mailto:verax.hello@gmail.com"
              className="rounded underline decoration-carbon-200 underline-offset-4 transition-colors hover:text-carbon-900 hover:decoration-carbon-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
            >
              verax.hello@gmail.com
            </a>
          </p>
        </div>
      </div>

      <div className="mt-16 flex flex-col gap-4 border-t border-hairline pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="vx-mono text-[0.6875rem] uppercase tracking-[0.12em] text-carbon-400">
          © 2026 Verax
          <span aria-hidden="true" className="mx-2.5">
            ·
          </span>
          Privacy
          <span aria-hidden="true" className="mx-2.5">
            ·
          </span>
          Terms
        </p>

        <p className="flex items-center gap-2 text-[0.8125rem] text-carbon-400">
          Made in India
          <span aria-hidden="true" className="flex h-3.5 w-5 overflow-hidden rounded-[2px]">
            <span className="h-full w-full bg-[#FF9933]" />
            <span className="h-full w-full bg-white" />
            <span className="h-full w-full bg-[#138808]" />
          </span>
        </p>
      </div>
    </div>
  </footer>
);

export default LandingFooter;
