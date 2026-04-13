import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";

const publicNavItems = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/about", label: "About" }
];

const PublicLayout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const scrollToWaitlist = () => {
    const element = document.getElementById("waitlist-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    } else if (location.pathname !== "/") {
      window.location.href = "/#waitlist-section";
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/20 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="rounded-xl bg-gradient-to-br from-ink-900 to-ink-700 px-3 py-2 text-xs font-bold uppercase tracking-widest text-sand-50 transition-all duration-300 group-hover:shadow-elevated">
                Verax
              </div>
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-mint-500/20 to-indigo-400/20 opacity-0 blur transition-opacity duration-300 group-hover:opacity-100" />
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {publicNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200",
                    isActive
                      ? "text-ink-900"
                      : "text-ink-600 hover:text-ink-900 hover:bg-sand-100/60"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-gradient-to-r from-mint-500 to-mint-600" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <button 
              onClick={scrollToWaitlist}
              className="btn-accent text-sm px-6 py-2.5"
            >
              Join Waitlist
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="flex items-center justify-center rounded-lg p-2 text-ink-700 transition hover:bg-sand-100 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <>
            <div
              className="menu-overlay fixed inset-0 z-40 bg-ink-900/20 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <div className="menu-drawer absolute left-0 right-0 top-full z-50 border-b border-[#e7dcc8] bg-white/95 backdrop-blur-xl px-4 py-4 shadow-elevated md:hidden">
              <nav className="flex flex-col gap-1">
                {publicNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "rounded-lg px-4 py-3 text-sm font-semibold transition",
                        isActive
                          ? "bg-ink-900 text-white"
                          : "text-ink-700 hover:bg-sand-100"
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                <hr className="my-2 border-[#e7dcc8]" />
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    scrollToWaitlist();
                  }}
                  className="btn-accent mt-1 text-center text-sm py-3"
                >
                  Join Waitlist
                </button>
              </nav>
            </div>
          </>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-[#e7dcc8] bg-ink-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="inline-block rounded-xl bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-sand-100">
                Verax
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-sand-100/70">
                Modern practice management built specifically for Chartered Accountant firms in India.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-sand-200">Product</h4>
              <ul className="mt-4 space-y-3 text-sm text-sand-100/70">
                <li><Link to="/features" className="transition hover:text-white">Features</Link></li>
                <li><Link to="/about" className="transition hover:text-white">About</Link></li>
                <li>
                  <button onClick={scrollToWaitlist} className="transition hover:text-white text-left">
                    Join Waitlist
                  </button>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-sand-200">Support</h4>
              <ul className="mt-4 space-y-3 text-sm text-sand-100/70">
                <li><span className="cursor-default">Documentation</span></li>
                <li><span className="cursor-default">API Reference</span></li>
                <li><span className="cursor-default">Contact Us</span></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-sand-200">Legal</h4>
              <ul className="mt-4 space-y-3 text-sm text-sand-100/70">
                <li><span className="cursor-default">Privacy Policy</span></li>
                <li><span className="cursor-default">Terms of Service</span></li>
                <li><span className="cursor-default">Security</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
            <p className="text-xs text-sand-100/50">
              © {new Date().getFullYear()} Verax. All rights reserved.
            </p>
            <p className="text-xs text-sand-100/40">
              Built with ❤️ for CA firms across India
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
