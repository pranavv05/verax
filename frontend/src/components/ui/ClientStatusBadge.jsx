import { Badge } from "../app/primitives";

// The client portal only ever shows three statuses, in plain English.
const TONES = {
  Processing: { tone: "info", pulse: true },
  "Under Review": { tone: "warn" },
  Complete: { tone: "ok" }
};

export const CLIENT_STATUS_HELP = {
  Processing: "We've received it and are reading the details.",
  "Under Review": "Your accountant is checking it over.",
  Complete: "Done — this one is filed into your accounts."
};

const ClientStatusBadge = ({ status }) => {
  const config = TONES[status] || { tone: "neutral" };
  return (
    <Badge tone={config.tone} dot pulse={config.pulse} className="text-[0.8125rem]">
      {status}
    </Badge>
  );
};

export default ClientStatusBadge;
