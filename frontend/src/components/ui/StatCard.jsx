const StatCard = ({ label, value, hint, tone = "default" }) => {
  const toneClass =
    tone === "success"
      ? "border-mint-500/30 bg-mint-500/5"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-[#e7dcc8] bg-white";

  return (
    <article className={`panel border ${toneClass} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#5f6f84]">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-ink-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#708096]">{hint}</p> : null}
    </article>
  );
};

export default StatCard;
