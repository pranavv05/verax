const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatExpiryDate = (value) => {
  if (!value) {
    return "the expiry time";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
};

const clientMagicLinkSubject = ({ firmName }) => `${firmName} is requesting documents from you`;

const clientMagicLinkTemplate = ({
  uploadLink,
  firmName,
  clientName,
  documentTypes = [],
  expiryDate,
  singleUse = false
}) => {
  const types = documentTypes.length > 0 ? documentTypes : ["documents"];
  return `
    <div style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border:1px solid #e7dcc8;border-radius:12px;padding:28px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Verax Client Upload</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#111827;">${escapeHtml(firmName)} is requesting documents</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">
            Hello ${escapeHtml(clientName)}, ${escapeHtml(firmName)} has requested the following document types from you:
          </p>
          <ul style="margin:0 0 20px;padding-left:20px;color:#475569;font-size:14px;line-height:1.6;">
            ${types.map((type) => `<li>${escapeHtml(type)}</li>`).join("")}
          </ul>
          <a href="${uploadLink}" style="display:inline-block;margin:0 0 20px;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">
            Upload Documents
          </a>
          <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#64748b;">
            This link expires on ${formatExpiryDate(expiryDate)}.
          </p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
            ${
              singleUse
                ? "This link can only be used once."
                : "You can use this link as many times as you need until then. Keep it for your next batch."
            }
          </p>
        </div>
      </div>
    </div>
  `;
};

module.exports = {
  clientMagicLinkSubject,
  clientMagicLinkTemplate
};
