import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import VeraxLogo from "../brand/VeraxLogo";
import { EASE } from "../public/motion";

/**
 * The marketing navbar, after Stripe and Mercury.
 *
 * - Stripe's morphing dropdown: one floating panel that opens under a menu
 *   trigger and then glides + resizes between menus as the pointer moves
 *   across, with a caret tracking the trigger and the content sliding in the
 *   direction of travel. Hover, click, keyboard (Enter / Space / ArrowDown)
 *   and Escape all work.
 * - Transparent over the top of the page; frosted glass with a hairline once
 *   scrolled. Follows the homepage's ThemeCanvas into its dark sections.
 * - Stripe's hover arrow on the primary CTA.
 * - A hover pill that glides between the centre items (one shared layoutId),
 *   and Stripe's footer strip along the bottom of each dropdown panel.
 * - Mobile: a full-screen sheet with staggered items and accordion groups.
 *
 * Every destination exists — homepage anchors (#documents, #how-it-works,
 * #workflow, #outcomes, #demo) and real routes (/features, /security,
 * /pricing, /about, /client-portal/login). No menu stands in for a page that
 * was never built.
 */

/* ── Content ────────────────────────────────────────────────────────────── */

const Glyph = ({ d }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);

const G = {
  coverage: (
    <>
      <path d="M4 1.8h5.5L12.5 5v9.2H4z" />
      <path d="M9.5 1.8V5h3M6 8h4.5M6 10.5h3" />
    </>
  ),
  engine: <path d="M2 8h2.5l1.5-4 3 8 1.5-4H14" />,
  workflow: (
    <>
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="8" r="2" />
      <path d="M6 8h4" />
    </>
  ),
  outcomes: <path d="M2.5 12.5 6 9l2.5 2.5L13.5 5M10 5h3.5v3.5" />,
  firm: (
    <>
      <path d="M2.5 13.5h11M3.5 13.5V6.5L8 3.5l4.5 3v7" />
      <path d="M6.5 13.5v-3h3v3" />
    </>
  ),
  client: (
    <>
      <rect x="4.5" y="1.8" width="7" height="12.4" rx="1.5" />
      <path d="M7 11.8h2" />
    </>
  ),
  security: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M8 7.2v3.6M8 5.2v.2" />
    </>
  )
};

const MENUS = {
  product: {
    label: "Product",
    width: 640,
    height: 344,
    items: [
      {
        href: "/#documents",
        title: "Coverage",
        body: "Invoices, statements, registers and GST data",
        glyph: "coverage"
      },
      { href: "/#how-it-works", title: "How it works", body: "One invoice through all six stages", glyph: "engine" },
      { href: "/#workflow", title: "Client workflow", body: "Upload links and the client portal", glyph: "workflow" },
      {
        href: "/#outcomes",
        title: "What changes",
        body: "Less entry, fewer checks, a full audit trail",
        glyph: "outcomes"
      }
    ],
    feature: {
      to: "/features",
      eyebrow: "Everything in Verax",
      title: "Every feature, in detail",
      body: "Extraction, GST validation, GSTR-2B reconciliation and Tally export."
    }
  },
  solutions: {
    label: "Solutions",
    width: 460,
    height: 286,
    items: [
      { to: "/features", title: "For CA firms", body: "Review, reconcile and export to Tally", glyph: "firm" },
      {
        to: "/client-portal/login",
        title: "For their clients",
        body: "Upload from a link, see every document's status",
        glyph: "client"
      },
      { to: "/about", title: "About Verax", body: "Who we are and why we built it", glyph: "security" }
    ]
  }
};

const MENU_ORDER = ["product", "solutions"];

const PLAIN = [
  { to: "/security", label: "Security" },
  { to: "/pricing", label: "Pricing" }
];

const Dest = ({ item, className, children, onClick }) =>
  item.to ? (
    <Link to={item.to} className={className} onClick={onClick}>
      {children}
    </Link>
  ) : (
    <a href={item.href} className={className} onClick={onClick}>
      {children}
    </a>
  );

/* ── Pieces ─────────────────────────────────────────────────────────────── */

/** Stripe's hover arrow: a chevron whose shaft draws in on hover. */
const HoverArrow = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="ml-1.5 overflow-visible">
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

