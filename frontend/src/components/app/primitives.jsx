import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";
import { IconAlert, IconCheckCircle, IconChevronRight, IconInfo, IconXCircle } from "./icons";

/**
 * Building blocks for every signed-in screen. They carry the public V3 system
 * into a working app: Inter, hairline surfaces on the ivory canvas, a quiet
 * two-tone heading, and the gradient kicker — at a density meant to be used
 * all day rather than scrolled once. Everything is themed via `ui-*` tokens.
 */

/** The landing page's gradient eyebrow, sized for the app. */
export const Kicker = ({ children, className = "" }) => (
  <p className={cn("inline-flex items-center gap-2 text-xs font-semibold tracking-[-0.005em]", className)}>
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-brand-500 to-sky-500" />
    <span className="vx-hero-gradient">{children}</span>
  </p>
);

/**
 * Page header: optional breadcrumbs and kicker, a two-tone title (statement
 * plus a muted continuation, as on the landing page), a description, and
 * right-aligned actions that wrap under the title on small screens.
 */
export const PageHeader = ({ breadcrumbs, kicker, title, tint, description, actions, className = "" }) => (
  <header className={cn("mb-7 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-end md:justify-between", className)}>
    <div className="min-w-0">
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} className="mb-3" /> : null}
      {kicker ? <Kicker className="mb-2.5">{kicker}</Kicker> : null}
      <h1 className="text-[1.625rem] font-semibold leading-[1.15] tracking-[-0.03em] text-ui-fg sm:text-[1.875rem]">
        {title}
        {tint ? <span className="font-normal text-ui-fg-3"> {tint}</span> : null}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ui-fg-3">{description}</p>
      ) : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </header>
);

export const Breadcrumbs = ({ items, className = "" }) => (
  <nav aria-label="Breadcrumb" className={className}>
    <ol className="flex flex-wrap items-center gap-1 text-[0.8125rem] text-ui-fg-3">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1">
            {item.to && !last ? (
              <Link to={item.to} className="rounded transition-colors hover:text-ui-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent">
                {item.label}
              </Link>
            ) : (
              <span className={last ? "font-medium text-ui-fg-2" : ""} aria-current={last ? "page" : undefined}>
                {item.label}
              </span>
            )}
            {!last ? <IconChevronRight size={13} className="text-ui-fg-4" /> : null}
          </li>
        );
      })}
    </ol>
  </nav>
);

/** Hairline card. `as` lets it render as a section/article. */
export const Card = ({ as: Tag = "section", className = "", children, ...rest }) => (
  <Tag className={cn("panel", className)} {...rest}>
    {children}
  </Tag>
);

