const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const CLIENT_PORTAL_INVITE_SUBJECT = "Your Verax client portal is ready";

const clientPortalInviteTemplate = ({
  loginUrl,
  portalEmail,
  tempPassword,
  clientName = "",
  firmName = "your CA firm"
}) => `
  <div style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e7dcc8;border-radius:12px;padding:28px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(firmName)}</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#111827;">Your client portal is ready</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
          ${clientName ? `Hello ${escapeHtml(clientName)},` : "Hello,"} ${escapeHtml(firmName)} has set up a secure portal
          where you can see the documents they hold for you, track what is being
          worked on, and download your reconciliation reports.
        </p>

        <div style="margin:0 0 20px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Email</p>
          <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#111827;">${escapeHtml(portalEmail)}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Temporary password</p>
          <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.06em;font-family:'Courier New',monospace;color:#111827;">${escapeHtml(tempPassword)}</p>
        </div>

        <a href="${loginUrl}" style="display:inline-block;margin:0 0 20px;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">
          Open your portal
        </a>

        <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#64748b;">
          Please change this temporary password the first time you sign in.
        </p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
          If you were not expecting this email, contact ${escapeHtml(firmName)}.
        </p>
      </div>
    </div>
  </div>
`;

module.exports = {
  CLIENT_PORTAL_INVITE_SUBJECT,
  clientPortalInviteTemplate
};
