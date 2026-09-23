import { useRef } from "react";
import { Link } from "react-router-dom";
import VeraxLogo from "../brand/VeraxLogo";

/**
 * The public footer, after Mercury, Stripe and Ramp.
 *
 *   From Mercury: a dense, readable link grid — sentence-case group headings
 *                 in a muted tone over larger, brighter links, lots of rhythm.
 *   From Stripe:  dashed column rules, several groups stacked in one column,
 *                 and the brand-coloured "›" links for the next step.
 *   From Ramp:    a top band that restates what the product is and how to
 *                 reach a person before the link grid starts.
 *   Finally an oversized wordmark bleeding off the bottom edge; a soft spotlight
 *   in the brand gradient follows the cursor across it (CSS variables only, no
 *   animation loop, so it costs nothing and needs no reduced-motion branch).
 *
 * Every entry resolves to a real route, homepage anchor or mailto, including
 * the /privacy and /terms legal pages.
 */

const EMAIL = "verax.hello@gmail.com";

// Columns hold one or more groups (Stripe stacks groups inside a column).
const COLUMNS = [
  [
    {
      title: "Product",
      links: [
        { label: "Coverage", href: "/#documents" },
        { label: "How it works", href: "/#how-it-works" },
        { label: "Client workflow", href: "/#workflow" },
        { label: "What changes", href: "/#outcomes" },
        { label: "All features", to: "/features" },
        { label: "Pricing", to: "/pricing" }
      ]
    }
  ],
  [
    {
      title: "Solutions",
      links: [
        { label: "For CA firms", to: "/features" },
        { label: "For their clients", to: "/client-portal/login" }
      ]
    },
    {
      title: "Trust",
      links: [{ label: "Security & data isolation", to: "/security" }]
    }
  ],
  [
    {
      title: "Company",
      links: [
        { label: "About", to: "/about" },
        { label: "Contact", href: `mailto:${EMAIL}` },
        { label: "Book a demo", href: "/#demo" }
      ]
    }
  ],
  [
    {
      title: "Account",
      links: [
        { label: "Create an account", to: "/signup" },
        { label: "Client portal", to: "/client-portal/login" },
        { label: "Forgot password", to: "/forgot-password" }
      ],
      accent: { label: "Log in", to: "/login" }
    }
  ]
];

const tones = (dark) =>
  dark
    ? {
        surface: "bg-carbon-950",
        rule: "border-white/10",
        dashed: "border-white/[0.08]",
        heading: "text-carbon-400",
        link: "text-carbon-200 hover:text-white",
        body: "text-carbon-400",
        strong: "text-white",
        accent: "text-brand-300 hover:text-brand-200",
        ring: "focus-visible:ring-offset-carbon-950",
        mark: "rgba(255,255,255,0.07)"
      }
    : {
        surface: "bg-canvas",
        rule: "border-hairline",
        dashed: "border-carbon-900/[0.08]",
        heading: "text-carbon-400",
        link: "text-carbon-600 hover:text-carbon-900",
        body: "text-carbon-500",
        strong: "text-carbon-900",
        accent: "text-brand-600 hover:text-brand-700",
        ring: "focus-visible:ring-offset-canvas",
        mark: "rgba(14,16,19,0.06)"
      };

const focusRing =
  "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4";

const Dest = ({ item, className, children }) =>
  item.to ? (
    <Link to={item.to} className={className}>
      {children}
    </Link>
  ) : (
    <a href={item.href} className={className}>
      {children}
    </a>
  );

const scrollToTop = () => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
};

/** Stripe's "›" that nudges right on hover. */
const Chevron = () => (
  <svg
    width="9"
    height="9"
    viewBox="0 0 10 10"
    fill="none"
    aria-hidden="true"
    className="ml-1 transition-transform duration-200 group-hover:translate-x-0.5"
  >
    <path d="M3 1.5 6.5 5 3 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The oversized wordmark, lit by a cursor-following spotlight. */
const Wordmark = ({ t }) => {
  const ref = useRef(null);

  const move = (event) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--x", `${event.clientX - rect.left}px`);
    el.style.setProperty("--y", `${event.clientY - rect.top}px`);
    el.style.setProperty("--lit", "1");
  };

  const leave = () => ref.current?.style.setProperty("--lit", "0");

  return (
    <div
      ref={ref}
      aria-hidden="true"
      onMouseMove={move}
      onMouseLeave={leave}
      className="relative mt-6 select-none overflow-hidden"
      style={{ "--x": "50%", "--y": "50%", "--lit": 0 }}
    >
      <p
        className="mt-[-0.14em] translate-y-[18%] text-center font-inter text-[clamp(6rem,24vw,21rem)] font-semibold leading-[0.8] tracking-[-0.07em]"
        style={{
          color: "transparent",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          backgroundImage: `radial-gradient(260px circle at var(--x) var(--y), rgba(102,87,217,calc(var(--lit) * 0.9)), rgba(77,141,255,calc(var(--lit) * 0.6)) 40%, rgba(20,184,166,calc(var(--lit) * 0.35)) 65%, transparent 80%), linear-gradient(${t.mark}, ${t.mark})`
        }}
      >
        verax
      </p>
    </div>
  );
};