const MenuItem = ({ item, onNavigate }) => (
  <Dest
    item={item}
    onClick={onNavigate}
    className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-[#F4F3F8] focus-visible:bg-[#F4F3F8] focus-visible:outline-none"
  >
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-carbon-900/[0.07] bg-white text-brand-600 shadow-[0_1px_2px_rgba(14,16,19,0.06)] transition-colors group-hover:border-brand-500/30">
      <Glyph d={G[item.glyph]} />
    </span>
    <span className="min-w-0 pt-0.5">
      <span className="flex items-center text-[14px] font-medium text-carbon-900">
        {item.title}
        <span className="text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
          <HoverArrow />
        </span>
      </span>
      <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-carbon-500">{item.body}</span>
    </span>
  </Dest>
);

/** Stripe's panel footer: a quiet strip with one aside and one next step. */
const PanelStrip = ({ aside, next, onNavigate }) => (
  <div className="flex h-12 flex-none items-center justify-between border-t border-carbon-900/[0.06] bg-[#FAFAFB] px-5 text-[12.5px]">
    <span className="text-carbon-500">{aside}</span>
    <Dest
      item={next}
      onClick={onNavigate}
      className="group flex items-center font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:underline"
    >
      {next.label}
      <HoverArrow />
    </Dest>
  </div>
);

const ProductPanel = ({ onNavigate }) => {
  const menu = MENUS.product;
  return (
    <div className="flex h-full flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_224px] gap-3 p-3">
        <div className="grid grid-cols-1 content-start gap-0.5">
          {menu.items.map((item) => (
            <MenuItem key={item.title} item={item} onNavigate={onNavigate} />
          ))}
        </div>
        <Link
          to={menu.feature.to}
          onClick={onNavigate}
          className="group relative flex flex-col justify-end overflow-hidden rounded-xl bg-carbon-950 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 transition-transform duration-500 group-hover:scale-110"
            style={{
              background: [
                "radial-gradient(80% 60% at 100% 0%, rgba(102,87,217,0.75), transparent 70%)",
                "radial-gradient(70% 60% at 0% 30%, rgba(77,141,255,0.45), transparent 70%)",
                "radial-gradient(60% 50% at 70% 100%, rgba(20,184,166,0.4), transparent 70%)"
              ].join(",")
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)",
              backgroundSize: "14px 14px",
              maskImage: "linear-gradient(to bottom, black, transparent 80%)",
              WebkitMaskImage: "linear-gradient(to bottom, black, transparent 80%)"
            }}
          />
          <span className="relative text-[11px] font-medium uppercase tracking-[0.1em] text-white/60">
            {menu.feature.eyebrow}
          </span>
          <span className="relative mt-1.5 flex items-center text-[15px] font-medium text-white">
            {menu.feature.title}
            <HoverArrow />
          </span>
          <span className="relative mt-1 text-[12.5px] leading-[1.45] text-white/65">{menu.feature.body}</span>
        </Link>
      </div>
      <PanelStrip
        aside={
          <>
            Questions?{" "}
            <a
              href="mailto:verax.hello@gmail.com"
              className="text-carbon-700 underline decoration-carbon-300 underline-offset-2 hover:text-carbon-900"
            >
              verax.hello@gmail.com
            </a>
          </>
        }
        next={{ to: "/pricing", label: "See pricing" }}
        onNavigate={onNavigate}
      />
    </div>
  );
};

const SolutionsPanel = ({ onNavigate }) => (
  <div className="flex h-full flex-col">
    <div className="grid min-h-0 flex-1 content-start gap-0.5 p-3">
      {MENUS.solutions.items.map((item) => (
        <MenuItem key={item.title} item={item} onNavigate={onNavigate} />
      ))}
    </div>
    <PanelStrip
      aside="Clients upload from a link — no login."
      next={{ href: "/#demo", label: "Book a demo" }}
      onNavigate={onNavigate}
    />
  </div>
);

const PANELS = { product: ProductPanel, solutions: SolutionsPanel };

/* ── Navbar ─────────────────────────────────────────────────────────────── */

