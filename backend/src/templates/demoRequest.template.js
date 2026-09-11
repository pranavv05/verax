const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatRequestedAt = (date) =>
  `${new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  })} IST`;

const demoRequestSubject = ({ firmName, email }) =>
  `New Verax Demo Request — ${firmName || email}`;

const demoRequestTemplate = ({ firmName, contactName, email, phone, requestedAt }) => `
  <div style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e7dcc8;border-radius:12px;padding:28px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">New sales lead</p>
        <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#111827;">New demo request received</h1>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
          <tr>
            <td style="padding:6px 0;font-weight:700;width:110px;vertical-align:top;">Firm</td>
            <td style="padding:6px 0;">${escapeHtml(firmName || "-")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-weight:700;vertical-align:top;">Contact</td>
            <td style="padding:6px 0;">${escapeHtml(contactName || "-")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-weight:700;vertical-align:top;">Email</td>
            <td style="padding:6px 0;">${escapeHtml(email)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-weight:700;vertical-align:top;">Phone</td>
            <td style="padding:6px 0;">${escapeHtml(phone || "-")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-weight:700;vertical-align:top;">Requested at</td>
            <td style="padding:6px 0;">${escapeHtml(formatRequestedAt(requestedAt))}</td>
          </tr>
        </table>
      </div>
    </div>
  </div>
`;

module.exports = {
  demoRequestSubject,
  demoRequestTemplate
};
