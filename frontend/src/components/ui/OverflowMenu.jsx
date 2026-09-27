import { useEffect, useRef, useState } from "react";

/**
 * Compact "..." action menu for table rows. `items` is an array of
 * `{ label, onSelect, destructive?, disabled? }` objects; pass the string
 * "divider" for a separator, or a falsy value to conditionally omit an item.
 * Keyboard: Enter/Space opens, Arrow keys move focus, Escape closes and
 * returns focus to the trigger, click-outside closes.
 */
const OverflowMenu = ({ items, align = "right", label = "Row actions" }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);

  const visibleItems = items.filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      itemRefs.current[0]?.focus();
    }
  }, [open]);

  const onTriggerKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event) => {
    const enabledIndexes = visibleItems
      .map((item, index) => (item === "divider" || item.disabled ? -1 : index))
      .filter((index) => index !== -1);
    const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement);

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = enabledIndexes.find((index) => index > currentIndex) ?? enabledIndexes[0];
      itemRefs.current[next]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prevCandidates = enabledIndexes.filter((index) => index < currentIndex);
      const prev = prevCandidates.length > 0 ? prevCandidates[prevCandidates.length - 1] : enabledIndexes[enabledIndexes.length - 1];
      itemRefs.current[prev]?.focus();
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onTriggerKeyDown}
        className="btn-icon"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          onKeyDown={onMenuKeyDown}
          className={`absolute z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-ui-line bg-ui-raised p-1 shadow-ui-pop ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {visibleItems.map((item, index) =>
            item === "divider" ? (
              <div key={`divider-${index}`} className="my-1 border-t border-ui-line" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[0.8125rem] font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.destructive
                    ? "text-ui-err hover:bg-ui-err/[0.08] focus:bg-ui-err/[0.08]"
                    : "text-ui-fg-2 hover:bg-ui-inset hover:text-ui-fg focus:bg-ui-inset focus:text-ui-fg"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default OverflowMenu;
