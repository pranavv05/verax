const StatCard = ({ label, value, hint, tone = "default", icon, gradient }) => {
  const toneClass =
    tone === "success"
      ? "border-mint-500/30 bg-mint-500/5"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-[#e7dcc8] bg-white";

  return (
    <article className={`panel hover-lift card-shine border ${toneClass} p-5 transition-all duration-300`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
          <p className="mt-2 text-3xl font-extrabold text-ink-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
        </div>
        {icon && gradient && (
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}>
            {icon}
          </div>
        )}
      </div>
    </article>
  );
};

export default StatCard;
