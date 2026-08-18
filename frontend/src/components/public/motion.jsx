import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useInView,
  useReducedMotion
} from "framer-motion";

/**
 * Shared motion vocabulary for the public surface.
 *
 * House rules: one curve (expo-out), one distance (40px), one duration (0.8s),
 * 0.1s of stagger between siblings, and everything fires once. No bounce, no
 * elastic, no spring, nothing scaled past 1.02. Only two things loop on the
 * whole surface — the hero mockup's float and the trust-bar marquee. Every
 * primitive below collapses to a no-op under prefers-reduced-motion.
 */
export const EASE = [0.16, 1, 0.3, 1];

/** The canonical entrance distance and duration. */
export const REVEAL_Y = 40;
export const REVEAL_DURATION = 0.8;

export const fadeUp = {
  hidden: { opacity: 0, y: REVEAL_Y },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: REVEAL_DURATION, ease: EASE }
  }
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: REVEAL_DURATION, ease: EASE } }
};

/** Page-level entrance. Wrap the top-level element of a public page. */
export const PageTransition = ({ children, className = "" }) => {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {children}
    </motion.div>
  );
};

/** Reveal a single block when it scrolls into view. */
export const Reveal = ({
  children,
  className = "",
  delay = 0,
  y = REVEAL_Y,
  amount = 0.2,
  as = "div",
  ...rest
}) => {
  const reduced = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  return (
    <MotionTag
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: REVEAL_DURATION, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
};

/**
 * Parent for a group of RevealItem children. Children animate 0.1s apart, which
 * is the stagger the design system standardises on.
 */
export const RevealGroup = ({
  children,
  className = "",
  stagger = 0.1,
  delay = 0,
  amount = 0.2,
  as = "div",
  ...rest
}) => {
  const MotionTag = motion[as] || motion.div;

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } }
      }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
};

export const RevealItem = ({ children, className = "", as = "div", ...rest }) => {
  const reduced = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  return (
    <MotionTag
      className={className}
      variants={reduced ? { hidden: {}, visible: {} } : fadeUp}
      {...rest}
    >
      {children}
    </MotionTag>
  );
};

/**
 * Hover treatment for cards. The visible change is the border
 * (rgba(255,255,255,0.07) -> 0.14), handled in CSS by `.vx-card`; this adds a
 * 2px settle so the card acknowledges the cursor without lifting off the page.
 */
export const hoverLift = {
  whileHover: { y: -2, transition: { duration: 0.25, ease: EASE } }
};

/** Hover treatment for buttons — opacity only. No scale, no lift. */
export const hoverPress = {
  whileHover: { opacity: 0.82, transition: { duration: 0.15, ease: "linear" } }
};

/**
 * Counts from 0 to `value` the first time it scrolls into view.
 * `format` receives the current (rounded) number.
 */
export const Counter = ({
  value,
  duration = 1.6,
  format = (n) => n.toLocaleString("en-IN"),
  className = ""
}) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;

    if (reduced) {
      setDisplay(value);
      return undefined;
    }

    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (latest) => setDisplay(Math.round(latest))
    });

    return () => controls.stop();
  }, [inView, value, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
};
