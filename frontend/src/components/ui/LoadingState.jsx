export const Spinner = ({ size = 16, className = "" }) => (
  <span
    aria-hidden="true"
    className={`inline-block shrink-0 animate-spin rounded-full border-2 border-ui-line-strong border-t-ui-accent ${className}`}
    style={{ width: size, height: size }}
  />
);

const LoadingState = ({ message = "Loading…" }) => (
  <div
    role="status"
    className="inline-flex items-center gap-3 rounded-xl border border-ui-line bg-ui-surface px-4 py-3 text-[0.8125rem] font-medium text-ui-fg-2 shadow-ui-card"
  >
    <Spinner />
    {message}
  </div>
);

export default LoadingState;
