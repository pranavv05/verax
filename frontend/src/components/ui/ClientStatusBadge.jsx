// The client portal only ever shows three statuses, in plain English.
const TONES = {
  Processing: "border-blue-200 bg-blue-50 text-blue-700",
  "Under Review": "border-amber-200 bg-amber-50 text-amber-800",
  Complete: "border-mint-300 bg-mint-500/10 text-mint-700"
};

export const CLIENT_STATUS_HELP = {
  Processing: "We've received it and are reading the details.",
  "Under Review": "Your accountant is checking it over.",
  Complete: "Done — this one is filed into your accounts."
};

const ClientStatusBadge = ({ status }) => (
  <span
    className={`inline-block whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold ${
      TONES[status] || "border-[#e7dcc8] bg-sand-50 text-[#607086]"
    }`}
  >
    {status}
  </span>
);

export default ClientStatusBadge;
