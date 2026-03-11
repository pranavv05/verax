const LoadingState = ({ message = "Loading..." }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-[#e7dcc8] bg-white/80 px-5 py-4 text-sm font-semibold text-ink-700 shadow-sm backdrop-blur-sm">
    <div className="relative h-5 w-5">
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-ink-200 border-t-mint-500" />
    </div>
    {message}
  </div>
);

export default LoadingState;
