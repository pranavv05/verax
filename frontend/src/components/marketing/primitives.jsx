import { Link } from "react-router-dom";
import { Reveal } from "../public/motion";

/**
 * V1 marketing primitives.
 *
 * These are the reusable building blocks the unified Verax marketing design
 * system is built from — MarketingContainer/Section/SectionHeader/SplitSection
 * for layout, Eyebrow/PrimaryButton/SecondaryButton/Metric for recurring UI,
 * ProductFrame for real product imagery (screenshots, not the hand-built fake
 * UI in `mockups/`, which keeps using `MockupFrame`).
 *
 * Deliberately no feature-card-grid primitive exists here — the V1 brief
 * explicitly rules that pattern out. Compose sections from SplitSection /
 * ProductShowcase instead: a claim beside the real UI that proves it.
 *
 * Status: additive only. Nothing in the app imports these yet — HomePage and
 * the other existing marketing pages keep their current hand-written markup
 * until they're migrated in a follow-up pass. See `DESIGN_SYSTEM.md`.
 */

const TONE_BG = {
  canvas: "bg-canvas",
  surface: "bg-surface",
  navy: "bg-navy-800"
};

/** Centres content at the marketing shell width (1200px, same as `.vx-shell`). */
export const MarketingContainer = ({ children, className = "" }) => (
  <div className={`vx-shell ${className}`}>{children}</div>
);

/**
 * Full-bleed section with the V1 vertical rhythm (160/96/64px). `tone` picks
 * the section background — `navy` is reserved for contrast sections (see
 * DESIGN_SYSTEM.md §1); it does not recolour arbitrary children, only the
 * text rendered by SectionHeader/SplitSection/Eyebrow below.
 */
export const Section = ({
  id,
  tone = "canvas",
  className = "",
  containerClassName = "",
  children,
  ...rest
}) => (
  <section id={id} className={`vx-section ${TONE_BG[tone] || TONE_BG.canvas} ${className}`} {...rest}>
    <MarketingContainer className={containerClassName}>{children}</MarketingContainer>
  </section>
);

/** Small uppercase label, the accent colour of the system. */
export const Eyebrow = ({ children, tone = "canvas", className = "" }) => (
  <p className={`vx-label ${tone === "navy" ? "text-brand-300" : "text-brand-600"} ${className}`}>
    {children}
  </p>
);

/**
 * Eyebrow + heading + optional body, the header every section opens with.
 * `align="center"` clamps to the editorial measure (800px); `align="left"`
 * is for two-column layouts that need a shorter left-aligned intro instead.
 */
export const SectionHeader = ({
  eyebrow,
  heading,
  body,
  align = "center",
  tone = "canvas",
  className = ""
}) => {
  const dark = tone === "navy";
  return (
    <div className={`${align === "center" ? "vx-measure text-center" : "max-w-2xl"} ${className}`}>
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
      <h2 className={`vx-h2 mt-5 ${dark ? "text-white" : ""}`}>{heading}</h2>
      {body ? <p className={`vx-body mt-6 ${dark ? "text-white/70" : ""}`}>{body}</p> : null}
    </div>
  );
};

/**
 * The Coda-mode composition: a claim on one side, the product UI that proves
 * it on the other. `reversed` mirrors the pair so consecutive sections don't
 * settle into a single column of text down one edge — the visual column
 * always keeps the larger share of the grid regardless of which side it's on.
 */
export const SplitSection = ({
  id,
  tone = "canvas",
  reversed = false,
  eyebrow,
  heading,
  body,
  extra,
  visual,
  className = ""
}) => {
  const dark = tone === "navy";
  return (
    <Section id={id} tone={tone} className={className}>
      <div
        className={`grid items-center gap-12 lg:gap-16 ${
          reversed ? "lg:grid-cols-[1.1fr_0.9fr]" : "lg:grid-cols-[0.9fr_1.1fr]"
        }`}
      >
        <Reveal className={reversed ? "lg:order-2" : undefined}>
          {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
          <h2 className={`vx-h2 mt-5 ${dark ? "text-white" : ""}`}>{heading}</h2>
          {body ? (
            <p className={`vx-body mt-6 max-w-[35rem] ${dark ? "text-white/70" : ""}`}>{body}</p>
          ) : null}
          {extra}
        </Reveal>

        <Reveal className={reversed ? "lg:order-1" : undefined} delay={0.1}>
          {visual}
        </Reveal>
      </div>
    </Section>
  );
};

/**
 * Centred claim above a full-width product frame — for a single UI moment
 * that doesn't need a two-column split (e.g. a payoff/flow screen).
 */
export const ProductShowcase = ({
  id,
  tone = "canvas",
  eyebrow,
  heading,
  body,
  visual,
  align = "center",
  className = ""
}) => (
  <Section id={id} tone={tone} className={className}>
    <SectionHeader eyebrow={eyebrow} heading={heading} body={body} align={align} tone={tone} />
    <Reveal className="mt-16" delay={0.1}>
      <ProductFrame>{visual}</ProductFrame>
    </Reveal>
  </Section>
);

/**
 * Restrained container for real product imagery — screenshots or the
 * `mockups/` fake UI. Hairline border, soft contact shadow (`.vx-mockup`),
 * moderate radius. Not every marketing element should live in a card, so use
 * this only around an actual picture of software, not as a general panel.
 */
export const ProductFrame = ({ children, padded = false, className = "" }) => (
  <div
    className={`vx-mockup overflow-hidden rounded-2xl border border-hairline bg-surface ${
      padded ? "p-6 sm:p-8" : ""
    } ${className}`}
  >
    {children}
  </div>
);

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium " +
  "transition-opacity duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-55";

/**
 * Polymorphic action buttons: pass `to` for an internal route, `href` for an
 * anchor/external link, or neither for a `<button>`. Primary is a solid
 * violet fill (the one saturated surface on the page); secondary is a
 * hairline outline — never a second filled pill beside the first, which is
 * the tell of a template CTA pair.
 */
export const PrimaryButton = ({ children, to, href, className = "", ...rest }) => {
  const cls = `${buttonBase} bg-brand-500 text-white hover:opacity-[0.88] focus-visible:ring-brand-500 ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
};

export const SecondaryButton = ({ children, to, href, className = "", ...rest }) => {
  const cls =
    `${buttonBase} border border-hairline bg-transparent text-zinc-100 ` +
    `hover:border-hairline-strong hover:opacity-100 focus-visible:ring-brand-500 ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
};

const METRIC_TONE = {
  default: "text-zinc-100",
  brand: "text-brand-600",
  verify: "text-verify-700",
  amber: "text-amber-700",
  red: "text-red-700"
};

/** A single large number + label — Paraform-style proof, never inside a card. */
export const Metric = ({ value, label, tone = "default", className = "" }) => (
  <div className={className}>
    <div
      className={`vx-nums text-4xl font-bold tracking-[-0.04em] sm:text-[2.75rem] ${
        METRIC_TONE[tone] || METRIC_TONE.default
      }`}
    >
      {value}
    </div>
    <div className="mt-2 text-[13px] font-medium text-zinc-500">{label}</div>
  </div>
);
