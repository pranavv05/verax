import { Badge } from "../app/primitives";

// Status colour means status only: teal = done, amber = needs a person,
// rose = failed, blue = in flight or handed on, violet = waiting on review.
const STATUS = {
  active: { tone: "ok", label: "Active" },
  inactive: { tone: "neutral", label: "Inactive" },
  pending: { tone: "warn", label: "Pending" },
  uploaded: { tone: "neutral", label: "Uploaded" },
  processing: { tone: "info", label: "Processing", pulse: true },
  extracted: { tone: "accent", label: "Ready for review" },
  review_required: { tone: "warn", label: "Needs review" },
  reviewed: { tone: "info", label: "Reviewed" },
  exported: { tone: "ok", label: "Exported" },
  generated: { tone: "info", label: "Generated" },
  downloaded: { tone: "ok", label: "Downloaded" },
  failed: { tone: "err", label: "Failed" }
};

const StatusBadge = ({ status, label }) => {
  const normalized = String(status || "unknown").toLowerCase();
  const config = STATUS[normalized] || {
    tone: "neutral",
    label: normalized.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  };

  return (
    <Badge tone={config.tone} dot pulse={config.pulse}>
      {label || config.label}
    </Badge>
  );
};

export default StatusBadge;