const LandingNav = () => {
  const reduced = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(null); // menu key | null
  const [direction, setDirection] = useState(0);
  const [anchorX, setAnchorX] = useState(0); // trigger centre, px from nav left
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState(null);
  const [hovered, setHovered] = useState(null); // centre item under the pointer

  const barRef = useRef(null);
  const triggerRefs = useRef({});
  const closeTimer = useRef(null);

  // Follow the homepage ThemeCanvas into dark sections.
  useEffect(() => {
    const onTheme = (event) => setDark(event.detail === "dark");
    window.addEventListener("vx-theme", onTheme);
    return () => window.removeEventListener("vx-theme", onTheme);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openMenu = useCallback((key) => {
    window.clearTimeout(closeTimer.current);
    const trigger = triggerRefs.current[key];
    const bar = barRef.current;
    if (trigger && bar) {
      const t = trigger.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      setAnchorX(t.left + t.width / 2 - b.left);
    }
    setOpen((current) => {
      if (current && current !== key) {
        setDirection(MENU_ORDER.indexOf(key) > MENU_ORDER.indexOf(current) ? 1 : -1);
      } else {
        setDirection(0);
      }
      return key;
    });
  }, []);

  const scheduleClose = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 140);
  }, []);

  const closeNow = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    setOpen(null);
  }, []);

  // Escape closes the dropdown and returns focus to its trigger.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        triggerRefs.current[open]?.focus();
        closeNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeNow]);

  // Mobile sheet: lock scroll, Escape closes.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const menu = open ? MENUS[open] : null;
  const barWidth = barRef.current?.getBoundingClientRect().width || 1200;
  const panelLeft = menu ? Math.max(8, Math.min(barWidth - menu.width - 8, anchorX - menu.width / 2)) : 0;
  const caretLeft = anchorX - panelLeft;

  const linkTone = dark ? "text-carbon-200 hover:text-white" : "text-carbon-600 hover:text-carbon-900";
  const surface = dark
    ? scrolled || open
      ? "border-white/10 bg-carbon-950/75 backdrop-blur-xl"
      : "border-transparent bg-transparent"
    : scrolled || open
      ? "border-carbon-900/[0.07] bg-[#F7F6F2]/80 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_24px_-18px_rgba(14,16,19,0.25)] backdrop-blur-xl"
      : "border-transparent bg-transparent";
  const Panel = open ? PANELS[open] : null;
  // The pill sits under the hovered item, or the open menu's trigger.
  const pillOn = hovered ?? open;
  const pill = (key) =>
    pillOn === key ? (
      <motion.span
        layoutId="vx-nav-pill"
        aria-hidden="true"
        className={`absolute inset-0 -z-10 rounded-full ${dark ? "bg-white/10" : "bg-carbon-900/[0.055]"}`}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
      />
    ) : null;

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-500 ${surface}`}
    >
      <div
        ref={barRef}
        className="vx-shell relative flex h-16 items-center justify-between gap-6"
        onMouseLeave={scheduleClose}
      >
        <Link
          to="/"
          aria-label="Verax — home"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4"
        >
          <VeraxLogo size={28} tone={dark ? "light" : "dark"} />
        </Link>

        {/* Centre */}
        <nav
          aria-label="Main"
          onMouseLeave={() => setHovered(null)}
          className="absolute left-1/2 isolate hidden -translate-x-1/2 items-center gap-1 md:flex"
        >
          {MENU_ORDER.map((key) => {
            const isOpen = open === key;
            return (
              <button
                key={key}
                ref={(el) => {
                  triggerRefs.current[key] = el;
                }}
                type="button"
                aria-expanded={isOpen}
                aria-controls="vx-nav-panel"
                onMouseEnter={() => {
                  setHovered(key);
                  openMenu(key);
                }}
                onClick={() => (isOpen ? closeNow() : openMenu(key))}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    openMenu(key);
                    window.setTimeout(() => document.querySelector("#vx-nav-panel a")?.focus(), 60);
                  }
                }}
                className={`relative flex items-center gap-1 rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${linkTone} ${
                  isOpen ? (dark ? "text-white" : "text-carbon-900") : ""
                }`}
              >
                {pill(key)}
                {MENUS[key].label}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  aria-hidden="true"
                  className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                >
                  <path
                    d="m2 3.5 3 3 3-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            );
          })}
          {PLAIN.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              onMouseEnter={() => {
                setHovered(item.label);
                scheduleClose();
              }}
              className={`relative rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${linkTone}`}
            >
              {pill(item.label)}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/login"
            onMouseEnter={scheduleClose}
            className={`rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${linkTone}`}
          >
            Log in
          </Link>
          <a
            href="/#demo"
            onMouseEnter={scheduleClose}
            className="group inline-flex h-9 items-center rounded-full bg-brand-500 pl-4 pr-3.5 text-[14px] font-medium text-white shadow-[0_1px_2px_rgba(38,30,110,0.3),inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors duration-200 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Book a demo
            <HoverArrow />
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className={`-mr-2 flex h-11 w-11 items-center justify-center rounded-lg transition-colors md:hidden ${linkTone}`}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <motion.path
              animate={mobileOpen ? { d: "M6 18L18 6" } : { d: "M3.5 8L20.5 8" }}
              transition={{ duration: 0.25, ease: EASE }}
            />
            <motion.path
              animate={mobileOpen ? { d: "M6 6L18 18" } : { d: "M3.5 16L20.5 16" }}
              transition={{ duration: 0.25, ease: EASE }}
            />
          </svg>
        </button>

        {/* ── Desktop: the morphing panel ─────────────────────────────── */}
        <AnimatePresence>
          {menu ? (
            <motion.div
              key="panel"
              id="vx-nav-panel"
              onMouseEnter={() => window.clearTimeout(closeTimer.current)}
              onMouseLeave={scheduleClose}
              initial={
                reduced
                  ? false
                  : { opacity: 0, y: 6, scale: 0.97, left: panelLeft, width: menu.width, height: menu.height }
              }
              animate={{ opacity: 1, y: 0, scale: 1, left: panelLeft, width: menu.width, height: menu.height }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: reduced ? 0 : 0.32, ease: EASE }}
              style={{ transformOrigin: `${caretLeft}px 0px` }}
              className="absolute top-[58px] z-50 hidden md:block"
            >
              {/* caret */}
              <motion.span
                aria-hidden="true"
                className="absolute -top-[5px] z-10 h-3 w-3 rotate-45 rounded-[2px] border-l border-t border-carbon-900/[0.08] bg-white"
                initial={false}
                animate={{ left: caretLeft - 6 }}
                transition={{ duration: reduced ? 0 : 0.32, ease: EASE }}
              />
              <div className="relative h-full overflow-hidden rounded-2xl border border-carbon-900/[0.08] bg-white shadow-[0_40px_80px_-20px_rgba(14,16,19,0.28),0_12px_24px_-12px_rgba(14,16,19,0.18)]">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                  <motion.div
                    key={open}
                    custom={direction}
                    variants={{
                      enter: (dir) => ({ opacity: 0, x: dir * 60 }),
                      center: { opacity: 1, x: 0 },
                      exit: (dir) => ({ opacity: 0, x: dir * -60 })
                    }}
                    initial={reduced ? false : "enter"}
                    animate="center"
                    exit={reduced ? undefined : "exit"}
                    transition={{ duration: 0.28, ease: EASE }}
                    className="absolute inset-0"
                  >
                    <Panel onNavigate={closeNow} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ── Mobile sheet ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            key="sheet"
            initial={reduced ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed inset-x-0 bottom-0 top-16 z-50 flex flex-col overflow-y-auto bg-[#F7F6F2] px-6 pb-8 pt-4 md:hidden"
          >
            <motion.nav
              initial="hidden"
              animate="shown"
              variants={{ shown: { transition: { staggerChildren: reduced ? 0 : 0.05 } } }}
              className="divide-y divide-carbon-900/[0.07]"
              aria-label="Main"
            >
              {MENU_ORDER.map((key) => {
                const expanded = mobileGroup === key;
                return (
                  <motion.div
                    key={key}
                    variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setMobileGroup(expanded ? null : key)}
                      className="flex w-full items-center justify-between py-4 text-left text-[22px] font-medium tracking-[-0.02em] text-carbon-900"
                    >
                      {MENUS[key].label}
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 10 10"
                        aria-hidden="true"
                        className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                      >
                        <path
                          d="m2 3.5 3 3 3-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <AnimatePresence initial={false}>
                      {expanded ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <div className="-mx-2.5 pb-3">
                            {[
                              ...MENUS[key].items,
                              ...(MENUS[key].feature ? [{ ...MENUS[key].feature, glyph: "coverage" }] : [])
                            ].map((item) => (
                              <MenuItem key={item.title} item={item} onNavigate={() => setMobileOpen(false)} />
                            ))}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
              {PLAIN.map((item) => (
                <motion.div
                  key={item.label}
                  variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <Link
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="block py-4 text-[22px] font-medium tracking-[-0.02em] text-carbon-900"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </motion.nav>

            <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="flex h-12 items-center justify-center rounded-full border border-carbon-900/15 bg-white text-[15px] font-medium text-carbon-900"
              >
                Log in
              </Link>
              <a
                href="/#demo"
                onClick={() => setMobileOpen(false)}
                className="flex h-12 items-center justify-center rounded-full bg-brand-500 text-[15px] font-medium text-white"
              >
                Book a demo
              </a>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
};

export default LandingNav;
