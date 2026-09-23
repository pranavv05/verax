import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion";
import { EASE, Reveal } from "../public/motion";

/**
 * V3 marketing atoms — the vocabulary the rebuilt hero introduced, shared by
 * every section below it so the page reads as one system (after Stripe and
 * Mercury): a gradient eyebrow, a two-tone headline, soft aurora light behind
 * glass surfaces, and cards that answer the cursor.
 *
 * Presentational only. Every animation collapses under prefers-reduced-motion,
 * either through `useReducedMotion()` or the `.vx-page` CSS kill switch.
 */

/** Small gradient label that opens a section. */
export const Kicker = ({ children, dark = false, className = "" }) => (
  <p
    className={`inline-flex items-center gap-2 text-[0.8125rem] font-semibold tracking-[-0.005em] ${className}`}
  >
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-brand-500 to-sky-500"
    />
    <span className={dark ? "vx-hero-gradient-dark" : "vx-hero-gradient"}>{children}</span>
  </p>
);

/**
 * Stripe's two-tone headline: a dark statement, then a muted continuation at
 * the same size. `title` is the statement, `tint` the continuation.
 */
export const Heading = ({
  kicker,
  title,
  tint,
  lead,
  align = "left",
  dark = false,
  className = "",
  children
}) => (
  <Reveal
    className={`${align === "center" ? "mx-auto max-w-[46rem] text-center" : "max-w-[40rem]"} ${className}`}
  >
    {kicker ? (
      <Kicker dark={dark} className={align === "center" ? "justify-center" : ""}>
        {kicker}
      </Kicker>
    ) : null}

    <h2
      className={`mt-5 font-inter text-[clamp(1.75rem,2.9vw,2.375rem)] font-normal leading-[1.14] tracking-[-0.03em] ${
        dark ? "text-white" : "text-carbon-900"
      }`}
    >
      {title}
      {tint ? (
        <>
          {" "}
          <span className="text-carbon-400">{tint}</span>
        </>
      ) : null}
    </h2>

    {lead ? (
      <p
        className={`mt-6 max-w-[38rem] text-[1.0625rem] leading-[1.7] ${
          align === "center" ? "mx-auto" : ""
        } ${dark ? "text-carbon-300" : "text-carbon-500"}`}
      >
        {lead}
      </p>
    ) : null}

    {children}
  </Reveal>
);

/** Soft coloured light, the hero's aurora at section scale. */
const EDGE_FADE = "linear-gradient(to bottom, transparent 0px, black 220px, black calc(100% - 220px), transparent 100%)";

