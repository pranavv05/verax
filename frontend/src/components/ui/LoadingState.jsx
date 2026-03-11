const LoadingState = ({ message = "Loading..." }) => (
  <div className="panel flex items-center gap-3 px-4 py-3 text-sm font-semibold text-ink-700">
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-ink-800" />
    {message}
  </div>
);

export default LoadingState;
