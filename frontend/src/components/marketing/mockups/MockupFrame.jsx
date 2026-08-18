import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "../../public/motion";

/**
 * Product mockups are drawn at a fixed design size and then scaled to fit their
 * container, rather than being written responsively.
 *
 * The reason: a mockup is a *picture of software*. If its internals reflow at
 * small widths — labels wrapping, rows stacking, 11px type staying 11px inside a
 * 340px-wide card — it stops looking like a screenshot of a real product and
 * starts looking like a broken web page. Scaling keeps every proportion, every
 * alignment and every optical relationship identical from 1440px down to 375px.
 *
 * The scale factor comes from a ResizeObserver rather than a media query so it
 * is exact at every width, including inside the two-column product sections
 * where the available width is not a simple fraction of the viewport.
 */
export const ScaledFrame = ({
  width,
  height,
  minWidth = 480,
  className = "",
  innerClassName = "",
  children
}) => {
  const ref = useRef(null);
  const [available, setAvailable] = useState(width);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured) setAvailable(measured);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Below `minWidth` the mockup stops shrinking and the frame scrolls instead.
  // A product shot squeezed to 330px on a phone is an unreadable grey smudge;
  // one held at 480px and swiped is still a picture of working software.
  const renderWidth = Math.max(available, minWidth);
  const scale = renderWidth / width;
  const scrolls = renderWidth > available;

  const renderHeight = Math.round(height * scale);

  return (
    <div
      ref={ref}
      className={`w-full ${scrolls ? "overflow-x-auto" : "overflow-hidden"} ${className}`}
      style={{ height: renderHeight }}
    >
      {/*
        A CSS transform doesn't change layout size, so the scaled child still
        claims its full design width. This sizing box is what gives the scroll
        container the correct extent.
      */}
      <div className="relative" style={{ width: renderWidth, height: renderHeight }}>
        <div
          className={`absolute left-0 top-0 origin-top-left ${innerClassName}`}
          style={{ width, height, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * The shell every product mockup sits in: hairline border, deep ambient
 * shadow, faint indigo bloom. `float` adds the slow 6s drift used on the hero.
 */
export const MockupShell = ({
  width,
  height,
  float = false,
  className = "",
  children
}) => {
  const reduced = useReducedMotion();

  return (
    <motion.div
      animate={float && !reduced ? { y: [0, -8, 0] } : undefined}
      transition={
        float && !reduced
          ? { duration: 6, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
      className={className}
    >
      <ScaledFrame
        width={width}
        height={height}
        className="vx-mockup vx-nums rounded-2xl border border-hairline bg-surface"
      >
        {children}
      </ScaledFrame>
    </motion.div>
  );
};

/** Title bar shared by the framed mockups. 48px tall at design size. */
export const MockupTopBar = ({ title, status, statusTone = "indigo" }) => (
  <div className="flex h-12 items-center justify-between border-b border-hairline bg-well px-5">
    <div className="flex items-center gap-2.5">
      <span className="h-2 w-2 rounded-full bg-verify-500" />
      <span className="text-[13px] font-medium text-zinc-200">{title}</span>
    </div>
    {status ? (
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          statusTone === "teal"
            ? "bg-verify-500/15 text-verify-700"
            : "bg-indigo-500/15 text-indigo-700"
        }`}
      >
        {status}
      </span>
    ) : null}
  </div>
);

/** The muted section label used inside mockups. */
export const MockupLabel = ({ children, className = "" }) => (
  <p
    className={`text-[11px] font-semibold uppercase leading-none tracking-[0.11em] text-zinc-600 ${className}`}
  >
    {children}
  </p>
);

/**
 * Staggered entrance for the rows inside a mockup. `trigger` is "load" for the
 * hero (which is above the fold and should play immediately) and "view" for
 * every mockup further down the page.
 */
export const useRowMotion = (trigger = "view") => {
  const reduced = useReducedMotion();

  return (index, base = 0, step = 0.11) => {
    if (reduced) return {};

    const transition = {
      duration: 0.5,
      ease: EASE,
      delay: base + index * step
    };

    return trigger === "load"
      ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition }
      : {
          initial: { opacity: 0, y: 8 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.4 },
          transition
        };
  };
};

/**
 * A bar that fills to `value`% of its track. Used for confidence scores, so the
 * fill carries the indigo -> teal signature gradient.
 */
export const ConfidenceBar = ({
  value = 87,
  label = "AI Confidence",
  trigger = "view",
  delay = 0.9
}) => {
  const reduced = useReducedMotion();

  let fill;
  if (reduced) {
    fill = { style: { width: `${value}%` } };
  } else if (trigger === "load") {
    fill = {
      initial: { width: 0 },
      animate: { width: `${value}%` },
      transition: { duration: 1.1, ease: EASE, delay }
    };
  } else {
    fill = {
      initial: { width: 0 },
      whileInView: { width: `${value}%` },
      viewport: { once: true, amount: 0.4 },
      transition: { duration: 1.1, ease: EASE, delay }
    };
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <MockupLabel>{label}</MockupLabel>
        <span className="text-[12px] font-semibold text-zinc-200">{value}%</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/[0.07]">
        <motion.div
          className="h-full rounded-full"
          {...fill}
          style={{
            backgroundImage: "linear-gradient(90deg, #6366F1 0%, #14B8A6 100%)",
            ...fill.style
          }}
        />
      </div>
    </div>
  );
};
