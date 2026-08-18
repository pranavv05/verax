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
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-700/30"
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
          className={`absolute z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-[#e7dcc8] bg-white py-1.5 shadow-elevated ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {visibleItems.map((item, index) =>
            item === "divider" ? (
              <div key={`divider-${index}`} className="my-1.5 border-t border-[#eee3cf]" />
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
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.destructive
                    ? "text-rose-600 hover:bg-rose-50"
                    : "text-ink-800 hover:bg-sand-100"
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
