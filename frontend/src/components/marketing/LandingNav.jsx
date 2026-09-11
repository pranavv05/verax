import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import VeraxLogo from "../brand/VeraxLogo";
import { EASE } from "../public/motion";

// Every item points at something that exists: three anchors on the homepage
// and two real routes. No "Solutions" or "Resources" standing in for pages
// that were never built — a nav that lies is the first thing a careful
// visitor notices.
const navItems = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#documents", label: "Documents" },
  { to: "/security", label: "Security" },
  { to: "/pricing", label: "Pricing" }
];

const NavLink = ({ item, className = "", onClick }) =>
  item.to ? (
    <Link to={item.to} onClick={onClick} className={className}>
      {item.label}
    </Link>
  ) : (
    <a href={item.href} onClick={onClick} className={className}>
      {item.label}
    </a>
  );

const LandingNav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock the page behind the mobile overlay, and let Escape close it.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header
      // Always a solid ivory bar with a subtle hairline — no scroll-triggered
      // glass/blur toggle. The border only deepens slightly on scroll, which
      // is a restrained acknowledgement of depth rather than a glass pill.
      className={`sticky top-0 z-50 border-b bg-canvas transition-colors duration-300 ${
        scrolled ? "border-hairline-strong" : "border-hairline"
      }`}
    >
      <div className="vx-shell flex h-16 items-center justify-between gap-6">
        <Link
          to="/"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
          aria-label="Verax — home"
        >
          <VeraxLogo size={30} />
        </Link>

        {/* Centre: links, separated by dots rather than by boxes */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-3 md:flex">
          {navItems.map((item, index) => (
            <Fragment key={item.label}>
              {index > 0 ? (
                <span aria-hidden="true" className="text-[11px] text-carbon-200">
                  ·
                </span>
              ) : null}
              <NavLink
                item={item}
                className="text-sm font-medium text-carbon-500 transition-colors duration-200 hover:text-carbon-900 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
              />
            </Fragment>
          ))}
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <Link
            to="/login"
            className="text-sm font-medium text-carbon-500 transition-colors duration-200 hover:text-carbon-900 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
          >
            Log in
          </Link>
          <a
            href="/#demo"
            className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-[0.88]"
          >
            Book a demo
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-carbon-600 transition-colors hover:text-carbon-900 md:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {menuOpen ? <path d="M6 18 18 6M6 6l12 12" /> : <path d="M3.5 8h17M3.5 16h17" />}
          </svg>
        </button>
      </div>

      {/* ── Mobile: full-screen overlay ───────────────────────────────── */}
      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="fixed inset-0 top-16 z-50 flex flex-col bg-canvas p-8 md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  item={item}
                  onClick={() => setMenuOpen(false)}
                  className="py-3 text-[30px] font-semibold tracking-[-0.035em] text-carbon-900"
                />
              ))}
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="py-3 text-[30px] font-semibold tracking-[-0.035em] text-carbon-400"
              >
                Log in
              </Link>
            </nav>

            <a
              href="/#demo"
              onClick={() => setMenuOpen(false)}
              className="mt-auto flex h-14 items-center justify-center rounded-full bg-brand-500 text-base font-medium text-white"
            >
              Book a demo
            </a>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
};

export default LandingNav;
