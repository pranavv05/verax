import { IconFiles } from "../app/icons";

/**
 * Empty state: an icon on a faint dot grid (the landing page's inset well),
 * a one-line title, a sentence, and at most one action.
 */
const EmptyState = ({ title, description, action, icon, compact = false }) => (
  <div
    className={`relative flex flex-col items-center overflow-hidden rounded-xl border border-dashed border-ui-line-strong/80 bg-ui-subtle text-center ${
      compact ? "gap-2 px-6 py-8" : "gap-3 px-6 py-12"
    }`}
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-70"
      style={{
        backgroundImage: "radial-gradient(rgb(var(--ui-fg) / 0.08) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        maskImage: "radial-gradient(50% 60% at 50% 40%, black, transparent 80%)",
        WebkitMaskImage: "radial-gradient(50% 60% at 50% 40%, black, transparent 80%)"
      }}
    />
    <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-ui-line bg-ui-surface text-ui-fg-3 shadow-ui-card">
      {icon || <IconFiles size={18} />}
    </div>
    <h3 className="relative text-[0.9375rem] font-semibold tracking-[-0.01em] text-ui-fg">{title}</h3>
    {description ? (
      <p className="relative max-w-sm text-[0.8125rem] leading-relaxed text-ui-fg-3">{description}</p>
    ) : null}
    {action ? <div className="relative mt-1">{action}</div> : null}
  </div>
);

export default EmptyState;