/**
 * `dark`: the homepage ends on a near-black close (Mercury-style), so its
 * footer continues the dark rather than snapping back to ivory. Every other
 * public page keeps the light footer.
 */
const LandingFooter = ({ dark = false }) => {
  const t = tones(dark);

  return (
    <footer data-bg={dark ? "dark" : undefined} className={`relative overflow-hidden border-t ${t.rule} ${t.surface}`}>
      <div className="vx-shell pt-16 lg:pt-20">
        {/* Top band: what Verax is, and a person to write to */}
        <div className={`flex flex-col gap-8 border-b pb-12 lg:flex-row lg:items-end lg:justify-between ${t.rule}`}>
          <div className="max-w-[26rem]">
            <VeraxLogo size={30} tone={dark ? "light" : "dark"} />
            <p className={`mt-5 text-[1.0625rem] leading-[1.6] ${t.body}`}>
              <span className={t.strong}>Financial documents in. Tally-ready data out.</span> Built for Indian CA firms
              and the clients who send them paperwork.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[0.9375rem]">
            <a href={`mailto:${EMAIL}`} className={`group inline-flex items-center ${t.link} ${focusRing} ${t.ring}`}>
              <span className={`mr-2 ${t.heading}`}>Write to us</span>
              {EMAIL}
            </a>
            <a
              href="/#demo"
              className={`group inline-flex items-center font-medium ${t.accent} ${focusRing} ${t.ring}`}
            >
              Book a demo
              <Chevron />
            </a>
          </div>
        </div>

        {/* Link grid, Stripe's dashed column rules between columns */}
        <div className="grid grid-cols-2 gap-y-10 pt-12 md:grid-cols-4">
          {COLUMNS.map((groups, index) => (
            <div
              key={groups[0].title}
              className={`space-y-10 md:px-6 ${index === 0 ? "md:pl-0" : `md:border-l md:border-dashed ${t.dashed}`}`}
            >
              {groups.map((group) => (
                <nav key={group.title} aria-label={group.title}>
                  <h2 className={`text-[0.8125rem] font-medium ${t.heading}`}>{group.title}</h2>
                  <ul className="mt-4 space-y-2.5">
                    {group.links.map((item) => (
                      <li key={item.label}>
                        <Dest
                          item={item}
                          className={`text-[0.9375rem] transition-colors duration-200 ${t.link} ${focusRing} ${t.ring}`}
                        >
                          {item.label}
                        </Dest>
                      </li>
                    ))}
                  </ul>
                  {group.accent ? (
                    <Dest
                      item={group.accent}
                      className={`group mt-6 inline-flex items-center text-[0.9375rem] font-medium ${t.accent} ${focusRing} ${t.ring}`}
                    >
                      {group.accent.label}
                      <Chevron />
                    </Dest>
                  ) : null}
                </nav>
              ))}
            </div>
          ))}
        </div>

        {/* Legal row */}
        <div
          className={`mt-14 flex flex-col gap-4 border-t pt-7 text-[0.8125rem] sm:flex-row sm:items-center sm:justify-between ${t.rule} ${t.heading}`}
        >
          <p className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>© 2026 Verax</span>
            <Link to="/privacy" className={`transition-colors ${t.link} ${focusRing} ${t.ring}`}>
              Privacy
            </Link>
            <Link to="/terms" className={`transition-colors ${t.link} ${focusRing} ${t.ring}`}>
              Terms
            </Link>
          </p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={scrollToTop}
              className={`group inline-flex items-center gap-1.5 transition-colors ${t.link} ${focusRing} ${t.ring}`}
            >
              Back to top
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:-translate-y-0.5"
              >
                <path
                  d="M5 8.5v-7M1.8 4.5 5 1.3l3.2 3.2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <Wordmark t={t} />
    </footer>
  );
};

export default LandingFooter;
