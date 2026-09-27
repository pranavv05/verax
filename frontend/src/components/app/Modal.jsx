import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";
import { IconClose } from "./icons";

const EASE = [0.16, 1, 0.3, 1];

/**
 * Centred dialog for the signed-in app. Escape and the backdrop close it
 * (unless `busy`), focus moves into the panel on open and back to the
 * previously focused element on close.
 */
const Modal = ({ open, onClose, title, description, children, footer, size = "md", busy = false, tone }) => {
  const reduced = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      // First field wins over the close button, which comes first in the DOM.
      const panel = panelRef.current;
      const focusable = [
        "[autofocus]",
        "input:not([disabled]):not([type=hidden])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "button:not([disabled])"
      ]
        .map((selector) => panel?.querySelector(selector))
        .find(Boolean);
      (focusable || panel)?.focus();
    });
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      returnFocusRef.current?.focus?.();
    };
  }, [open, busy, onClose]);

  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : size === "xl" ? "max-w-4xl" : "max-w-md";

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-carbon-950/40 backdrop-blur-[2px] dark:bg-black/60"
            onClick={busy ? undefined : onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
            className={cn(
              "relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-ui-line bg-ui-raised shadow-ui-pop outline-none",
              width
            )}
          >
            <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
              <div className="min-w-0">
                <h2 id={titleId} className={cn("text-base font-semibold tracking-[-0.015em]", tone === "err" ? "text-ui-err" : "text-ui-fg")}>
                  {title}
                </h2>
                {description ? <p className="mt-1 text-[0.8125rem] leading-relaxed text-ui-fg-3">{description}</p> : null}
              </div>
              <button type="button" onClick={onClose} disabled={busy} className="btn-icon -mr-2 -mt-1" aria-label="Close">
                <IconClose size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-3">{children}</div>
            {footer ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ui-line bg-ui-subtle px-6 py-3.5">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
};

/** Yes/no confirmation built on Modal. */
export const ConfirmDialog = ({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  busyLabel,
  busy = false,
  destructive = false,
  error,
  children
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    description={description}
    size="sm"
    busy={busy}
    footer={
      <>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={destructive ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={busy}>
          {busy ? busyLabel || `${confirmLabel}…` : confirmLabel}
        </button>
      </>
    }
  >
    {children}
    {error ? (
      <p role="alert" className="mt-1 rounded-lg border border-ui-err/20 bg-ui-err/[0.06] px-3 py-2 text-[0.8125rem] text-ui-err">
        {error}
      </p>
    ) : null}
  </Modal>
);

export default Modal;
