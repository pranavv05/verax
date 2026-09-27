import { cn } from "../../lib/utils";
import { IconChevronLeft, IconChevronRight, IconClose, IconSearch } from "./icons";

/**
 * Pieces for list pages: a toolbar row, a search field, a scroll wrapper for
 * `.ui-table`, and the pagination strip at the foot of a card.
 */

export const Toolbar = ({ children, className = "" }) => (
  <div className={cn("flex flex-col gap-2.5 border-b border-ui-line px-4 py-3 sm:flex-row sm:items-center", className)}>
    {children}
  </div>
);

export const SearchField = ({ value, onChange, placeholder = "Search…", className = "", label = "Search" }) => (
  <div className={cn("relative min-w-0 flex-1", className)}>
    <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ui-fg-4" />
    <input
      type="search"
      aria-label={label}
      className="field pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
    {value ? (
      <button
        type="button"
        aria-label="Clear search"
        className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ui-fg-4 hover:bg-ui-inset hover:text-ui-fg-2"
        onClick={() => onChange("")}
      >
        <IconClose size={13} />
      </button>
    ) : null}
  </div>
);

// `relative` makes this the containing block for absolutely positioned
// descendants (e.g. sr-only header labels), so they are clipped with the
// table instead of widening the page on narrow screens.
export const TableScroll = ({ children, className = "" }) => (
  <div className={cn("relative overflow-x-auto", className)}>{children}</div>
);

export const Pagination = ({ page, totalPages, total, noun = "item", onPage, className = "" }) => {
  const pages = Math.max(1, totalPages || 1);
  return (
    <div className={cn("flex items-center justify-between gap-3 border-t border-ui-line px-4 py-3 text-[0.8125rem] text-ui-fg-3", className)}>
      <p>
        <span className="font-medium tabular-nums text-ui-fg-2">{total ?? 0}</span> {noun}
        {total === 1 ? "" : "s"}
        <span className="hidden sm:inline">
          {" · "}page {page} of {pages}
        </span>
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className="btn-icon" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <IconChevronLeft size={15} />
        </button>
        <button type="button" className="btn-icon" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <IconChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};
