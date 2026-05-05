const statusStyles = {
  active: "bg-mint-500/10 text-mint-600 border-mint-500/30",
  inactive: "bg-ink-900/10 text-ink-700 border-ink-700/30",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  uploaded: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  processing: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
  extracted: "bg-teal-500/10 text-teal-700 border-teal-500/30",
  review_required: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  reviewed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  exported: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",
  generated: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  downloaded: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  failed: "bg-rose-500/10 text-rose-700 border-rose-500/30"
};

const StatusBadge = ({ status }) => {
  const normalized = String(status || "unknown").toLowerCase();
  const style = statusStyles[normalized] || "bg-ink-900/10 text-ink-700 border-ink-700/30";
  const label = normalized === "review_required" ? "Needs Review" : normalized.replace(/_/g, " ");

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${style}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