export const Aurora = ({ className = "", tone = "light" }) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute inset-0 ${className}`}
    style={{
      maskImage: EDGE_FADE,
      WebkitMaskImage: EDGE_FADE,
      background:
        tone === "dark"
          ? [
              "radial-gradient(40% 50% at 15% 0%, rgba(102,87,217,0.35), transparent 70%)",
              "radial-gradient(35% 45% at 85% 10%, rgba(77,141,255,0.25), transparent 70%)",
              "radial-gradient(40% 40% at 60% 100%, rgba(20,184,166,0.18), transparent 70%)"
            ].join(",")
          : [
              "radial-gradient(45% 40% at 10% 10%, rgba(102,87,217,0.12), transparent 70%)",
              "radial-gradient(40% 40% at 92% 20%, rgba(77,141,255,0.12), transparent 70%)",
              "radial-gradient(40% 35% at 70% 95%, rgba(20,184,166,0.10), transparent 70%)"
            ].join(",")
    }}
  />
);

/**
 * A card with a cursor-following spotlight on its border and surface — the
 * interaction Stripe and Linear use to make a static grid feel alive.
 */
export const GlowCard = ({ children, className = "", dark = false, as = "div" }) => {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const glow = useMotionTemplate`radial-gradient(380px circle at ${x}px ${y}px, ${
    dark ? "rgba(139,124,246,0.18)" : "rgba(102,87,217,0.10)"
  }, transparent 70%)`;
  const MotionTag = motion[as] || motion.div;

  const onMove = (event) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(event.clientX - rect.left);
    y.set(event.clientY - rect.top);
  };

  const onLeave = () => {
    x.set(-400);
    y.set(-400);
  };

  return (
    <MotionTag
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileHover={reduced ? undefined : { y: -3 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={`group relative overflow-hidden rounded-2xl border ${
        dark
          ? "border-white/10 bg-white/[0.03]"
          : "border-white/70 bg-white/80 shadow-[0_24px_60px_-40px_rgba(38,30,110,0.35)] backdrop-blur"
      } ${className}`}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ background: glow }}
      />
      <div className="relative h-full">{children}</div>
    </MotionTag>
  );
};

/** Traffic-light window chrome for drawn product UI. */
export const WindowChrome = ({ label, dark = false }) => (
  <div
    className={`flex items-center gap-3 border-b px-4 py-2.5 ${
      dark ? "border-white/10 bg-white/[0.03]" : "border-hairline bg-white/70"
    }`}
  >
    <span className="flex gap-1.5" aria-hidden="true">
      <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
    </span>
    {label ? (
      <span
        className={`mx-auto truncate rounded-md px-6 py-0.5 text-[0.6875rem] sm:px-12 ${
          dark ? "bg-white/[0.05] text-carbon-400" : "bg-carbon-900/[0.04] text-carbon-400"
        }`}
      >
        {label}
      </span>
    ) : null}
    <span className="w-[42px]" aria-hidden="true" />
  </div>
);

// Dark bands paint their own near-black only in the middle and fade to
// transparent at both edges; the page canvas (ThemeCanvas) cross-fades to the
// same near-black while a dark band holds the centre of the viewport, so the
// hand-off reads as one continuous change of light rather than a hard seam.
const DARK_FILL = {
  both: "linear-gradient(to bottom, rgba(8,9,11,0) 0px, #08090B 200px, #08090B calc(100% - 200px), rgba(8,9,11,0) 100%)",
  // For a band that ends the page body (the closing CTA): solid to the bottom
  // edge, so its content never sits on a half-faded ground on pages that have
  // no ThemeCanvas behind them.
  top: "linear-gradient(to bottom, rgba(8,9,11,0) 0px, #08090B 160px, #08090B 100%)"
};

/** A section with the V3 vertical rhythm and an optional aurora. */
export const Band = ({ id, dark = false, aurora = false, fade = "both", className = "", children }) => (
  <section
    id={id}
    data-bg={dark ? "dark" : "light"}
    className={`relative scroll-mt-16 overflow-clip py-20 sm:py-28 lg:py-36 ${
      dark ? "text-carbon-200" : ""
    } ${className}`}
    style={dark ? { backgroundImage: DARK_FILL[fade] || DARK_FILL.both } : undefined}
  >
    {aurora ? <Aurora tone={dark ? "dark" : "light"} /> : null}
    {dark ? (
      // Stripe's dark-section dot grid, pooled under the content.
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(70% 60% at 50% 50%, black, transparent 80%)",
          WebkitMaskImage: "radial-gradient(70% 60% at 50% 50%, black, transparent 80%)"
        }}
      />
    ) : null}
    <div className="vx-shell relative">{children}</div>
  </section>
);

/**
 * A connector with a pulse of light travelling along it: data moving from one
 * stage to the next. Horizontal from `lg`, vertical below.
 */
export const Beam = ({ dark = false, delay = 0, className = "" }) => (
  <span aria-hidden="true" className={`flex items-center justify-center ${className}`}>
    {/* vertical (mobile) */}
    <span
      className={`relative block h-12 w-px overflow-hidden lg:hidden ${dark ? "bg-white/10" : "bg-carbon-900/10"}`}
    >
      <span
        className="vx-beam-y absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-transparent via-brand-500 to-sky-400"
        style={{ animationDelay: `${delay}s` }}
      />
    </span>
    {/* horizontal (desktop) */}
    <span
      className={`relative hidden h-px w-full overflow-hidden lg:block ${dark ? "bg-white/10" : "bg-carbon-900/10"}`}
    >
      <span
        className="vx-beam-x absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-brand-500 to-sky-400 shadow-[0_0_10px_rgba(102,87,217,0.8)]"
        style={{ animationDelay: `${delay}s` }}
      />
    </span>
  </span>
);

/**
 * Mercury's signature: the page background itself cross-fades between light
 * and dark as sections pass the middle of the viewport. Sections opt in with
 * `data-bg="light" | "dark"`; this fixed layer sits behind all of them.
 */
export const ThemeCanvas = () => {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll("[data-bg]"));
    if (!sections.length || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const next = entry.target.getAttribute("data-bg") === "dark";
          setDark(next);
          // The nav listens for this so it can follow the page into the dark.
          window.dispatchEvent(new CustomEvent("vx-theme", { detail: next ? "dark" : "light" }));
        });
      },
      { rootMargin: "-50% 0px -50% 0px" }
    );
    sections.forEach((section) => observer.observe(section));
    return () => {
      observer.disconnect();
      window.dispatchEvent(new CustomEvent("vx-theme", { detail: "light" }));
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 transition-colors duration-700 ease-out"
      style={{ backgroundColor: dark ? "#08090B" : "#F7F6F2" }}
    />
  );
};

/** Draw at a fixed size, scale down to the available width (never up). */
export const FitCanvas = ({ w, h, children, className = "" }) => {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / w)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [w]);

  return (
    <div ref={ref} className={`relative w-full ${className}`} style={{ height: h * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: w, height: h, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
};
