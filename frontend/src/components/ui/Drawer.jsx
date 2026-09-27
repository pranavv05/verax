import { useEffect } from "react";

/**
 * Right-side sliding panel — backdrop click and Escape both close it.
 * Content is left entirely to the caller (`children`); this only owns the
 * shell, backdrop, and open/close mechanics.
 */
const Drawer = ({ open, onClose, title, subtitle, children, widthClassName = "max-w-md" }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-carbon-950/40 backdrop-blur-[2px] transition-opacity dark:bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex h-full w-full ${widthClassName} flex-col border-l border-ui-line bg-ui-raised shadow-ui-pop`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ui-line px-6 py-5">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.015em] text-ui-fg">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[0.8125rem] text-ui-fg-3">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn-icon -mr-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

export default Drawer;
