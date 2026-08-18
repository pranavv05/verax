import { Reveal } from "../public/motion";

/**
 * "The Ledger" — the atoms the V2 marketing surface is drawn from.
 *
 * The whole site uses three shapes and nothing else, at every scale:
 *
 *   Sheet   ruled paper. A document nobody has read yet.
 *   Field   a bracketed label/value pair. Something lifted out of a Sheet.
 *   Mark    a hairline tick (validated) or a caret (needs a human).
 *
 * connected by Rail, the dashed track documents travel along. Sections are
 * composed from these rather than from icons-in-tinted-boxes, which is what
 * makes an invoice section and a reconciliation section read as two views of
 * one system instead of two cards from one template.
 *
 * Everything here is presentational and dependency-free apart from `Reveal`.
 */

/* ── Rails ──────────────────────────────────────────────────────────────── */

export const Rail = ({ dark = false, className = "" }) => (
  <span
    aria-hidden="true"
    className={`vx-rail block ${dark ? "vx-rail-dark" : ""} ${className}`}
  />
);

export const RailV = ({ dark = false, className = "" }) => (
  <span
    aria-hidden="true"
    className={`vx-rail-v block ${dark ? "vx-rail-dark" : ""} ${className}`}
  />
);

/**
 * Horizontal on desktop, vertical on mobile. Every flow diagram on the site
 * uses this rather than shipping two hand-written layouts, so a pipeline reads
 * the same way on a phone as it does on a laptop.
 */
export const FlowRail = ({ dark = false, className = "" }) => (
  <span aria-hidden="true" className={`flex items-center justify-center ${className}`}>
    <RailV dark={dark} className="h-10 lg:hidden" />
    <Rail dark={dark} className="hidden w-full lg:block" />
  </span>
);

/* ── Marks ──────────────────────────────────────────────────────────────── */

/** Validated. The only green on the page, and it is always this shape. */
export const Tick = ({ size = 12, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
    className={`flex-none ${className}`}
  >
    <path
      d="M2 6.2 4.6 8.8 10 3.4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
    />
  </svg>
);

/** Needs a human. Deliberately a different *shape*, not just a different hue. */
export const Caret = ({ size = 12, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
    className={`flex-none ${className}`}
  >
    <path d="M6 1.6 11.2 10.4H0.8L6 1.6Z" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6 4.9v2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
  </svg>
);

/* ── Sheet ──────────────────────────────────────────────────────────────── */

const SHEET_TONE = {
  paper: "border-hairline bg-white",
  well: "border-hairline bg-well",
  dark: "border-white/12 bg-carbon-800"
};

/**
 * A document, drawn as paper: a hairline rectangle, a folded corner, a type
 * label, and ruled lines standing in for text nobody has read yet.
 *
 * `lines` is how much writing is on it; `width`/`height` are passed through as
 * classes so callers can build a pile of mismatched sheets, which is what
 * "the shoebox of paperwork a client sends" actually looks like.
 */
export const Sheet = ({
  label,
  lines = 5,
  tone = "paper",
  fold = true,
  className = "",
  labelClassName = "",
  children
}) => {
  const dark = tone === "dark";

  return (
    <div
      className={`relative overflow-hidden rounded-[3px] border ${
        SHEET_TONE[tone] || SHEET_TONE.paper
      } ${className}`}
    >
      {fold ? (
        <span
          aria-hidden="true"
          className={`absolute right-0 top-0 h-0 w-0 border-l-[14px] border-t-[14px] border-l-transparent ${
            dark ? "border-t-white/12" : "border-t-hairline"
          }`}
        />
      ) : null}

      <div className="flex h-full flex-col px-2.5 py-2">
        {label ? (
          <span
            className={`vx-mono text-[0.5rem] font-medium uppercase leading-none tracking-[0.12em] ${
              dark ? "text-carbon-300" : "text-carbon-400"
            } ${labelClassName}`}
          >
            {label}
          </span>
        ) : null}

        {children || (
          <span
            aria-hidden="true"
            className={`mt-2 block flex-1 ${dark ? "vx-sheet-dark" : "vx-sheet"}`}
            style={{ height: lines * 12 }}
          />
        )}
      </div>
    </div>
  );
};

/* ── Field ──────────────────────────────────────────────────────────────── */

const FIELD_STATE = {
  valid: "text-verify-600",
  flagged: "text-amber-600",
  none: ""
};

/**
 * A value that has been lifted out of a document: a small label, the value in
 * mono (because mono is what marks a string as *extracted*), and a mark saying
 * whether a human still needs to look at it.
 */
export const Field = ({
  label,
  value,
  state = "none",
  dark = false,
  className = ""
}) => (
  <div
    className={`flex items-baseline justify-between gap-4 border-b py-2.5 ${
      dark ? "border-white/10" : "border-hairline"
    } ${className}`}
  >
    <span
      className={`text-[0.6875rem] font-medium uppercase tracking-[0.1em] ${
        dark ? "text-carbon-300" : "text-carbon-400"
      }`}
    >
      {label}
    </span>
    <span className="flex items-center gap-2">
      <span
        className={`vx-mono text-[0.8125rem] font-medium ${
          dark ? "text-white" : "text-carbon-900"
        }`}
      >
        {value}
      </span>
      {state === "valid" ? <Tick className={FIELD_STATE.valid} /> : null}
      {state === "flagged" ? <Caret className={FIELD_STATE.flagged} /> : null}
    </span>
  </div>
);

/* ── Section furniture ──────────────────────────────────────────────────── */

/** Small mono label with an indigo tick-mark. Opens most sections. */
export const Eyebrow = ({ children, dark = false, className = "" }) => (
  <p
    className={`vx-index flex items-center gap-2.5 ${
      dark ? "text-carbon-300" : "text-carbon-400"
    } ${className}`}
  >
    <span aria-hidden="true" className="h-[7px] w-[7px] flex-none bg-brand-500" />
    {children}
  </p>
);

/**
 * Eyebrow + two-line headline + body. `align="left"` is the default because
 * the V2 rhythm alternates left-aligned section openings with the occasional
 * centred one, rather than centring everything down the page.
 */
export const SectionHead = ({
  eyebrow,
  title,
  body,
  align = "left",
  dark = false,
  className = "",
  children
}) => (
  <Reveal
    className={`${align === "center" ? "mx-auto max-w-[52rem] text-center" : "max-w-[46rem]"} ${className}`}
  >
    {eyebrow ? (
      <Eyebrow dark={dark} className={align === "center" ? "justify-center" : ""}>
        {eyebrow}
      </Eyebrow>
    ) : null}

    <h2 className={`vx-h2-xl mt-6 [text-wrap:balance] ${dark ? "text-white" : ""}`}>
      {title}
    </h2>

    {body ? (
      <p
        className={`vx-body mt-6 max-w-[38rem] ${align === "center" ? "mx-auto" : ""} ${
          dark ? "text-carbon-300" : "text-carbon-500"
        }`}
      >
        {body}
      </p>
    ) : null}

    {children}
  </Reveal>
);

/** Full-bleed section with the marketing vertical rhythm. */
export const Section = ({ id, dark = false, className = "", children }) => (
  <section
    id={id}
    className={`vx-section scroll-mt-16 ${dark ? "vx-dark" : ""} ${className}`}
  >
    <div className="vx-shell">{children}</div>
  </section>
);