export const CardHeader = ({ title, description, action, icon, className = "" }) => (
  <div className={cn("flex items-start justify-between gap-4 border-b border-ui-line px-5 py-4", className)}>
    <div className="flex min-w-0 items-start gap-3">
      {icon ? (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-ui-line bg-ui-subtle text-ui-fg-3">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ui-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ui-fg-3">{description}</p> : null}
      </div>
    </div>
    {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
  </div>
);

/** The landing page's panel strip: a quiet footer with an aside and one action. */
export const CardFooter = ({ children, className = "" }) => (
  <div
    className={cn(
      "flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-ui-line bg-ui-subtle px-5 py-3 text-[0.8125rem] text-ui-fg-3",
      className
    )}
  >
    {children}
  </div>
);

/** Text action with a chevron that nudges on hover. */
export const ActionLink = ({ to, children, className = "", ...rest }) => (
  <Link to={to} className={cn("link-action group", className)} {...rest}>
    {children}
    <IconChevronRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
  </Link>
);

const TONE_TEXT = {
  neutral: "text-ui-fg",
  ok: "text-ui-ok",
  warn: "text-ui-warn",
  err: "text-ui-err",
  accent: "text-ui-accent-text"
};

/**
 * A figure with its label — the review-queue tiles from the landing page.
 * `tone` colours the number only when it means status.
 */
export const StatTile = ({ label, value, hint, tone = "neutral", icon, to, footer, className = "" }) => {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] font-medium text-ui-fg-3">{label}</p>
        {icon ? <span className="text-ui-fg-4 transition-colors group-hover:text-ui-fg-3">{icon}</span> : null}
      </div>
      <p className={cn("mt-2 text-[1.875rem] font-semibold leading-none tracking-[-0.035em] tabular-nums", TONE_TEXT[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-ui-fg-3">{hint}</p> : null}
      {footer}
    </>
  );

  const classes = cn(
    "panel group block p-5 transition-[border-color,box-shadow,transform] duration-200",
    to && "hover:-translate-y-px hover:border-ui-line-strong hover:shadow-ui-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent",
    className
  );

  return to ? (
    <Link to={to} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
};

const BADGE_TONES = {
  neutral: "border-ui-line bg-ui-subtle text-ui-fg-2",
  ok: "border-ui-ok/20 bg-ui-ok/[0.08] text-ui-ok",
  warn: "border-ui-warn/25 bg-ui-warn/[0.08] text-ui-warn",
  err: "border-ui-err/20 bg-ui-err/[0.07] text-ui-err",
  info: "border-ui-info/20 bg-ui-info/[0.07] text-ui-info",
  accent: "border-ui-accent/20 bg-ui-accent/[0.08] text-ui-accent-text"
};

const DOT_TONES = {
  neutral: "bg-ui-fg-4",
  ok: "bg-ui-ok",
  warn: "bg-ui-warn",
  err: "bg-ui-err",
  info: "bg-ui-info",
  accent: "bg-ui-accent"
};

export const Badge = ({ tone = "neutral", dot = false, pulse = false, className = "", children }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-5",
      BADGE_TONES[tone] || BADGE_TONES.neutral,
      className
    )}
  >
    {dot ? <Dot tone={tone} pulse={pulse} /> : null}
    {children}
  </span>
);

export const Dot = ({ tone = "neutral", pulse = false, className = "" }) => (
  <span aria-hidden="true" className={cn("relative flex h-1.5 w-1.5 shrink-0", className)}>
    {pulse ? (
      <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", DOT_TONES[tone])} />
    ) : null}
    <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", DOT_TONES[tone] || DOT_TONES.neutral)} />
  </span>
);

const ALERT_TONES = {
  err: { box: "border-ui-err/20 bg-ui-err/[0.06] text-ui-err", Icon: IconXCircle },
  warn: { box: "border-ui-warn/25 bg-ui-warn/[0.07] text-ui-warn", Icon: IconAlert },
  ok: { box: "border-ui-ok/20 bg-ui-ok/[0.07] text-ui-ok", Icon: IconCheckCircle },
  info: { box: "border-ui-info/20 bg-ui-info/[0.06] text-ui-info", Icon: IconInfo }
};

/** Inline message. Body text stays in the ink colour for readability. */
export const Alert = ({ tone = "err", title, children, action, onDismiss, className = "" }) => {
  const { box, Icon } = ALERT_TONES[tone] || ALERT_TONES.err;
  return (
    <div role={tone === "err" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", box, className)}>
      <Icon size={16} className="mt-0.5" />
      <div className="min-w-0 flex-1 text-[0.8125rem] leading-relaxed">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5 text-ui-fg-2" : "font-medium"}>{children}</div> : null}
      </div>
      {action}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="btn-icon -my-1 -mr-2 h-7 w-7" aria-label="Dismiss">
          <IconXCircle size={14} />
        </button>
      ) : null}
    </div>
  );
};

/**
 * Pill group with a sliding active pill (the landing page's segmented
 * control). `options` is [{ value, label, count? }].
 */
export const Segmented = ({ options, value, onChange, layoutId, size = "md", className = "", ariaLabel }) => {
  const reduced = useReducedMotion();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-ui-line bg-ui-inset p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ui-accent",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[0.8125rem]",
              active ? "text-ui-fg" : "text-ui-fg-3 hover:text-ui-fg-2"
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                className="absolute inset-0 rounded-full border border-ui-line bg-ui-surface shadow-ui-card"
              />
            ) : null}
            <span className="relative">{option.label}</span>
            {option.count !== undefined && option.count !== null ? (
              <span className={cn("relative tabular-nums", active ? "text-ui-fg-3" : "text-ui-fg-4")}>{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

/** Initials avatar on a soft gradient derived from the name. */
const AVATAR_GRADIENTS = [
  "from-brand-500 to-sky-500",
  "from-sky-500 to-verify-500",
  "from-verify-500 to-brand-500",
  "from-amber-500 to-rose-500",
  "from-brand-400 to-rose-400"
];

export const initialsOf = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

export const Avatar = ({ name, size = 28, className = "" }) => {
  const hash = String(name || "").split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white",
        AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length],
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
    >
      {initialsOf(name)}
    </span>
  );
};

/** Label + control + hint/error, for forms. */
export const FormField = ({ label, htmlFor, hint, error, required, className = "", children }) => (
  <div className={className}>
    {label ? (
      <label htmlFor={htmlFor} className="label">
        {label}
        {required ? <span className="ml-0.5 text-ui-err">*</span> : null}
      </label>
    ) : null}
    {children}
    {error ? (
      <p className="mt-1.5 text-xs font-medium text-ui-err">{error}</p>
    ) : hint ? (
      <p className="mt-1.5 text-xs text-ui-fg-3">{hint}</p>
    ) : null}
  </div>
);

/** A thin progress bar in the brand gradient (the landing page's "March close"). */
export const Progress = ({ value, max = 100, tone = "brand", className = "", label }) => {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill =
    tone === "ok"
      ? "bg-ui-ok"
      : tone === "warn"
        ? "bg-ui-warn"
        : "bg-gradient-to-r from-brand-500 via-sky-500 to-verify-500";
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ui-inset", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
};

/** Section divider label used inside long forms and settings pages. */
export const SectionLabel = ({ children, className = "" }) => (
  <h3 className={cn("text-xs font-medium uppercase tracking-[0.06em] text-ui-fg-3", className)}>{children}</h3>
);
